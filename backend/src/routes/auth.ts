import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { config, jwtUtils, prisma } from "@/lib";
import { MS_PER_DAY, MS_PER_WEEK } from "@/lib/constants";
import { logger } from "@/lib/logger.js";
import { success, successWithMessage } from "@/lib/response";
import {
	asyncHandler,
	BadRequestError,
	ConflictError,
	NotFoundError,
	TooManyRequestsError,
	UnauthorizedError,
} from "@/middleware/errorHandler";
import { authRateLimiter, registrationRateLimiter } from "@/middleware/rateLimiter";
import { validate, validationSchemas } from "@/middleware/security";
import {
	checkAccountLockout,
	clearFailedLoginAttempts,
	formatLockoutTime,
	recordFailedLogin,
} from "@/services/authLockout";
import { blacklistToken, isTokenBlacklisted } from "@/services/tokenBlacklist";

type AuditAction = "CREATE" | "READ" | "UPDATE" | "DELETE" | "EXPORT" | "LOGIN";

const router = Router();

// Validation schemas
const registerSchema = z.object({
	email: validationSchemas.email,
	password: validationSchemas.password,
	name: z.string().min(0, "Name (optional)").max(255).optional(),
});

const loginSchema = z.object({
	email: validationSchemas.email,
	password: z.string().min(1, "Password is required"),
});

// Helper: Get user ID from token
async function getUserIdFromToken(authHeader: string | undefined): Promise<string | null> {
	if (!authHeader?.startsWith("Bearer ")) return null;
	const token = authHeader.substring(7);
	try {
		if (await isTokenBlacklisted(token)) return null;
		const payload = jwtUtils.verifyToken(token);
		return payload.userId;
	} catch (error) {
		logger.warn("[AUTH] Token verification failed in getUserIdFromToken", error);
		return null;
	}
}

// Helper: Build auth cookie options
function authCookieOptions(req: Request) {
	return {
		httpOnly: true,
		secure: req.secure,
		sameSite: "strict" as const,
		maxAge: config.session.expiresDays * MS_PER_DAY,
		path: "/",
	};
}

// Helper: Generate tokens + create session
async function createAuthSession(req: Request, userId: string) {
	const token = jwtUtils.generateToken(userId);
	const refreshToken = jwtUtils.generateRefreshToken(userId);
	// Capture the created session so callers can use its id directly instead of
	// re-querying "newest active session", which races under concurrent logins
	// and can return another device's session.
	const session = await prisma.session.create({
		data: {
			userId,
			tokenHash: await bcrypt.hash(refreshToken, 12),
			expiresAt: new Date(Date.now() + config.session.expiresDays * MS_PER_DAY),
			ipAddress: req.ip,
			userAgent: req.get("user-agent"),
		},
	});
	return { token, refreshToken, sessionId: session.id };
}

