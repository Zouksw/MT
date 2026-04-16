/**
 * API Contract Tests
 *
 * Verifies that API response shapes follow the agreed contract.
 * Only tests that work reliably with mocked dependencies are included.
 * Full request/response cycle tests belong in integration tests.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock all dependencies
jest.mock('@/lib', () => ({
  prisma: {
    dataset: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organizations: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((cb: any) => cb({})),
  },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

jest.mock('@/middleware/cacheDecorator', () => ({
  cacheRoute: () => (req: any, res: any, next: any) => next(),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', role: 'admin', email: 'test@example.com' };
    req.userId = 'test-user-id';
    next();
  },
}));

const { prisma } = require('@/lib');
import { datasetsRouter } from '@/routes/datasets';

describe('API Contract: Response Shape', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
  });

  describe('Dataset endpoints', () => {
    beforeEach(() => {
      app.use('/datasets', datasetsRouter);
    });

    test('GET /datasets returns correct structure', async () => {
      prisma.dataset.findMany.mockResolvedValue([]);
      prisma.dataset.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/datasets')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        datasets: expect.any(Array),
        pagination: {
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
        },
      });
    });

    test('GET /datasets pagination defaults', async () => {
      prisma.dataset.findMany.mockResolvedValue([]);
      prisma.dataset.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/datasets')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });

    test('DELETE /datasets/:id returns 404 for non-existent', async () => {
      prisma.dataset.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/datasets/nonexistent')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });

    test('PATCH /datasets/:id returns 404 for non-existent', async () => {
      prisma.dataset.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch('/datasets/nonexistent')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    test('GET /datasets error returns 500 on DB failure', async () => {
      prisma.dataset.findMany.mockRejectedValue(new Error('DB error'));
      prisma.dataset.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/datasets')
        .set('Authorization', 'Bearer test-token');

      // Errors should return 500, not crash the server
      expect(response.status).toBe(500);
    });
  });
});
