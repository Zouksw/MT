/**
 * Authentication business logic.
 *
 * Pure service layer for auth flows: registration, credential verification,
 * session creation/rotation/invalidation, password change, and token
 * verification. Functions take a plain {@link RequestCtx} (ipAddress /
 * userAgent) instead of an Express `Request`, so they are unit-testable
 * without an HTTP layer. Routes in `routes/auth.ts` own the HTTP boundary
 * (parsing, cookies, response shaping) and delegate here.
 */

import bcrypt from "bcryptjs";
import { config, jwtUtils, prisma } from "@/lib";
import { MS_PER_DAY } from "@/lib/constants";
import { logger } from "@/lib/logger.js";
import {
	ConflictError,
	NotFoundError,
	UnauthorizedError,
} from "@/middleware/errorHandler";
import {
	recordFailedLogin,
} from "@/services/authLockout";
import { blacklistToken, isTokenBlacklisted } from "@/services/tokenBlacklist";

/** Minimal request context extracted by the route layer from `req`. */
export interface RequestCtx {
	ipAddress: string | undefined;
	userAgent: string | undefined;
}

export type AuditAction =
	| "CREATE"
	| "READ"
	| "UPDATE"
	| "DELETE"
	| "EXPORT"
	| "LOGIN";

/** Tokens issued when a session is created or rotated. */
export interface AuthTokens {
	token: string;
	refreshToken: string;
	sessionId: string;
}

/** Public user shape returned by register/login. */
export interface PublicUser {
	id: string;
	email: string;
	name: string;
	role: string;
	avatarUrl: string | null;
}

/**
 * Resolve a Bearer token to a userId, rejecting blacklisted or unverified
 * tokens. Returns null (does not throw) so routes can map it to 401.
 */
