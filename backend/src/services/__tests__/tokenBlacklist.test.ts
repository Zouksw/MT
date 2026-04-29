import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  blacklistToken,
  isTokenBlacklisted,
  blacklistUserTokens,
  removeFromBlacklist,
  getBlacklistStats,
  clearBlacklist,
  checkTokenBlacklist,
} from '@/services/tokenBlacklist';

const {
  mockRedisSetEx,
  mockRedisSAdd,
  mockRedisExpireAt,
  mockRedisSIsMember,
  mockRedisSDel,
  mockRedisSRem,
  mockRedisSMembers,
  mockRedisSCard,
  mockRedisMulti,
  mockDecodeToken,
  mockRedisClient,
} = vi.hoisted(() => {
  const setEx = vi.fn().mockResolvedValue(undefined);
  const sAdd = vi.fn().mockResolvedValue(undefined);
  const expireAt = vi.fn().mockResolvedValue(undefined);
  const sIsMember = vi.fn();
  const del = vi.fn().mockResolvedValue(undefined);
  const sRem = vi.fn().mockResolvedValue(undefined);
  const sMembers = vi.fn();
  const sCard = vi.fn();
  const multi = vi.fn();
  const decodeToken = vi.fn();
  const client = { setEx, sAdd, expireAt, sIsMember, del, sRem, sMembers, sCard, multi };
  return {
    mockRedisSetEx: setEx,
    mockRedisSAdd: sAdd,
    mockRedisExpireAt: expireAt,
    mockRedisSIsMember: sIsMember,
    mockRedisSDel: del,
    mockRedisSRem: sRem,
    mockRedisSMembers: sMembers,
    mockRedisSCard: sCard,
    mockRedisMulti: multi,
    mockDecodeToken: decodeToken,
    mockRedisClient: client,
  };
});

vi.mock('@/lib/redis', () => ({
  redis: vi.fn(() => Promise.resolve(mockRedisClient)),
}));

