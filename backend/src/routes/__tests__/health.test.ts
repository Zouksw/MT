/**
 * Tests for health routes
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import healthRouter from '@/routes/health';

// Mock the dependencies
jest.mock('../../lib/database', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/services/iotdb', () => ({
  iotdbClient: {
    healthCheck: jest.fn().mockResolvedValue(false),
  },
}));

import { prisma } from '@/lib/database';

describe('Health Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app with health routes
    app = express();
    app.use('/health', healthRouter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'ok',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          environment: expect.any(String),
        },
      });
    });

    test('should include NODE_ENV in response', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.data.environment).toBe('test');

      // Reset
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('GET /health/ready', () => {
    test('should return ready when all checks pass', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'ready',
          checks: {
            database: true,
            redis: false,
            iotdb: false,
          },
          timestamp: expect.any(String),
        },
      });
    });

    test('should return 503 when database check fails', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Service not ready',
          code: 'SERVICE_NOT_READY',
          details: {
            checks: {
              database: false,
              redis: false,
              iotdb: false,
            },
          },
        },
      });
    });

    test('should execute database query for health check', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      await request(app)
        .get('/health/ready')
        .expect(200);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('GET /health/live', () => {
    test('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'alive',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
        },
      });
    });

    test('should include memory usage', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      const { memory } = response.body.data;
      expect(memory).toHaveProperty('rss');
      expect(memory).toHaveProperty('heapUsed');
      expect(memory).toHaveProperty('heapTotal');
      expect(memory).toHaveProperty('external');
    });

    test('should include process uptime', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof response.body.data.uptime).toBe('number');
    });
  });
});
