import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { config, prisma } from "@/lib";
import { MS_PER_DAY } from "@/lib/constants";
import { success, successWithMessage } from "@/lib/response";
import {
	asyncHandler,
	BadRequestError,
	TooManyRequestsError,
	UnauthorizedError,
} from "@/middleware/errorHandler";
import { authRateLimiter, registrationRateLimiter } from "@/middleware/rateLimiter";
import { validate, validationSchemas } from "@/middleware/security";
import {
	checkAccountLockout,
	clearFailedLoginAttempts,
	formatLockoutTime,
} from "@/services/authLockout";
import {
	type RequestCtx,
	changePassword,
	createAuthSession,
	getUserProfile,
	getUserIdFromToken,
	invalidateSession,
	registerUser,
	rotateRefreshToken,
	updateUserProfile,
	verifyCredentials,
	verifyTokenSession,
	writeAuditLog,
} from "@/services/authService";

const router = Router();

// Validation schemas (HTTP boundary — stay in the route)
const registerSchema = z.object({
	email: validationSchemas.email,
	password: validationSchemas.password,
	name: z.string().min(0, "Name (optional)").max(255).optional(),
});

const loginSchema = z.object({
	email: validationSchemas.email,
	password: z.string().min(1, "Password is required"),
});

const updateSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	avatarUrl: z.string().url().optional(),
	preferences: z.record(z.unknown()).optional(),
});

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: validationSchemas.password,
});

// Helper: Build auth cookie options (HTTP boundary — stays in the route)
function authCookieOptions(req: Request) {
	return {
		httpOnly: true,
		secure: req.secure,
		sameSite: "strict" as const,
		maxAge: config.session.expiresDays * MS_PER_DAY,
		path: "/",
	};
}

// Extract the plain request context the service layer expects.
function reqCtx(req: Request): RequestCtx {
	return { ipAddress: req.ip, userAgent: req.get("user-agent") };
}

function bearerToken(authHeader: string | undefined): string | null {
	return authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
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

		const user = await registerUser({
			email: validatedData.email,
			password: validatedData.password,
			name: validatedData.name,
		});

		const { token, refreshToken } = await createAuthSession(user.id, reqCtx(req));
		await writeAuditLog(user.id, "User", "CREATE", reqCtx(req));

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

			const user = await verifyCredentials(
				validatedData.email,
				validatedData.password,
				req.ip ?? "unknown",
			);

			// Credentials valid — clear any prior failed-attempt counters.
			await clearFailedLoginAttempts(validatedData.email);

		const { token, refreshToken, sessionId } = await createAuthSession(user.id, reqCtx(req));

		await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
		await writeAuditLog(user.id, "User", "LOGIN", reqCtx(req));

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

		const { refreshToken: bodyRefreshToken } = req.body || {};
		await invalidateSession(userId, bearerToken(authHeader), bodyRefreshToken);

		// Clear auth cookie
		res.clearCookie("auth_token", {
			path: "/",
			httpOnly: true,
			secure: req.secure,
			sameSite: "strict",
		});

		await writeAuditLog(userId, "Session", "DELETE", reqCtx(req));

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

		const { token: newToken, refreshToken: newRefreshToken } = await rotateRefreshToken(
			refreshToken,
			reqCtx(req),
		);

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
		if (!userId) throw new UnauthorizedError("Invalid token");

		const user = await getUserProfile(userId);
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
		if (!userId) throw new UnauthorizedError("Invalid token");

		const validatedData = updateSchema.parse(req.body);

		const updateData: {
			name?: string;
			avatarUrl?: string;
			preferences?: Record<string, unknown>;
		} = {};
		if (validatedData.name !== undefined) updateData.name = validatedData.name;
		if (validatedData.avatarUrl !== undefined) updateData.avatarUrl = validatedData.avatarUrl;
		if (validatedData.preferences !== undefined)
			updateData.preferences = validatedData.preferences;

		const user = await updateUserProfile(userId, updateData);
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
		if (!userId) throw new UnauthorizedError("Invalid token");

		const validatedData = changePasswordSchema.parse(req.body);

		await changePassword(
			userId,
			validatedData.currentPassword,
			validatedData.newPassword,
			bearerToken(authHeader),
		);
		await writeAuditLog(userId, "User", "UPDATE", reqCtx(req));

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
		const authHeader = req.headers.authorization;
		const cookieToken = req.cookies?.auth_token;
		const token = bearerToken(authHeader) ?? cookieToken;

		if (!token) throw new UnauthorizedError("No token provided");

		const { userId, exp } = await verifyTokenSession(token);
		return success(res, { valid: true, userId, exp });
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
