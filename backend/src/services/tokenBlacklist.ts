/**
 * JWT Token Blacklist Service
 *
 * Provides token revocation by maintaining a blacklist of invalidated tokens.
 * Uses Redis for performance and automatic expiration.
 *
 * Tokens are added to the blacklist when:
 * - User explicitly logs out
 * - Password is changed
 * - Admin revokes a user's sessions
 * - Security incident requires token invalidation
 */

import { jwtUtils } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

// Blacklist key prefix
const BLACKLIST_PREFIX = "token:blacklist:";
const BLACKLIST_SET = "token:blacklist:all";

/**
 * Add a token to the blacklist
 *
 * @param token - JWT token to blacklist
 * @param reason - Reason for blacklisting
 * @returns Promise<boolean> - true if successfully added
 */
export async function blacklistToken(token: string, reason: string = "logout"): Promise<boolean> {
	try {
		// Decode token without verification to get expiration
		const decoded = jwtUtils.decodeToken(token) as { exp?: number };
		const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400; // Default 24 hours if no exp

		if (ttl <= 0) {
			logger.debug(`Token ${token.slice(0, 20)}... already expired, not blacklisting`);
			return false;
		}

		// Get token jti or use hash as identifier
		const tokenId = extractTokenId(token);
		const client = await redis();

		// Source of truth: the per-token key, TTL'd to the token's own exp.
		await client.setEx(
			`${BLACKLIST_PREFIX}${tokenId}`,
			ttl,
			JSON.stringify({
				reason,
				blacklistedAt: new Date().toISOString(),
				expiresAt: new Date((decoded?.exp || 0) * 1000).toISOString(),
			}),
		);

		// Stats/compat set membership. Its TTL may only ever EXTEND — the old
		// code reset expireAt to each revoked token's exp, so revoking a
		// 1-hour token evicted the whole set and resurrected every
		// longer-lived revoked token (audit round-104).
		await client.sAdd(BLACKLIST_SET, tokenId);
		const setTtl = await client.ttl(BLACKLIST_SET);
		if (setTtl < ttl) {
			await client.expire(BLACKLIST_SET, ttl);
		}

		logger.info(`Token ${tokenId.slice(0, 20)}... added to blacklist (${reason}, ${ttl}s TTL)`);

		return true;
	} catch (error) {
		logger.error(`Failed to blacklist token: ${error}`);
		return false;
	}
}

/**
 * Check if a token is blacklisted
 *
 * @param token - JWT token to check
 * @returns Promise<boolean> - true if token is blacklisted
 *
 * SECURITY POLICY:
 * - In production: Fail-CLOSED (deny access if Redis is down)
 * - In development: Fail-OPEN (allow access for debugging)
 *
 * This prevents revoked tokens from being used when Redis is unavailable.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
	try {
		const tokenId = extractTokenId(token);
		const client = await redis();

		// Source of truth: per-token key with TTL matching the token's own
		// expiration. Survives revocations of OTHER tokens regardless of
		// their lifetimes.
		const perToken = await client.exists(`${BLACKLIST_PREFIX}${tokenId}`);
		if (perToken) return true;

		// Legacy fallback for entries whose per-token key already TTL'd out
		// while the shared set still lists them: the token is past its own
		// exp there, so JWT verification rejects it right after this check
		// either way — this branch can only affect already-expired tokens.
		return client.sIsMember(BLACKLIST_SET, tokenId);
	} catch (error) {
		logger.error(`[SECURITY] Failed to check token blacklist: ${error}`);

		// Fail-closed in production, fail-open in development
		if (process.env.NODE_ENV === "production") {
			// In production, assume token MIGHT be blacklisted if we can't check
			// This is more secure but may cause false positives
			logger.error(
				"[SECURITY] Redis unavailable - assuming token may be blacklisted (fail-closed)",
			);
			return true;
		} else {
			// In development, allow token for easier debugging
			logger.warn("[DEV] Redis unavailable - allowing token (fail-open for development)");
			return false;
		}
	}
}

/**
 * Extract a unique identifier from a JWT token
 */
function extractTokenId(token: string): string {
	try {
		// Try to get jti from token payload
		const decoded = jwtUtils.decodeToken(token) as { jti?: string };
		if (decoded?.jti) {
			return decoded.jti;
		}

		// Fallback to hash of the token itself
		// Using a simple hash for identification (not cryptographic)
		let hash = 0;
		for (let i = 0; i < token.length; i++) {
			const char = token.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash).toString(36);
	} catch (error) {
		logger.warn("[AUTH] Token ID extraction failed, using raw token prefix", error);
		return token.slice(0, 32);
	}
}