vi.mock('@/lib/jwt', () => ({
  jwtUtils: {
    decodeToken: (...args: any[]) => mockDecodeToken(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('tokenBlacklist service', () => {
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
  const testTokenId = 'test-token-id-123';

  beforeEach(() => {
    vi.clearAllMocks();
    const multiMock = {
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(undefined),
    };
    mockRedisMulti.mockReturnValue(multiMock as any);
  });

  describe('blacklistToken', () => {
    it('should blacklist a valid token', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      mockDecodeToken.mockReturnValue({ exp: futureExp, jti: testTokenId });

      const result = await blacklistToken(testToken, 'logout');

      expect(result).toBe(true);
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        `token:blacklist:${testTokenId}`,
        expect.any(Number),
        expect.stringContaining('logout'),
      );
      expect(mockRedisSAdd).toHaveBeenCalledWith('token:blacklist:all', testTokenId);
    });

    it('should not blacklist an already expired token', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      mockDecodeToken.mockReturnValue({ exp: pastExp, jti: testTokenId });

      const result = await blacklistToken(testToken, 'logout');

      expect(result).toBe(false);
      expect(mockRedisSetEx).not.toHaveBeenCalled();
    });

    it('should use default TTL when token has no expiration', async () => {
      mockDecodeToken.mockReturnValue({ jti: testTokenId });

      const result = await blacklistToken(testToken, 'logout');

      expect(result).toBe(true);
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        `token:blacklist:${testTokenId}`,
        86400,
        expect.any(String),
      );
    });

    it('should use hash as token ID when jti is not present', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      mockDecodeToken.mockReturnValue({ exp: futureExp });

      const result = await blacklistToken(testToken, 'password_change');

      expect(result).toBe(true);
      expect(mockRedisSetEx).toHaveBeenCalled();
      expect(mockRedisSAdd).toHaveBeenCalledWith('token:blacklist:all', expect.any(String));
    });

    it('should handle errors gracefully', async () => {
      mockDecodeToken.mockImplementation(() => { throw new Error('Decode error'); });

      const result = await blacklistToken(testToken, 'logout');
      expect(result).toBe(false);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      mockRedisSIsMember.mockResolvedValue(true);
      expect(await isTokenBlacklisted(testToken)).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      mockRedisSIsMember.mockResolvedValue(false);
      expect(await isTokenBlacklisted(testToken)).toBe(false);
    });

    it('should fail open on Redis error', async () => {
      mockRedisSIsMember.mockRejectedValue(new Error('Redis error'));
      expect(await isTokenBlacklisted(testToken)).toBe(false);
    });

    it('should fail closed on Redis error in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockRedisSIsMember.mockRejectedValue(new Error('Redis error'));

      expect(await isTokenBlacklisted(testToken)).toBe(true);
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('blacklistUserTokens', () => {
    it('should return 0 (placeholder implementation)', async () => {
      expect(await blacklistUserTokens('user-123', 'security')).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockDecodeToken.mockImplementation(() => { throw new Error('Decode error'); });
      expect(await blacklistUserTokens('user-123', 'security')).toBe(0);
    });
  });

  describe('removeFromBlacklist', () => {
    it('should remove token from blacklist', async () => {
      mockDecodeToken.mockReturnValue({ jti: testTokenId });

      expect(await removeFromBlacklist(testToken)).toBe(true);
      expect(mockRedisSDel).toHaveBeenCalledWith(`token:blacklist:${testTokenId}`);
      expect(mockRedisSRem).toHaveBeenCalledWith('token:blacklist:all', testTokenId);
    });

    it('should handle errors gracefully', async () => {
      mockDecodeToken.mockReturnValue({ jti: testTokenId });
      mockRedisSDel.mockRejectedValue(new Error('Redis error'));

      expect(await removeFromBlacklist(testToken)).toBe(false);
    });
  });

  describe('getBlacklistStats', () => {
    it('should return stats when blacklist has tokens', async () => {
      mockRedisSCard.mockResolvedValue(42);
      expect(await getBlacklistStats()).toEqual({ totalBlacklisted: 42, oldestToken: null, newestToken: null });
    });

    it('should return empty stats when blacklist is empty', async () => {
      mockRedisSCard.mockResolvedValue(0);
      expect(await getBlacklistStats()).toEqual({ totalBlacklisted: 0, oldestToken: null, newestToken: null });
    });

    it('should handle errors gracefully', async () => {
      mockRedisSCard.mockRejectedValue(new Error('Redis error'));
      expect(await getBlacklistStats()).toEqual({ totalBlacklisted: 0, oldestToken: null, newestToken: null });
    });
  });

  describe('clearBlacklist', () => {
    it('should clear all tokens from blacklist', async () => {
      mockRedisSMembers.mockResolvedValue(['token1', 'token2', 'token3'] as any);
      const multiMock = { del: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue(undefined) };
      mockRedisMulti.mockReturnValue(multiMock as any);

      expect(await clearBlacklist()).toBe(true);
      expect(mockRedisSMembers).toHaveBeenCalledWith('token:blacklist:all');
      expect(multiMock.del).toHaveBeenCalledTimes(4);
    });

    it('should handle errors gracefully', async () => {
      mockRedisSMembers.mockRejectedValue(new Error('Redis error'));
      expect(await clearBlacklist()).toBe(false);
    });

    it('should handle empty blacklist', async () => {
      mockRedisSMembers.mockResolvedValue([] as any);
      const multiMock = { del: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue(undefined) };
      mockRedisMulti.mockReturnValue(multiMock as any);

      expect(await clearBlacklist()).toBe(true);
      expect(multiMock.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkTokenBlacklist', () => {
    it('should throw error for blacklisted token', async () => {
      mockRedisSIsMember.mockResolvedValue(true);
      await expect(checkTokenBlacklist(testToken)).rejects.toThrow('Token has been revoked');
    });

    it('should not throw for valid token', async () => {
      mockRedisSIsMember.mockResolvedValue(false);
      await expect(checkTokenBlacklist(testToken)).resolves.toBeUndefined();
    });
  });
});
