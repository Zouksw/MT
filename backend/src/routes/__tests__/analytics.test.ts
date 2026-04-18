/**
 * Analytics Route Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    simulationAccount: {
      findUnique: jest.fn(),
    },
    simulationTrade: {
      findMany: jest.fn(),
    },
    commodity: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
  success: jest.fn((res, data, status) => {
    res.status(status || 200).json({ success: true, data });
  }),
}));

jest.mock('@/services/riskMetrics', () => ({
  computeRiskReport: jest.fn().mockReturnValue({
    sharpeRatio: 1.5,
    maxDrawdown: -0.12,
    winRate: 0.6,
  }),
}));

jest.mock('@/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', role: 'admin' };
    req.userId = 'test-user';
    next();
  },
  authorize: () => (req: any, _res: any, next: any) => next(),
  AuthRequest: class AuthRequest {},
}));

jest.mock('@/middleware/errorHandler', () => ({
  asyncHandler: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next),
  NotFoundError: class NotFoundError extends Error {
    status = 404;
    constructor(msg: string) { super(msg); }
  },
}));

import { analyticsRouter } from '@/routes/analytics';
import { prisma } from '@/lib';

function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Analytics Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRouter);
    app.use(errorHandler);
  });

  describe('GET /api/analytics/risk/:accountId', () => {
    test('should return 404 for missing account', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/analytics/risk/missing-id')
        .expect(404);
    });

    test('should return 404 for other user account', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'other-user',
      });

      await request(app)
        .get('/api/analytics/risk/a1')
        .expect(404);
    });

    test('should return risk report for own account', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
        initialBalance: 100000,
      });
      (prisma.simulationTrade.findMany as jest.Mock).mockResolvedValue([
        { realizedPnl: 500, closedAt: new Date() },
        { realizedPnl: -200, closedAt: new Date() },
      ]);

      const response = await request(app)
        .get('/api/analytics/risk/a1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.risk.sharpeRatio).toBe(1.5);
    });
  });

  describe('GET /api/analytics/seasonality/:commoditySlug', () => {
    test('should return 404 for missing commodity', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/analytics/seasonality/nonexistent')
        .expect(404);
    });

    test('should return seasonality data', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        slug: 'brisket_cn',
        name: 'Brisket',
      });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { month: 1, avg_price: 78.5, min_price: 72.0, max_price: 85.0, sample_count: 30 },
        { month: 2, avg_price: 80.1, min_price: 74.0, max_price: 87.0, sample_count: 28 },
      ]);

      const response = await request(app)
        .get('/api/analytics/seasonality/brisket_cn')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.seasonality).toHaveLength(2);
      expect(response.body.data.seasonality[0].month).toBe(1);
    });
  });

  describe('GET /api/analytics/correlation', () => {
    test('should return empty when no slugs provided', async () => {
      const response = await request(app)
        .get('/api/analytics/correlation')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.correlations).toHaveLength(0);
    });

    test('should compute correlation between commodities', async () => {
      (prisma.commodity.findMany as jest.Mock).mockResolvedValue([
        {
          slug: 'brisket_cn',
          prices: [
            { date: new Date('2024-01-01'), close: 78 },
            { date: new Date('2024-01-02'), close: 80 },
            { date: new Date('2024-01-03'), close: 79 },
            { date: new Date('2024-01-04'), close: 82 },
            { date: new Date('2024-01-05'), close: 81 },
          ],
        },
        {
          slug: 'shin_cn',
          prices: [
            { date: new Date('2024-01-01'), close: 65 },
            { date: new Date('2024-01-02'), close: 67 },
            { date: new Date('2024-01-03'), close: 66 },
            { date: new Date('2024-01-04'), close: 69 },
            { date: new Date('2024-01-05'), close: 68 },
          ],
        },
      ]);

      const response = await request(app)
        .get('/api/analytics/correlation?slugs=brisket_cn,shin_cn')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.correlations.length).toBeGreaterThan(0);
    });
  });
});
