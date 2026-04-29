/**
 * Tests for authLockout service
 * Tests account lockout functionality for brute force protection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkAccountLockout,
  recordFailedLogin,
  clearFailedLoginAttempts,
  formatLockoutTime,
} from '@/services/authLockout';
import { redis } from '@/lib/redis';

// Mock Redis
vi.mock('@/lib/redis');

describe('authLockout service', () => {
  const mockRedis = {
    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ttl: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the redis() function to return the mockRedis client
    (redis as vi.MockedFunction<typeof redis>).mockResolvedValue(mockRedis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordFailedLogin', () => {
    it('should increment failed login attempts', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await recordFailedLogin('user@example.com', '127.0.0.1');

      expect(mockRedis.incr).toHaveBeenCalledWith('auth:attempts:user@example.com');
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'auth:attempts:user@example.com',
        900
      );
    });

    it('should set lockout after MAX_ATTEMPTS failed attempts', async () => {
      // Simulate 5th failed attempt
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.set.mockResolvedValue('OK');

      await recordFailedLogin('user@example.com', '127.0.0.1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'auth:lockout:user@example.com',
        '1',
        { EX: 900 }
      );
    });

    it('should handle Redis errors gracefully in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        recordFailedLogin('user@example.com', '127.0.0.1')
      ).rejects.toThrow('Unable to process login attempt due to system error');

      process.env.NODE_ENV = originalEnv;
    });

    it('should not throw in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw in development
      await recordFailedLogin('user@example.com', '127.0.0.1');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('checkAccountLockout', () => {
    it('should return lockout info when account is not locked', async () => {
      // TTL of -2 means key doesn't exist (not locked)
      mockRedis.ttl.mockResolvedValue(-2);
      mockRedis.get.mockResolvedValue(null);

      const result = await checkAccountLockout('user@example.com');

      expect(result).toEqual({
        isLocked: false,
        remainingAttempts: 5,
      });
      expect(mockRedis.ttl).toHaveBeenCalledWith('auth:lockout:user@example.com');
    });

    it('should return lockout info when account is locked', async () => {
      // TTL > 0 means lockout is active (e.g., 500 seconds remaining)
      mockRedis.ttl.mockResolvedValue(500);

      const result = await checkAccountLockout('user@example.com');

      expect(result.isLocked).toBe(true);
      expect(result.lockoutUntil).toBeInstanceOf(Date);
      expect(result.remainingAttempts).toBe(0);
    });

    it('should return lockout info with remaining attempts', async () => {
      // Not locked (TTL = -2)
      mockRedis.ttl.mockResolvedValue(-2);
      // 2 failed attempts
      mockRedis.get.mockResolvedValue('2');

      const result = await checkAccountLockout('user@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.remainingAttempts).toBe(3); // 5 - 2 = 3
    });

    it('should fail-closed when Redis errors occur', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis connection failed'));

      const result = await checkAccountLockout('user@example.com');

      // Fail-closed: assume locked when Redis is down
      expect(result.isLocked).toBe(true);
      expect(result.remainingAttempts).toBe(0);
    });
  });

  describe('clearFailedLoginAttempts', () => {
    it('should delete failed attempts counter', async () => {
      mockRedis.del.mockResolvedValue(1);

      await clearFailedLoginAttempts('user@example.com');

      expect(mockRedis.del).toHaveBeenCalledWith('auth:attempts:user@example.com');
    });

    it('should handle errors gracefully but not throw in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        clearFailedLoginAttempts('user@example.com')
      ).rejects.toThrow('Unable to clear login state due to system error');

      process.env.NODE_ENV = originalEnv;
    });

    it('should not throw in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw in development
      await clearFailedLoginAttempts('user@example.com');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('formatLockoutTime', () => {
    it('should format lockout time as readable string', () => {
      const date = new Date(Date.now() + 300000); // 5 minutes from now
      const result = formatLockoutTime(date);
      expect(result).toContain('minutes');
    });

    it('should return singular minute for 1 minute', () => {
      const date = new Date(Date.now() + 60000); // 1 minute from now
      const result = formatLockoutTime(date);
      expect(result).toBe('1 minute');
    });

    it('should return plural minutes for more than 1 minute', () => {
      const date = new Date(Date.now() + 120000); // 2 minutes from now
      const result = formatLockoutTime(date);
      expect(result).toBe('2 minutes');
    });
  });

  describe('integration scenarios', () => {
    it('should handle full lockout flow', async () => {
      // First failed attempt
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      await recordFailedLogin('user@example.com', '127.0.0.1');

      // Check lockout status - not locked, 4 attempts remaining
      mockRedis.ttl.mockResolvedValueOnce(-2); // No lockout
      mockRedis.get.mockResolvedValueOnce('1'); // 1 attempt
      let lockInfo = await checkAccountLockout('user@example.com');
      expect(lockInfo.isLocked).toBe(false);
      expect(lockInfo.remainingAttempts).toBe(4);

      // Fifth failed attempt
      mockRedis.incr.mockResolvedValueOnce(5);
      mockRedis.set.mockResolvedValueOnce('OK');
      await recordFailedLogin('user@example.com', '127.0.0.1');

      // Check lockout status after 5 attempts - now locked
      mockRedis.ttl.mockResolvedValueOnce(900); // 15 minutes (900 seconds) remaining
      lockInfo = await checkAccountLockout('user@example.com');
      expect(lockInfo.isLocked).toBe(true);
      expect(lockInfo.lockoutUntil).toBeDefined();
    });

    it('should reset after successful login', async () => {
      // After successful login, clear attempts
      mockRedis.del.mockResolvedValue(1);
      await clearFailedLoginAttempts('user@example.com');

      // Check that lockout is cleared
      mockRedis.ttl.mockResolvedValueOnce(-2); // No lockout
      mockRedis.get.mockResolvedValueOnce(null); // No attempts
      const lockInfo = await checkAccountLockout('user@example.com');
      expect(lockInfo.isLocked).toBe(false);
      expect(lockInfo.remainingAttempts).toBe(5);
    });
  });
});
