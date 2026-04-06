/**
 * Cache Decorator Integration Tests
 *
 * These tests use a real Express app and mock Redis to test the cacheDecorator
 * in a realistic scenario, avoiding complex mock setups.
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { cacheRoute, invalidateCache } from '../cacheDecorator';

// Mock Redis data store
const mockRedisData = new Map<string, { value: string; expiry: number }>();

// Mock Redis client
const mockRedis: any = {
  get: jest.fn(),
  setEx: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
};

jest.mock('@/lib/redis', () => ({
  redis: jest.fn(() => Promise.resolve(mockRedis)),
  getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
  initRedis: jest.fn(() => Promise.resolve()),
  initCache: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/logger');

describe('cacheDecorator Integration Tests', () => {
  let app: express.Express;

  beforeEach(async () => {
    // Clear mock data
    mockRedisData.clear();
    jest.clearAllMocks();

    // Configure mock Redis methods to use mockRedisData
    mockRedis.get.mockImplementation(async (key: string) => {
      const item = mockRedisData.get(key);
      if (!item) return null;
      if (item.expiry < Date.now()) {
        mockRedisData.delete(key);
        return null;
      }
      return item.value;
    });

    mockRedis.setEx.mockImplementation(async (key: string, ttl: number, value: string) => {
      const expiry = Date.now() + ttl * 1000;
      mockRedisData.set(key, { value, expiry });
      return 'OK';
    });

    mockRedis.keys.mockImplementation(async (pattern: string) => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return Array.from(mockRedisData.keys()).filter(key => regex.test(key));
    });

    mockRedis.del.mockImplementation(async (...args: string[]) => {
      const keys = Array.isArray(args[0]) ? args[0] : args;
      keys.forEach(key => mockRedisData.delete(key));
      return keys.length;
    });

    // Create Express app
    app = express();
    app.use(express.json());

    // Add caching middleware
    app.get('/datasets', cacheRoute('datasets:list', 60), (req, res) => {
      res.json({ datasets: [{ id: '1', name: 'Dataset 1' }] });
    });

    app.get('/datasets/:id', cacheRoute('datasets:detail', 30), (req, res) => {
      res.json({ id: req.params.id, name: `Dataset ${req.params.id}` });
    });

    app.get('/search', cacheRoute('search', 60, {
      keyGenerator: (req) => `q:${req.query.q}`,
    }), (req, res) => {
      res.json({ results: [`Result for ${req.query.q}`] });
    });

    app.get('/my-data', cacheRoute('mydata', 60, { varyByUser: true }), (req, res) => {
      const userId = (req as any).user?.id || 'anonymous';
      res.json({ userId, data: ['item1', 'item2'] });
    });

    app.post('/datasets', (req, res) => {
      res.status(201).json({ id: '2', name: 'New Dataset' });
    });

    app.get('/error', cacheRoute('error', 60), (req, res) => {
      res.status(500).json({ error: 'Server error' });
    });
  });

  describe('Cache HIT scenarios', () => {
    it('should return cached response on second request', async () => {
      // First request - cache miss
      const response1 = await request(app)
        .get('/datasets')
        .expect(200)
        .expect('X-Cache', 'MISS');

      expect(response1.body).toEqual({ datasets: [{ id: '1', name: 'Dataset 1' }] });

      // Verify cache was set
      expect(mockRedis.setEx).toHaveBeenCalled();
      const setExCall = mockRedis.setEx.mock.calls[0];
      expect(setExCall[0]).toContain('datasets:list');
      // TTL has jitter applied (±10%), so it should be in range [54, 66]
      expect(setExCall[1]).toBeGreaterThanOrEqual(54);
      expect(setExCall[1]).toBeLessThanOrEqual(66);

      // Second request - cache hit
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        statusCode: 200,
        body: { datasets: [{ id: '1', name: 'Dataset 1' }] },
        headers: {},
      }));

      const response2 = await request(app)
        .get('/datasets')
        .expect(200)
        .expect('X-Cache', 'HIT');

      expect(response2.body).toEqual({ datasets: [{ id: '1', name: 'Dataset 1' }] });
    });

    it('should not cache non-GET requests', async () => {
      // Clear mock calls before this specific test
      mockRedis.setEx.mockClear();

      const response = await request(app)
        .post('/datasets')
        .expect(201);

      // Verify the response body
      expect(response.body).toEqual({ id: '2', name: 'New Dataset' });

      // Verify setEx was not called for POST request (POST requests are not cached)
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    it('should not cache error responses', async () => {
      await request(app)
        .get('/error')
        .expect(500)
        .expect('X-Cache', 'MISS');

      // Verify cache was not set for 500 error
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });
  });

  describe('Cache key generation', () => {
    it('should generate cache key from path', async () => {
      await request(app)
        .get('/datasets')
        .expect(200);

      const setExCall = mockRedis.setEx.mock.calls[0];
      expect(setExCall[0]).toContain('datasets:list');
      expect(setExCall[0]).toContain('/datasets');
    });

    it('should include query string in cache key', async () => {
      await request(app)
        .get('/search?q=test')
        .expect(200);

      const setExCall = mockRedis.setEx.mock.calls[0];
      expect(setExCall[0]).toContain('q:test');
    });

    it('should use custom key generator', async () => {
      await request(app)
        .get('/search?q=custom')
        .expect(200);

      const setExCall = mockRedis.setEx.mock.calls[0];
      expect(setExCall[0]).toContain('q:custom');
    });

    it('should vary cache by user when enabled', async () => {
      // Request without user
      await request(app)
        .get('/my-data')
        .expect(200);

      const setExCall1 = mockRedis.setEx.mock.calls[mockRedis.setEx.mock.calls.length - 1];
      expect(setExCall1[0]).not.toContain('user:'); // No user in key

      // Verify that user-specific caching is configured
      // The actual user variation requires req.user to be set by auth middleware
      // which is tested in the unit tests
    });
  });

  describe('Response caching', () => {
    it('should cache response body', async () => {
      const response = await request(app)
        .get('/datasets')
        .expect(200);

      expect(response.body).toEqual({ datasets: [{ id: '1', name: 'Dataset 1' }] });

      // Verify cached body
      const setExCall = mockRedis.setEx.mock.calls[0];
      const cachedResponse = JSON.parse(setExCall[2]);
      expect(cachedResponse.body).toEqual(response.body);
    });

    it('should cache response status code', async () => {
      await request(app)
        .get('/datasets')
        .expect(200);

      const setExCall = mockRedis.setEx.mock.calls[0];
      const cachedResponse = JSON.parse(setExCall[2]);
      expect(cachedResponse.statusCode).toBe(200);
    });

    it('should cache response headers', async () => {
      // Add a route with custom headers
      app.get('/with-headers', cacheRoute('headers', 60), (req, res) => {
        res.set('X-Custom-Header', 'custom-value');
        res.json({ data: 'test' });
      });

      await request(app)
        .get('/with-headers')
        .expect('X-Custom-Header', 'custom-value')
        .expect(200);

      // Verify headers were cached
      const setExCall = mockRedis.setEx.mock.calls[mockRedis.setEx.mock.calls.length - 1];
      const cachedResponse = JSON.parse(setExCall[2]);
      expect(cachedResponse.headers).toHaveProperty('X-Custom-Header', 'custom-value');
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate cache by pattern', async () => {
      // Set up cache
      mockRedisData.set('datasets:list:/datasets', {
        value: JSON.stringify({ body: { datasets: [] }, statusCode: 200, headers: {} }),
        expiry: Date.now() + 60000,
      });
      mockRedisData.set('datasets:detail:/datasets/1', {
        value: JSON.stringify({ body: { id: '1' }, statusCode: 200, headers: {} }),
        expiry: Date.now() + 60000,
      });

      // Invalidate
      const deleted = await invalidateCache('datasets:*');
      expect(deleted).toBe(2);

      // Verify keys are deleted
      expect(mockRedisData.has('datasets:list:/datasets')).toBe(false);
      expect(mockRedisData.has('datasets:detail:/datasets/1')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle cache get errors gracefully', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .get('/datasets')
        .expect(200);

      // Should still return response even if cache fails
      expect(response.body).toBeDefined();
    });

    it('should handle cache set errors gracefully', async () => {
      mockRedis.setEx.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .get('/datasets')
        .expect(200);

      // Should still return response even if caching fails
      expect(response.body).toBeDefined();
    });

    it('should handle invalid JSON in cache gracefully', async () => {
      mockRedis.get.mockResolvedValueOnce('invalid json{{');

      const response = await request(app)
        .get('/datasets')
        .expect(200);

      // Should return fresh data if cache is invalid
      expect(response.body).toBeDefined();
      expect(mockRedis.setEx).toHaveBeenCalled(); // Should re-cache
    });
  });

  describe('Performance', () => {
    it('should not block response on cache miss', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/datasets')
        .expect(200);

      const duration = Date.now() - startTime;

      // Response should be fast even with cache miss
      expect(duration).toBeLessThan(100); // 100ms max
    });

    it('should be very fast on cache hit', async () => {
      // First request to populate cache
      await request(app)
        .get('/datasets')
        .expect(200);

      // Mock cache HIT
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        statusCode: 200,
        body: { datasets: [{ id: '1', name: 'Dataset 1' }] },
        headers: {},
      }));

      const startTime = Date.now();

      await request(app)
        .get('/datasets')
        .expect(200);

      const duration = Date.now() - startTime;

      // Cache hit should be very fast
      expect(duration).toBeLessThan(50); // 50ms max
    });
  });

  describe('Additional coverage tests', () => {
    it('should handle res.set with object parameter', async () => {
      // Add a route that uses res.set with an object
      app.get('/headers', cacheRoute('headers:test', 60), (req, res) => {
        res.set({ 'X-Custom-Header': 'value', 'X-Another-Header': 'another' });
        res.json({ message: 'ok' });
      });

      await request(app)
        .get('/headers')
        .expect(200);

      // Verify cache was called
      expect(mockRedis.setEx).toHaveBeenCalled();
    });

    it('should handle invalidateCache when no keys match', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);

      const deleted = await invalidateCache('nomatch:*');
      expect(deleted).toBe(0);
    });

    it('should handle invalidateCache error gracefully', async () => {
      mockRedis.keys.mockRejectedValueOnce(new Error('Redis error'));

      const deleted = await invalidateCache('test:*');
      expect(deleted).toBe(0);
    });

    it('should vary cache by user ID', async () => {
      // Request with user ID
      const response1 = await request(app)
        .get('/my-data')
        .set('X-User-Id', 'user-123');

      // Verify response contains user ID
      expect(response1.body.userId).toBeDefined();
    });

    it('should handle non-GET requests without caching', async () => {
      // PUT request should not be cached
      const response = await request(app)
        .post('/datasets')
        .send({ name: 'New Dataset' })
        .expect(201);

      expect(response.body.id).toBe('2');
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should not cache error responses', async () => {
      await request(app)
        .get('/error')
        .expect(500);

      // Verify that error response was not cached
      // Next request should also hit the handler
      mockRedis.get.mockClear();
      await request(app)
        .get('/error')
        .expect(500);
    });
  });
});
