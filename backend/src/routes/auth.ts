import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { registrationRateLimiter, authRateLimiter } from '@/middleware/rateLimiter';
import { validate, validationSchemas } from '@/middleware/security';
import { asyncHandler, UnauthorizedError, NotFoundError, BadRequestError, ConflictError } from '@/middleware/errorHandler';
import { prisma, jwtUtils, config } from '@/lib';
import { blacklistToken, isTokenBlacklisted } from '@/services/tokenBlacklist';
import { success, successWithMessage } from '@/lib/response';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: validationSchemas.email,
  password: validationSchemas.password,
  name: z.string().min(0, 'Name (optional)').max(255).optional(),
});

const loginSchema = z.object({
  email: validationSchemas.email,
  password: z.string().min(1, 'Password is required'),
});

// Helper: Get user ID from token
async function getUserIdFromToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    // Check if token is blacklisted (e.g. after logout)
    const { isTokenBlacklisted } = await import('@/services/tokenBlacklist');
    if (await isTokenBlacklisted(token)) {
      return null;
    }
    const payload = jwtUtils.verifyToken(token);
    return payload.userId;
  } catch {
    return null;
  }
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
router.post('/register', registrationRateLimiter, validate(registerSchema), asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: validatedData.email },
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Hash password with 12 rounds for better security (OWASP recommendation)
  const passwordHash = await bcrypt.hash(validatedData.password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: validatedData.email,
      passwordHash,
      name: validatedData.name || validatedData.email.split('@')[0],
      role: 'EDITOR',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const token = jwtUtils.generateToken(user.id);
  const refreshToken = jwtUtils.generateRefreshToken(user.id);

  // Create session
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: await bcrypt.hash(refreshToken, 12),
      expiresAt: new Date(Date.now() + config.session.expiresDays * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  // Log the registration
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      resourceType: 'User',
      resourceId: user.id,
      action: 'CREATE',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: true,
    },
  });

  // Set HttpOnly auth cookie for enhanced security
  const cookieOptions = {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict' as const,
    maxAge: config.session.expiresDays * 24 * 60 * 60 * 1000,
    path: '/',
  };

  // Set the auth token as HttpOnly cookie
  res.cookie('auth_token', token, cookieOptions);

  return success(res, {
    user,
    token,
    refreshToken,
  }, 201);
}));

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
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const validatedData = loginSchema.parse(req.body);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: validatedData.email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(validatedData.password, user.passwordHash);

  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate tokens
  const token = jwtUtils.generateToken(user.id);
  const refreshToken = jwtUtils.generateRefreshToken(user.id);

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: await bcrypt.hash(refreshToken, 12),
      expiresAt: new Date(Date.now() + config.session.expiresDays * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Log successful login
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      resourceType: 'User',
      resourceId: user.id,
      action: 'LOGIN',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: true,
    },
  });

  // Set HttpOnly auth cookie
  const cookieOptions = {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict' as const,
    maxAge: config.session.expiresDays * 24 * 60 * 60 * 1000,
    path: '/',
  };

  res.cookie('auth_token', token, cookieOptions);

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
    sessionId: session.id,
  });
}));

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
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const userId = await getUserIdFromToken(authHeader);

  if (!userId) {
    throw new UnauthorizedError('Invalid token');
  }

  // Extract and blacklist the access token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    await blacklistToken(token, 'logout');
  }

  // Invalidate all sessions for this user
  await prisma.session.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });

  // Clear auth cookie
  res.clearCookie('auth_token', {
    path: '/',
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict',
  });

  // Log logout
  await prisma.auditLog.create({
    data: {
      userId,
      resourceType: 'Session',
      action: 'DELETE',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: true,
    },
  }).catch(() => {});

  return successWithMessage(res, {}, 'Logged out successfully');
}));

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
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new BadRequestError('Refresh token is required');
  }

  let userId: string;
  try {
    const payload = jwtUtils.verifyRefreshToken(refreshToken);
    userId = payload.userId;
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Verify session exists and is active
  const sessions = await prisma.session.findMany({
    where: { userId, isActive: true },
  });

  const isValidSession = await Promise.all(
    sessions.map(s => bcrypt.compare(refreshToken, s.tokenHash))
  ).then(results => results.some(r => r));

  if (!isValidSession) {
    throw new UnauthorizedError('Invalid session');
  }

  // Generate new access token
  const newToken = jwtUtils.generateToken(userId);

  return success(res, { token: newToken });
}));

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
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const userId = await getUserIdFromToken(req.headers.authorization);

  if (!userId) {
    throw new UnauthorizedError('Invalid token');
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
    throw new NotFoundError('User');
  }

  return success(res, { user });
}));

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
router.put('/me', asyncHandler(async (req: Request, res: Response) => {
  const userId = await getUserIdFromToken(req.headers.authorization);

  if (!userId) {
    throw new UnauthorizedError('Invalid token');
  }

  const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    avatarUrl: z.string().url().optional(),
    preferences: z.any().optional(),
  });

  const validatedData = updateSchema.parse(req.body);

  const user = await prisma.user.update({
    where: { id: userId },
    data: validatedData,
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
}));

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
router.post('/change-password', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const userId = await getUserIdFromToken(authHeader);

  if (!userId) {
    throw new UnauthorizedError('Invalid token');
  }

  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  });

  const validatedData = schema.parse(req.body);

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(validatedData.currentPassword, user.passwordHash);

  if (!isValidPassword) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Hash new password with 12 rounds for better security
  const passwordHash = await bcrypt.hash(validatedData.newPassword, 12);

  // Blacklist current token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    await blacklistToken(token, 'password_change');
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

  // Log password change
  await prisma.auditLog.create({
    data: {
      userId,
      resourceType: 'User',
      resourceId: userId,
      action: 'UPDATE',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: true,
    },
  });

  return successWithMessage(res, {}, 'Password changed successfully. Please login again.');
}));

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
router.get('/verify', asyncHandler(async (req: Request, res: Response) => {
  // Try to get token from Authorization header first, then from cookie
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : cookieToken;

  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  // Verify token
  try {
    const payload = jwtUtils.verifyToken(token);

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);

    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Check if session is still active
    const sessions = await prisma.session.findMany({
      where: { userId: payload.userId, isActive: true },
    });

    if (sessions.length === 0) {
      throw new UnauthorizedError('No active session');
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
    throw new UnauthorizedError('Invalid token');
  }
}));

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
router.get('/csrf-token', asyncHandler(async (req: Request, res: Response) => {
  // Generate a random CSRF token
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');

  // Set the token as an httpOnly cookie for additional security
  res.cookie('csrf_token', token, {
    httpOnly: true,
    secure: config.server.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 3600000, // 1 hour
  });

  // Also return the token in the response body for client-side use
  return success(res, {
    csrfToken: token,
    token: token, // Frontend checks for both field names
  });
}));

export { router as authRouter };
