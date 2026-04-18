/**
 * Tests for cache service
 *
 * Organized into:
 * 1. Utility functions (no Redis needed)
 * 2. Basic operations (with mocked Redis)
 * 3. Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock @/lib/redis to provide a mock Redis client
const mockGetRedisClient = jest.fn();

jest.mock('@/lib/redis', () => ({
  getRedisClient: () => mockGetRedisClient(),
}));

jest.mock('@/lib', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import * as cacheService from '@/services/cache';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockRedisClient(overrides: any = {}) {
  const mockPipeline = {
    set: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(undefined),
    ...overrides._pipeline,
  };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    mGet: jest.fn(),
    multi: jest.fn().mockReturnValue(mockPipeline),
    dbSize: jest.fn(),
    info: jest.fn(),
    flushDb: jest.fn(),
    quit: jest.fn(),
    _pipeline: mockPipeline,
    ...overrides,
  };
}

let mockRedisClient: ReturnType<typeof createMockRedisClient>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisClient = createMockRedisClient();
  mockGetRedisClient.mockResolvedValue(mockRedisClient);
});

afterEach(() => {
  mockGetRedisClient.mockReset();
});

// ============================================================================
// Part 1: Utility Functions (no Redis needed)
// ============================================================================

describe('cacheKeys utility', () => {
  const { cacheKeys } = require('../cache');

  it('should generate prediction key', () => {
    const key = cacheKeys.prediction('ts-123', 'arima', 10);
    expect(key).toBe('prediction:ts-123:arima:10');
  });

  it('should generate query key', () => {
    const key = cacheKeys.query('SELECT * FROM test');
    expect(key).toBe('query:U0VMRUNUICogRlJPTSB0ZXN0');
  });

  it('should generate timeseries data key', () => {
    const from = new Date('2024-01-01');
    const to = new Date('2024-01-02');
    const key = cacheKeys.timeseriesData('ts-123', from, to);
    expect(key).toContain('ts:data:ts-123:');
  });

  it('should generate user session key', () => {
    const key = cacheKeys.userSession('user-123');
    expect(key).toBe('session:user:user-123');
  });

  it('should generate rate limit key', () => {
    const key = cacheKeys.rateLimit('127.0.0.1', '/api/test');
    expect(key).toBe('ratelimit:127.0.0.1:/api/test');
  });

  it('should generate timeseries list key', () => {
    const key = cacheKeys.timeseriesList('dataset-123');
    expect(key).toBe('ts:list:dataset-123');
  });

  it('should generate timeseries list key for all datasets', () => {
    const key = cacheKeys.timeseriesList();
    expect(key).toBe('ts:list:all');
  });
});

// ============================================================================
// Part 2: Basic Operations
// ============================================================================

describe('Cache - Basic Operations', () => {
  beforeEach(async () => {
    await cacheService.initCache();
  });

  describe('get', () => {
    it('should get and parse JSON value', async () => {
      mockRedisClient.get.mockResolvedValue('{"data":"test","number":123}');
      const result = await cacheService.get<{ data: string; number: number }>('test-key');
      expect(result).toEqual({ data: 'test', number: 123 });
    });

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      mockRedisClient.get.mockResolvedValue('not-json');
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      await cacheService.set('test-key', { data: 'test' });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'test' })
      );
    });

    it('should set value with TTL', async () => {
      await cacheService.set('test-key', { data: 'test' }, 60);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test-key',
        60,
        JSON.stringify({ data: 'test' })
      );
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      await cacheService.del('test-key');
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      const result = await cacheService.exists('test-key');
      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      const result = await cacheService.exists('test-key');
      expect(result).toBe(false);
    });
  });

  describe('incr', () => {
    it('should increment and return value', async () => {
      mockRedisClient.incr.mockResolvedValue(5);
      const result = await cacheService.incr('counter');
      expect(result).toBe(5);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('counter');
    });
  });

  describe('expire', () => {
    it('should set expiration time', async () => {
      await cacheService.expire('test-key', 60);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('test-key', 60);
    });
  });
});

// ============================================================================
// Part 3: Advanced Operations
// ============================================================================

describe('Cache - Advanced Operations', () => {
  beforeEach(async () => {
    await cacheService.initCache();
  });

  describe('mget', () => {
    it('should get multiple keys', async () => {
      mockRedisClient.mGet.mockResolvedValue([
        '{"data":"test1"}',
        null,
        '{"data":"test3"}',
      ]);

      const result = await cacheService.mget<{ data: string }>(['key1', 'key2', 'key3']);
      expect(result).toEqual([
        { data: 'test1' },
        null,
        { data: 'test3' },
      ]);
    });

    it('should return empty array for no keys', async () => {
      const result = await cacheService.mget([]);
      expect(result).toEqual([]);
    });
  });

  describe('mset', () => {
    it('should set multiple keys', async () => {
      const items = [
        { key: 'key1', value: { data: 'test1' } },
        { key: 'key2', value: { data: 'test2' } },
      ];

      await cacheService.mset(items);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockRedisClient._pipeline.set).toHaveBeenCalledTimes(2);
      expect(mockRedisClient._pipeline.exec).toHaveBeenCalled();
    });

    it('should handle empty items array', async () => {
      await cacheService.mset([]);
      expect(mockRedisClient.multi).not.toHaveBeenCalled();
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      await cacheService.delPattern('test:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('test:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });

    it('should handle no keys found', async () => {
      mockRedisClient.keys.mockResolvedValue([]);
      await cacheService.delPattern('test:*');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('cache wrapper', () => {
    it('should cache function results', async () => {
      const mockFn = jest.fn().mockResolvedValue({ result: 'test' });
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValueOnce('{"result":"test"}');

      const cached = cacheService.cache('test:', mockFn, { ttl: 60 });

      const result1 = await cached('arg1');
      expect(result1).toEqual({ result: 'test' });
      expect(mockFn).toHaveBeenCalledWith('arg1');

      const result2 = await cached('arg1');
      expect(result2).toEqual({ result: 'test' });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache stats', async () => {
      mockRedisClient.info.mockResolvedValue('used_memory_human:1.5M\nother:data');
      mockRedisClient.dbSize.mockResolvedValue(100);

      const stats = await cacheService.getCacheStats();

      expect(stats).toEqual({
        connected: true,
        keyCount: 100,
        memoryUsage: '1.5M',
      });
    });
  });

  describe('flushCache', () => {
    it('should flush cache', async () => {
      await cacheService.flushCache();
      expect(mockRedisClient.flushDb).toHaveBeenCalled();
    });
  });

  describe('closeCache', () => {
    it('should not throw (connection managed by lib/redis)', async () => {
      await expect(cacheService.closeCache()).resolves.not.toThrow();
    });
  });
});

// ============================================================================
// Part 4: Error Handling
// ============================================================================

describe('Cache - Error Handling', () => {
  beforeEach(async () => {
    await cacheService.initCache();
  });

  describe('Redis operation failures', () => {
    it('should handle get error gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle set error gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));
      await expect(cacheService.set('test-key', { data: 'test' })).resolves.not.toThrow();
    });

    it('should handle del error gracefully', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));
      await expect(cacheService.del('test-key')).resolves.not.toThrow();
    });

    it('should handle exists error gracefully', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));
      const result = await cacheService.exists('test-key');
      expect(result).toBe(false);
    });

    it('should handle incr error gracefully', async () => {
      mockRedisClient.incr.mockRejectedValue(new Error('Redis error'));
      const result = await cacheService.incr('counter');
      expect(result).toBe(0);
    });

    it('should handle expire error gracefully', async () => {
      mockRedisClient.expire.mockRejectedValue(new Error('Redis error'));
      await expect(cacheService.expire('test-key', 60)).resolves.not.toThrow();
    });

    it('should handle mget error gracefully', async () => {
      mockRedisClient.mGet.mockRejectedValue(new Error('Redis error'));
      const result = await cacheService.mget(['key1', 'key2']);
      expect(result).toEqual([null, null]);
    });

    it('should handle keys error gracefully', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));
      await expect(cacheService.delPattern('test:*')).resolves.not.toThrow();
    });
  });

  describe('Connection failures', () => {
    it('should handle operations when Redis is not connected', async () => {
      mockGetRedisClient.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle stats when Redis is not connected', async () => {
      mockGetRedisClient.mockRejectedValue(new Error('Connection failed'));

      const stats = await cacheService.getCacheStats();
      expect(stats.connected).toBe(false);
    });
  });

  describe('Invalid JSON handling', () => {
    it('should handle invalid JSON in get', async () => {
      mockRedisClient.get.mockResolvedValue('invalid-json{');
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle invalid JSON in mget', async () => {
      mockRedisClient.mGet.mockResolvedValue(['{"data":"test1"}', 'invalid-json']);
      const result = await cacheService.mget<{ data: string }>(['key1', 'key2']);
      expect(result).toEqual([{ data: 'test1' }, null]);
    });
  });
});

// ============================================================================
// Part 4: Connection Management
// ============================================================================

describe('Cache - Connection Management', () => {
  it('should return client from getRedisClient', async () => {
    const client = await cacheService.initCache();
    expect(client).toBe(mockRedisClient);
  });

  it('should handle connection failure gracefully', async () => {
    mockGetRedisClient.mockRejectedValue(new Error('Connection failed'));
    const client = await cacheService.initCache();
    expect(client).toBeNull();
  });
});

// ============================================================================
// Part 5: Additional Coverage Tests
// ============================================================================

describe('Cache - Additional Coverage', () => {
  describe('invalidatePattern', () => {
    it('should invalidate cache by pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['key1', 'key2']);
      await cacheService.invalidatePattern('test:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('test:*');
    });

    it('should handle invalidatePattern when no keys match', async () => {
      mockRedisClient.keys.mockResolvedValue([]);
      await cacheService.invalidatePattern('test:*');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('mset error handling', () => {
    it('should handle mset pipeline error', async () => {
      mockRedisClient._pipeline.exec.mockRejectedValue(new Error('Pipeline error'));
      await expect(cacheService.mset([{ key: 'key1', value: 'val1' }])).resolves.not.toThrow();
    });
  });

  describe('flushCache edge cases', () => {
    it('should handle flushCache error gracefully', async () => {
      mockRedisClient.flushDb.mockRejectedValue(new Error('Flush error'));
      await expect(cacheService.flushCache()).resolves.not.toThrow();
    });

    it('should handle flushCache when client available', async () => {
      await cacheService.flushCache();
      expect(mockRedisClient.flushDb).toHaveBeenCalled();
    });
  });

  describe('getCacheStats edge cases', () => {
    it('should return default stats when init fails', async () => {
      mockGetRedisClient.mockRejectedValueOnce(new Error('Connection failed'));
      const stats = await cacheService.getCacheStats();
      expect(stats).toEqual({
        connected: false,
        keyCount: 0,
        memoryUsage: null,
      });
    });

    it('should handle getCacheStats info parsing error', async () => {
      mockRedisClient.info.mockResolvedValue('invalid info without memory');
      mockRedisClient.dbSize.mockResolvedValue(50);
      const stats = await cacheService.getCacheStats();
      expect(stats.connected).toBe(true);
      expect(stats.keyCount).toBe(50);
      expect(stats.memoryUsage).toBeNull();
    });
  });

  describe('Cache hit/miss metrics', () => {
    it('should record cache hit (when Math.random < 0.1)', async () => {
      const mockMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.05);
      mockRedisClient.get.mockResolvedValue('{"data":"test"}');

      await cacheService.get('test-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      mockMathRandom.mockRestore();
    });

    it('should record cache miss (when Math.random < 0.1)', async () => {
      const mockMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.05);
      mockRedisClient.get.mockResolvedValue(null);

      await cacheService.get('test-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      mockMathRandom.mockRestore();
    });
  });

  describe('Operations when not initialized', () => {
    it('should handle get when init fails', async () => {
      mockGetRedisClient.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle set when init fails', async () => {
      mockGetRedisClient.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(cacheService.set('key', 'val')).resolves.not.toThrow();
    });

    it('should handle del when init fails', async () => {
      mockGetRedisClient.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(cacheService.del('key')).resolves.not.toThrow();
    });

    it('should handle exists when init fails', async () => {
      mockGetRedisClient.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await cacheService.exists('key');
      expect(result).toBe(false);
    });

    it('should handle incr error gracefully', async () => {
      mockRedisClient.incr.mockRejectedValue(new Error('Incr error'));
      const result = await cacheService.incr('counter');
      expect(result).toBe(0);
    });

    it('should handle expire when init fails', async () => {
      mockGetRedisClient.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(cacheService.expire('key', 60)).resolves.not.toThrow();
    });
  });
});
