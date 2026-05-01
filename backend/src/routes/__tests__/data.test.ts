import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createPrismaProxy, createLoggerMock, mockAuthenticate } from '@/test-helpers';

vi.mock('@/lib', () => ({
  prisma: createPrismaProxy(),
  logger: createLoggerMock(),
}));

vi.mock('@/middleware/auth', () => ({
  authenticate: mockAuthenticate,
}));

vi.mock('@/middleware/errorHandler', () => ({
  errorHandler: (err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  },
  NotFoundError: class extends Error { statusCode = 404; },
  BadRequestError: class extends Error { statusCode = 400; },
  ForbiddenError: class extends Error { statusCode = 403; },
  asyncHandler: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock('@/middleware/cacheDecorator', () => ({
  cacheRoute: () => (_req: any, _res: any, next: any) => next(),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib';
import { datasetsRouter } from '@/routes/datasets';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/datasets', datasetsRouter);
  return app;
}

describe('Dataset Routes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('GET /api/datasets', () => {
    it('should return empty list with pagination', async () => {
      const res = await request(createApp()).get('/api/datasets');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 0 });
    });

    it('should return datasets with pagination', async () => {
      prisma.dataset.findMany.mockResolvedValue([
        { id: 'ds1', name: 'Oil Prices', description: 'desc', ownerId: 'u1' },
      ]);
      prisma.dataset.count.mockResolvedValue(1);

      const res = await request(createApp()).get('/api/datasets?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });
  });

  describe('GET /api/datasets/:id', () => {
    it('should return 404 for missing dataset', async () => {
      prisma.dataset.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/datasets/nonexistent');
      expect(res.status).toBe(404);
    });

    it('should return dataset with owner and timeseries', async () => {
      prisma.dataset.findUnique.mockResolvedValue({
        id: 'ds1', name: 'Test', ownerId: 'u1', timeseries: [],
      });

      const res = await request(createApp()).get('/api/datasets/ds1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('ds1');
    });
  });

  describe('POST /api/datasets', () => {
    it('should create dataset', async () => {
      prisma.dataset.findFirst.mockResolvedValue(null);
      prisma.organizations.findFirst.mockResolvedValue({ id: 'org-1', name: 'Default' });
      prisma.dataset.create.mockResolvedValue({
        id: 'ds1', name: 'New Dataset', ownerId: 'test-user-id', slug: 'new-dataset',
      });

      const res = await request(createApp())
        .post('/api/datasets')
        .send({ name: 'New Dataset', slug: 'new-dataset', storageFormat: 'CSV' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Dataset');
    });

    it('should reject missing required fields', async () => {
      const res = await request(createApp())
        .post('/api/datasets')
        .send({ description: 'Missing name and slug' });

      expect(res.status).toBe(500);
    });
  });
});