export async function getUserIdFromToken(
	authHeader: string | undefined,
): Promise<string | null> {
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

/**
 * Verify an access token (from header or cookie) and confirm it has a live
 * session. Throws UnauthorizedError on any failure.
 */
export async function verifyTokenSession(token: string): Promise<{
	userId: string;
	exp: number;
}> {
	try {
		const payload = jwtUtils.verifyToken(token);
		if (await isTokenBlacklisted(token)) {
			throw new UnauthorizedError("Token has been revoked");
		}
		const sessions = await prisma.session.findMany({
			where: { userId: payload.userId, isActive: true },
		});
		if (sessions.length === 0) {
			throw new UnauthorizedError("No active session");
		}
		return { userId: payload.userId, exp: payload.exp ?? 0 };
	} catch (error) {
		if (error instanceof UnauthorizedError) throw error;
		throw new UnauthorizedError("Invalid token");
	}
}

/**
 * Register a new user (role EDITOR). Throws ConflictError on duplicate email.
 * Does NOT create a session — the route calls createAuthSession afterwards.
 */
export async function registerUser(input: {
	email: string;
	password: string;
	name?: string;
}): Promise<PublicUser> {
	const existing = await prisma.user.findUnique({
		where: { email: input.email },
	});
	if (existing) throw new ConflictError("Email already registered");

	const passwordHash = await bcrypt.hash(input.password, 12);
	const user = await prisma.user.create({
		data: {
			email: input.email,
			passwordHash,
			name: input.name || input.email.split("@")[0],
			role: "EDITOR",
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
	return user;
}

/**
 * Verify email + password. On failure, records the failed attempt (which may
 * trip the account lockout) and throws UnauthorizedError. On success returns
 * the full user row (with passwordHash) so the caller can drive session logic.
 *
 * Note: recordFailedLogin may throw in production when Redis is down (the
 * lockout service fails closed) — that is intentional and propagates as a 500.
 */
export async function verifyCredentials(
	email: string,
	password: string,
	ipAddress: string,
): Promise<{ id: string; email: string; name: string; role: string; avatarUrl: string | null; passwordHash: string }> {
	const user = await prisma.user.findUnique({ where: { email } });
	if (!user) {
		await recordFailedLogin(email, ipAddress);
		throw new UnauthorizedError("Invalid email or password");
	}
	const isValid = await bcrypt.compare(password, user.passwordHash);
	if (!isValid) {
		await recordFailedLogin(email, ipAddress);
		throw new UnauthorizedError("Invalid email or password");
	}
	return user;
}

/**
 * Generate an access + refresh token pair and persist a session row.
 * Returns the created sessionId so callers (login/register) can surface it
 * without re-querying — re-querying "newest active session" races under
 * concurrent logins and can return another device's session.
 *
 * The session TTL is config.session.expiresDays, which must match the TTL
 * baked into the refresh-token JWT; do not reintroduce a hardcoded 7 days.
 */
export async function createAuthSession(
	userId: string,
	ctx: RequestCtx,
): Promise<AuthTokens> {
	const token = jwtUtils.generateToken(userId);
	const refreshToken = jwtUtils.generateRefreshToken(userId);
	const session = await prisma.session.create({
		data: {
			userId,
			tokenHash: await bcrypt.hash(refreshToken, 12),
			expiresAt: new Date(Date.now() + config.session.expiresDays * MS_PER_DAY),
			ipAddress: ctx.ipAddress,
			userAgent: ctx.userAgent,
		},
	});
	return { token, refreshToken, sessionId: session.id };
}

/**
 * Rotate a refresh token: verify it, match it to a live session, deactivate
 * that session, and issue a fresh token pair via createAuthSession. Reuses
 * createAuthSession so the TTL and hashing stay consistent.
 */
export async function rotateRefreshToken(
	refreshToken: string,
	ctx: RequestCtx,
): Promise<AuthTokens> {
	let userId: string;
	try {
		const payload = jwtUtils.verifyRefreshToken(refreshToken);
		userId = payload.userId;
	} catch (error) {
		logger.warn("[AUTH] Refresh token verification failed", error);
		throw new UnauthorizedError("Invalid refresh token");
	}

	const sessions = await prisma.session.findMany({
		where: { userId, isActive: true },
	});

	let matchedId: string | null = null;
	for (const s of sessions) {
		if (await bcrypt.compare(refreshToken, s.tokenHash)) {
			matchedId = s.id;
			break;
		}
	}
	if (!matchedId) throw new UnauthorizedError("Invalid session");

	await prisma.session.update({
		where: { id: matchedId },
		data: { isActive: false },
	});

	return createAuthSession(userId, ctx);
}

/**
 * Invalidate sessions on logout. If a refresh token is provided, only the
 * matching session is deactivated; otherwise all of the user's sessions are.
 * Also blacklists the supplied access token.
 */
export async function invalidateSession(
	userId: string,
	accessToken: string | null,
	refreshToken?: string,
): Promise<void> {
	if (accessToken) await blacklistToken(accessToken, "logout");

	if (refreshToken) {
		const sessions = await prisma.session.findMany({
			where: { userId, isActive: true },
		});
		for (const s of sessions) {
			if (await bcrypt.compare(refreshToken, s.tokenHash)) {
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
}

/** Deactivate every session for a user (used after password change). */
export async function invalidateAllSessions(userId: string): Promise<void> {
	await prisma.session.updateMany({
		where: { userId },
		data: { isActive: false },
	});
}

/**
 * Change a user's password: verify the current one, hash the new one, blacklist
 * the access token, update the hash, then invalidate all sessions (forcing a
 * fresh login everywhere).
 */
export async function changePassword(
	userId: string,
	currentPassword: string,
	newPassword: string,
	accessToken: string | null,
): Promise<void> {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) throw new NotFoundError("User");

	const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
	if (!isValid) throw new UnauthorizedError("Current password is incorrect");

	const passwordHash = await bcrypt.hash(newPassword, 12);
	if (accessToken) await blacklistToken(accessToken, "password_change");
	await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
	await invalidateAllSessions(userId);
}

/** Fetch the profile shown by GET /me (includes dataset/model counts). */
export async function getUserProfile(userId: string) {
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
			_count: { select: { datasets: true, models: true } },
		},
	});
	if (!user) throw new NotFoundError("User");
	return user;
}

/** Update editable profile fields. Only provided fields are written. */
export async function updateUserProfile(
	userId: string,
	data: { name?: string; avatarUrl?: string; preferences?: Record<string, unknown> },
) {
	return prisma.user.update({
		where: { id: userId },
		data: data as unknown as Parameters<typeof prisma.user.update>[0]["data"],
		select: {
			id: true,
			email: true,
			name: true,
			role: true,
			avatarUrl: true,
			preferences: true,
		},
	});
}

/**
 * Write an audit log row. Best-effort: failures are logged but never thrown,
 * so an audit-write problem can't fail a user-facing request.
 */
export async function writeAuditLog(
	userId: string,
	resourceType: string,
	action: AuditAction,
	ctx: RequestCtx,
): Promise<void> {
	await prisma.auditLog
		.create({
			data: {
				userId,
				resourceType,
				resourceId: userId,
				action,
				ipAddress: ctx.ipAddress,
				userAgent: ctx.userAgent,
				success: true,
			},
		})
		.catch((err) => logger.warn("Audit log write failed:", err));
}