// Helper: Write audit log
async function auditLog(req: Request, userId: string, resourceType: string, action: AuditAction) {
	await prisma.auditLog
		.create({
			data: {
				userId,
				resourceType,
				resourceId: userId,
				action,
				ipAddress: req.ip,
				userAgent: req.get("user-agent"),
				success: true,
			},
		})
		.catch((err) => logger.warn("Audit log write failed:", err));
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Creates a new user account with email and password. Returns user info, JWT token, and refresh token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         email: { type: string }
 *                         name: { type: string }
 *                         role: { type: string, example: EDITOR }
 *                         avatarUrl: { type: string, nullable: true }
 *                         createdAt: { type: string, format: date-time }
 *                     token: { type: string }
 *                     refreshToken: { type: string }
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 *       429:
 *         description: Rate limit exceeded
 */
// POST /api/auth/register - Register new user
router.post(
	"/register",
	registrationRateLimiter,
	validate(registerSchema),
	asyncHandler(async (req: Request, res: Response) => {
		const validatedData = registerSchema.parse(req.body);

		const existingUser = await prisma.user.findUnique({
			where: { email: validatedData.email },
		});
		if (existingUser) throw new ConflictError("Email already registered");

		const passwordHash = await bcrypt.hash(validatedData.password, 12);
		const user = await prisma.user.create({
			data: {
				email: validatedData.email,
				passwordHash,
				name: validatedData.name || validatedData.email.split("@")[0],
				role: "EDITOR",
			},
			select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
		});

		const { token, refreshToken } = await createAuthSession(req, user.id);
		await auditLog(req, user.id, "User", "CREATE");

		res.cookie("auth_token", token, authCookieOptions(req));
		return success(res, { user, token, refreshToken }, 201);
	}),
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     description: Authenticates a user with email and password. Returns user info, JWT token, and refresh token. Sets an HttpOnly auth cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         email: { type: string }
 *                         name: { type: string }
 *                         role: { type: string }
 *                         avatarUrl: { type: string, nullable: true }
 *                     token: { type: string }
 *                     refreshToken: { type: string }
 *                     sessionId: { type: string }
 *       401:
 *         description: Invalid email or password
 *       429:
 *         description: Rate limit exceeded
 */
// POST /api/auth/login - Login user
router.post(
	"/login",
	authRateLimiter,
	validate(loginSchema),
		asyncHandler(async (req: Request, res: Response) => {
			const validatedData = loginSchema.parse(req.body);

			// Brute-force protection: check account lockout before verifying credentials.
			// authLockout fails closed in prod (Redis down → locked) per its own design.
			const lockout = await checkAccountLockout(validatedData.email);
			if (lockout.isLocked) {
				throw new TooManyRequestsError(
					`Account temporarily locked. Try again in ${formatLockoutTime(lockout.lockoutUntil ?? new Date())}.`,
				);
			}

			const user = await prisma.user.findUnique({ where: { email: validatedData.email } });
			if (!user) {
				await recordFailedLogin(validatedData.email, req.ip ?? "unknown");
				throw new UnauthorizedError("Invalid email or password");
			}

			const isValidPassword = await bcrypt.compare(validatedData.password, user.passwordHash);
			if (!isValidPassword) {
				await recordFailedLogin(validatedData.email, req.ip ?? "unknown");
				throw new UnauthorizedError("Invalid email or password");
			}

			// Credentials valid — clear any prior failed-attempt counters.
			await clearFailedLoginAttempts(validatedData.email);

		const { token, refreshToken, sessionId } = await createAuthSession(req, user.id);

		await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
		await auditLog(req, user.id, "User", "LOGIN");

		res.cookie("auth_token", token, authCookieOptions(req));
		return success(res, {
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
				avatarUrl: user.avatarUrl,
			},
			token,
			refreshToken,
			sessionId,
		});
	}),
);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     description: Invalidates the current session and blacklists the JWT token. Clears the auth cookie.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Invalid token
 */
// POST /api/auth/logout - Logout user
router.post(
	"/logout",
	asyncHandler(async (req: Request, res: Response) => {
		const authHeader = req.headers.authorization;
		const userId = await getUserIdFromToken(authHeader);

		if (!userId) {
			throw new UnauthorizedError("Invalid token");
		}

		// Extract and blacklist the access token
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.substring(7);
			await blacklistToken(token, "logout");
		}

		// Invalidate only the current session
		const { refreshToken: bodyRefreshToken } = req.body || {};
		if (bodyRefreshToken) {
			const sessions = await prisma.session.findMany({
				where: { userId, isActive: true },
			});
			for (const s of sessions) {
				if (await bcrypt.compare(bodyRefreshToken, s.tokenHash)) {
					await prisma.session.update({
						where: { id: s.id },
						data: { isActive: false },
					});
					break;
				}
			}
		} else {
			await prisma.session.updateMany({
				where: { userId, isActive: true },
				data: { isActive: false },
			});
		}

		// Clear auth cookie
		res.clearCookie("auth_token", {
			path: "/",
			httpOnly: true,
			secure: req.secure,
			sameSite: "strict",
		});

		await auditLog(req, userId, "Session", "DELETE");

		return successWithMessage(res, {}, "Logged out successfully");
	}),
);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: Exchanges a valid refresh token for a new JWT access token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *       400:
 *         description: Refresh token is required
 *       401:
 *         description: Invalid refresh token or session
 */
