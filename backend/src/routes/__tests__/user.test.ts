import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createPrismaProxy, createLoggerMock, mockAuthenticate } from '@/test-helpers';

vi.mock('@/lib', () => ({
  prisma: createPrismaProxy(),
  logger: createLoggerMock(),
}));

vi.mock('@/services/usageService', () => ({
  getPlanLimits: vi.fn().mockReturnValue({
    free: { aiModels: 3, historyDays: 7, alerts: 5 },
    pro: { aiModels: 7, historyDays: 30, alerts: 50 },
    enterprise: { aiModels: Infinity, historyDays: 365, alerts: Infinity },
  }),
  checkUsageLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/services/portfolioService', () => ({
  computePortfolioPnL: vi.fn().mockResolvedValue({ totalUnrealizedPnl: 0, totalPnl: 0 }),
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

import { prisma } from '@/lib';
import { watchlistRouter } from '@/routes/watchlist';
import { billingRouter } from '@/routes/billing';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/watchlists', watchlistRouter);
  app.use('/api/billing', billingRouter);
  return app;
}

describe('User Routes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('GET /api/watchlists', () => {
    it('should return empty list', async () => {
      const res = await request(createApp()).get('/api/watchlists');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.watchlists).toEqual([]);
    });
  });

  describe('POST /api/watchlists', () => {
    it('should create watchlist', async () => {
      prisma.watchlist.findUnique.mockResolvedValue(null);
      prisma.watchlist.create.mockResolvedValue({
        id: 'w1', name: 'My List', userId: 'test-user-id', items: [],
      });

      const res = await request(createApp())
        .post('/api/watchlists')
        .send({ name: 'My List' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.watchlist.name).toBe('My List');
    });

    it('should reject duplicate watchlist name', async () => {
      prisma.watchlist.findUnique.mockResolvedValue({ id: 'existing', name: 'My List' });

      const res = await request(createApp())
        .post('/api/watchlists')
        .send({ name: 'My List' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/billing/plans', () => {
    it('should return all plans with features', async () => {
      const res = await request(createApp()).get('/api/billing/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plans).toHaveLength(3);
      expect(res.body.data.plans[0]).toHaveProperty('name');
      expect(res.body.data.plans[0]).toHaveProperty('price');
    });
  });
});
