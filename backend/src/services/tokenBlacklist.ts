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

import { redis } from '@/lib/redis';
import { jwtUtils } from '@/lib/jwt';
import { logger } from '@/lib/logger';

// Blacklist key prefix
const BLACKLIST_PREFIX = 'token:blacklist:';
const BLACKLIST_SET = 'token:blacklist:all';

/**
 * Add a token to the blacklist
 *
 * @param token - JWT token to blacklist
 * @param reason - Reason for blacklisting
 * @returns Promise<boolean> - true if successfully added
 */
export async function blacklistToken(
  token: string,
  reason: string = 'logout'
): Promise<boolean> {
  try {
    // Decode token without verification to get expiration
    const decoded = jwtUtils.decodeToken(token) as { exp?: number };
    const ttl = decoded?.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : 86400; // Default 24 hours if no exp

    if (ttl <= 0) {
      logger.debug(`Token ${token.slice(0, 20)}... already expired, not blacklisting`);
      return false;
    }

    // Get token jti or use hash as identifier
    const tokenId = extractTokenId(token);

    // Add to blacklist with TTL matching token expiration
    await (await redis()).setEx(`${BLACKLIST_PREFIX}${tokenId}`, ttl, JSON.stringify({
      reason,
      blacklistedAt: new Date().toISOString(),
      expiresAt: new Date((decoded?.exp || 0) * 1000).toISOString(),
    }));

    // Also add to a set for O(1) lookup
    await (await redis()).sAdd(BLACKLIST_SET, tokenId);
    await (await redis()).expireAt(BLACKLIST_SET, decoded?.exp || Math.floor(Date.now() / 1000) + 86400);

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

    // Check Redis set for O(1) lookup
    const exists = await (await redis()).sIsMember(BLACKLIST_SET, tokenId);
    return exists;
  } catch (error) {
    logger.error(`[SECURITY] Failed to check token blacklist: ${error}`);

    // Fail-closed in production, fail-open in development
    if (process.env.NODE_ENV === 'production') {
      // In production, assume token MIGHT be blacklisted if we can't check
      // This is more secure but may cause false positives
      logger.error('[SECURITY] Redis unavailable - assuming token may be blacklisted (fail-closed)');
      return true;
    } else {
      // In development, allow token for easier debugging
      logger.warn('[DEV] Redis unavailable - allowing token (fail-open for development)');
      return false;
    }
  }
}

/**
 * Blacklist all tokens for a user
 *
 * @param userId - User ID to blacklist tokens for
 * @param reason - Reason for blacklisting
 * @param excludeToken - Optional token to exclude (e.g., current session)
 */
export async function blacklistUserTokens(
  userId: string,
  reason: string = 'security',
  _excludeToken?: string
): Promise<number> {
  try {
    // Note: This requires sessions to be tracked
    // Implementation depends on how you store active tokens/sessions
    // For now, this is a placeholder that would need to be integrated
    // with your session management

    logger.info(`Blacklisting all user tokens for ${userId} (${reason})`);

    // Placeholder: In a real implementation, you would:
    // 1. Query all active sessions/tokens for the user
    // 2. Add each token to the blacklist
    // 3. Optionally invalidate sessions in the database

    return 0; // Return count of blacklisted tokens
  } catch (error) {
    logger.error(`Failed to blacklist user tokens for ${userId}: ${error}`);
    return 0;
  }
}

/**
 * Remove a token from the blacklist (for testing/admin use)
 *
 * @param token - JWT token to remove from blacklist
 */
export async function removeFromBlacklist(token: string): Promise<boolean> {
  try {
    const tokenId = extractTokenId(token);
    await (await redis()).del(`${BLACKLIST_PREFIX}${tokenId}`);
    await (await redis()).sRem(BLACKLIST_SET, tokenId);

    logger.info(`Token ${tokenId.slice(0, 20)}... removed from blacklist`);
    return true;
  } catch (error) {
    logger.error(`Failed to remove token from blacklist: ${error}`);
    return false;
  }
}

/**
 * Get blacklist statistics
 */
export async function getBlacklistStats(): Promise<{
  totalBlacklisted: number;
  oldestToken: Date | null;
  newestToken: Date | null;
}> {
  try {
    const totalBlacklisted = await (await redis()).sCard(BLACKLIST_SET);

    if (totalBlacklisted === 0) {
      return { totalBlacklisted, oldestToken: null, newestToken: null };
    }

    // For simplicity, just return the count without detailed timestamp analysis
    // Timestamp analysis would require iterating through all tokens which is expensive
    return { totalBlacklisted, oldestToken: null, newestToken: null };
  } catch (error) {
    logger.error(`Failed to get blacklist stats: ${error}`);
    return { totalBlacklisted: 0, oldestToken: null, newestToken: null };
  }
}

/**
 * Clear the entire blacklist (admin function)
 */
export async function clearBlacklist(): Promise<boolean> {
  try {
    // Get all blacklisted tokens
    const tokens = await (await redis()).sMembers(BLACKLIST_SET);

    // Remove each token using multi for atomicity
    const client = await redis();
    const multi = client.multi();
    for (const tokenId of tokens) {
      multi.del(`${BLACKLIST_PREFIX}${tokenId}`);
    }
    multi.del(BLACKLIST_SET);

    await multi.exec();

    logger.info(`Cleared token blacklist (${tokens.length} tokens)`);
    return true;
  } catch (error) {
    logger.error(`Failed to clear blacklist: ${error}`);
    return false;
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
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  } catch {
    // Final fallback to first 32 chars
    return token.slice(0, 32);
  }
}

/**
 * Middleware to check if token is blacklisted
 */
export async function checkTokenBlacklist(token: string): Promise<void> {
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    throw new Error('Token has been revoked');
  }
}