// POST /api/auth/refresh - Refresh access token
router.post(
	"/refresh",
	authRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			throw new BadRequestError("Refresh token is required");
		}

		let userId: string;
		try {
			const payload = jwtUtils.verifyRefreshToken(refreshToken);
			userId = payload.userId;
		} catch (error) {
			logger.warn("[AUTH] Refresh token verification failed", error);
			throw new UnauthorizedError("Invalid refresh token");
		}

		// Find the matching session
		const sessions = await prisma.session.findMany({
			where: { userId, isActive: true },
		});

		let matchedSession: { id: string } | null = null;
		for (const s of sessions) {
			if (await bcrypt.compare(refreshToken, s.tokenHash)) {
				matchedSession = s;
				break;
			}
		}

		if (!matchedSession) {
			throw new UnauthorizedError("Invalid session");
		}

		// Invalidate the old session
		await prisma.session.update({
			where: { id: matchedSession.id },
			data: { isActive: false },
		});

		// Generate new tokens
		const newToken = jwtUtils.generateToken(userId);
		const newRefreshToken = jwtUtils.generateRefreshToken(userId);
		const newTokenHash = await bcrypt.hash(newRefreshToken, 10);

		// Create new session
		await prisma.session.create({
			data: {
				userId,
				tokenHash: newTokenHash,
				// Match the TTL used by createAuthSession (login/register), which is
				// config.session.expiresDays — not a hardcoded 7 days. Using MS_PER_WEEK
				// here desynced the DB session from the refresh-token JWT's actual TTL.
				expiresAt: new Date(Date.now() + config.session.expiresDays * MS_PER_DAY),
				userAgent: req.headers["user-agent"] || null,
			},
		});

		return success(res, { token: newToken, refreshToken: newRefreshToken });
	}),
);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile including dataset and model counts.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         email: { type: string }
 *                         name: { type: string }
 *                         role: { type: string }
 *                         avatarUrl: { type: string, nullable: true }
 *                         preferences: { type: object, nullable: true }
 *                         createdAt: { type: string, format: date-time }
 *                         lastLoginAt: { type: string, format: date-time, nullable: true }
 *                         _count:
 *                           type: object
 *                           properties:
 *                             datasets: { type: integer }
 *                             models: { type: integer }
 *       401:
 *         description: Invalid token
 *       404:
 *         description: User not found
 */
// GET /api/auth/me - Get current user
router.get(
	"/me",
	asyncHandler(async (req: Request, res: Response) => {
		const userId = await getUserIdFromToken(req.headers.authorization);

		if (!userId) {
			throw new UnauthorizedError("Invalid token");
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				name: true,
				role: true,
				avatarUrl: true,
				preferences: true,
				createdAt: true,
				lastLoginAt: true,
				_count: {
					select: {
						datasets: true,
						models: true,
					},
				},
			},
		});

		if (!user) {
			throw new NotFoundError("User");
		}

		return success(res, { user });
	}),
);

/**
 * @openapi
 * /api/auth/me:
 *   put:
 *     tags: [Authentication]
 *     summary: Update current user profile
 *     description: Updates the authenticated user's profile fields (name, avatarUrl, preferences).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Invalid token
 */
// PUT /api/auth/me - Update current user
router.put(
	"/me",
	asyncHandler(async (req: Request, res: Response) => {
		const userId = await getUserIdFromToken(req.headers.authorization);

		if (!userId) {
			throw new UnauthorizedError("Invalid token");
		}

		const updateSchema = z.object({
			name: z.string().min(1).max(255).optional(),
			avatarUrl: z.string().url().optional(),
			preferences: z.record(z.unknown()).optional(),
		});

		const validatedData = updateSchema.parse(req.body);

		// Build Prisma update data with proper types
		const updateData: {
			name?: string;
			avatarUrl?: string;
			preferences?: Record<string, unknown>;
		} = {};
		if (validatedData.name !== undefined) updateData.name = validatedData.name;
		if (validatedData.avatarUrl !== undefined) updateData.avatarUrl = validatedData.avatarUrl;
		if (validatedData.preferences !== undefined) updateData.preferences = validatedData.preferences;

		const user = await prisma.user.update({
			where: { id: userId },
			data: updateData as unknown as Parameters<typeof prisma.user.update>[0]["data"],
			select: {
				id: true,
				email: true,
				name: true,
				role: true,
				avatarUrl: true,
				preferences: true,
			},
		});

		return success(res, { user });
	}),
);

/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Change user password
 *     description: Changes the authenticated user's password. Invalidates all active sessions after successful change.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid token or incorrect current password
 *       404:
 *         description: User not found
 */
// POST /api/auth/change-password - Change password
router.post(
	"/change-password",
	asyncHandler(async (req: Request, res: Response) => {
		const authHeader = req.headers.authorization;
		const userId = await getUserIdFromToken(authHeader);

		if (!userId) {
			throw new UnauthorizedError("Invalid token");
		}

		const schema = z.object({
			currentPassword: z.string().min(1),
			newPassword: validationSchemas.password,
		});

		const validatedData = schema.parse(req.body);

		// Get user
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundError("User");
		}

		// Verify current password
		const isValidPassword = await bcrypt.compare(validatedData.currentPassword, user.passwordHash);

		if (!isValidPassword) {
			throw new UnauthorizedError("Current password is incorrect");
		}

		// Hash new password with 12 rounds for better security
		const passwordHash = await bcrypt.hash(validatedData.newPassword, 12);

		// Blacklist current token
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.substring(7);
			await blacklistToken(token, "password_change");
		}

		// Update password
		await prisma.user.update({
			where: { id: userId },
			data: { passwordHash },
		});

		// Invalidate all sessions
		await prisma.session.updateMany({
			where: { userId },
			data: { isActive: false },
		});

		await auditLog(req, userId, "User", "UPDATE");

		return successWithMessage(res, {}, "Password changed successfully. Please login again.");
	}),
);

/**
 * @openapi
 * /api/auth/verify:
 *   get:
 *     tags: [Authentication]
 *     summary: Verify current token
 *     description: Validates the JWT token from the Authorization header or HttpOnly cookie. Returns token validity, user ID, and expiration.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                       example: true
 *                     userId:
 *                       type: string
 *                     exp:
 *                       type: integer
 *                       description: Token expiration timestamp (Unix epoch)
 *       401:
 *         description: Token is invalid, revoked, or no active session
 */
// GET /api/auth/verify - Verify current token
// Supports both Authorization header and HttpOnly cookie
router.get(
	"/verify",
	asyncHandler(async (req: Request, res: Response) => {
		// Try to get token from Authorization header first, then from cookie
		const authHeader = req.headers.authorization;
		const cookieToken = req.cookies?.auth_token;

		const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : cookieToken;

		if (!token) {
			throw new UnauthorizedError("No token provided");
		}

		// Verify token
		try {
			const payload = jwtUtils.verifyToken(token);

			// Check if token is blacklisted
			const isBlacklisted = await isTokenBlacklisted(token);

			if (isBlacklisted) {
				throw new UnauthorizedError("Token has been revoked");
			}

			// Check if session is still active
			const sessions = await prisma.session.findMany({
				where: { userId: payload.userId, isActive: true },
			});

			if (sessions.length === 0) {
				throw new UnauthorizedError("No active session");
			}

			return success(res, {
				valid: true,
				userId: payload.userId,
				exp: payload.exp,
			});
		} catch (error) {
			if (error instanceof UnauthorizedError) {
				throw error;
			}
			throw new UnauthorizedError("Invalid token");
		}
	}),
);

/**
 * @openapi
 * /api/auth/csrf-token:
 *   get:
 *     tags: [Authentication]
 *     summary: Get CSRF token
 *     description: Generates and returns a CSRF token. The token is also set as an HttpOnly cookie for double-submit pattern.
 *     responses:
 *       200:
 *         description: CSRF token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     csrfToken:
 *                       type: string
 *                     token:
 *                       type: string
 */
// GET /api/auth/csrf-token - Get CSRF token for form submissions
// Returns a token that should be included in the x-csrf-token header for state-changing requests
router.get(
	"/csrf-token",
	asyncHandler(async (_req: Request, res: Response) => {
		// Generate a random CSRF token
		const crypto = require("node:crypto");
		const token = crypto.randomBytes(32).toString("hex");

		// Set the token as an httpOnly cookie for additional security
		res.cookie("csrf_token", token, {
			httpOnly: true,
			secure: config.server.nodeEnv === "production",
			sameSite: "strict",
			maxAge: 3600000, // 1 hour
		});

		// Also return the token in the response body for client-side use
		return success(res, {
			csrfToken: token,
			token: token, // Frontend checks for both field names
		});
	}),
);

export { router as authRouter };
