/**
 * Portfolios Route Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    portfolio: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    position: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    commodity: {
      findUnique: jest.fn(),
    },
  },
  success: jest.fn((res, data, status) => {
    res.status(status || 200).json({ success: true, data });
  }),
}));

jest.mock('@/services/portfolioService', () => ({
  computePortfolioPnL: jest.fn().mockResolvedValue({
    totalUnrealizedPnl: 500,
    totalRealizedPnl: 100,
    totalPnl: 600,
    longCount: 1,
    shortCount: 0,
    positionCount: 1,
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
  BadRequestError: class BadRequestError extends Error {
    status = 400;
    constructor(msg: string) { super(msg); }
  },
}));

import { portfolioRouter } from '@/routes/portfolios';
import { prisma } from '@/lib';

function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Portfolios Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/portfolios', portfolioRouter);
    app.use(errorHandler);
  });

  describe('GET /api/portfolios', () => {
    test('should return user portfolios', async () => {
      (prisma.portfolio.findMany as jest.Mock).mockResolvedValue([
        { id: 'p1', name: 'Default', isDefault: true, description: null, createdAt: new Date(), positions: [] },
      ]);

      const response = await request(app)
        .get('/api/portfolios')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.portfolios).toHaveLength(1);
    });
  });

  describe('POST /api/portfolios', () => {
    test('should create a new portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.portfolio.create as jest.Mock).mockResolvedValue({
        id: 'p2',
        name: 'My Group',
        description: 'Test',
        isDefault: false,
      });

      const response = await request(app)
        .post('/api/portfolios')
        .send({ name: 'My Group', description: 'Test' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject duplicate name', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        name: 'My Group',
      });

      const response = await request(app)
        .post('/api/portfolios')
        .send({ name: 'My Group' })
        .expect(400);
    });
  });

  describe('GET /api/portfolios/:id', () => {
    test('should return portfolio with positions', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        userId: 'test-user',
        name: 'Default',
        positions: [],
      });

      const response = await request(app)
        .get('/api/portfolios/p1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return 404 for missing portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/portfolios/missing')
        .expect(404);
    });
  });

  describe('GET /api/portfolios/:id/performance', () => {
    test('should return performance summary', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        userId: 'test-user',
      });

      const response = await request(app)
        .get('/api/portfolios/p1/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performance.totalPnl).toBe(600);
    });
  });

  describe('POST /api/portfolios/:id/positions', () => {
    test('should add a position', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        userId: 'test-user',
      });
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'brisket_cn',
      });
      (prisma.position.create as jest.Mock).mockResolvedValue({
        id: 'pos-1',
        portfolioId: 'p1',
        side: 'LONG',
        quantity: 100,
        avgEntryPrice: 78.5,
      });

      const response = await request(app)
        .post('/api/portfolios/p1/positions')
        .send({
          commodityId: '550e8400-e29b-41d4-a716-446655440000',
          side: 'LONG',
          quantity: 100,
          avgEntryPrice: 78.5,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/portfolios/:id', () => {
    test('should reject deleting default portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        userId: 'test-user',
        isDefault: true,
      });

      await request(app)
        .delete('/api/portfolios/p1')
        .expect(400);
    });

    test('should delete non-default portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: 'p2',
        userId: 'test-user',
        isDefault: false,
      });
      (prisma.portfolio.delete as jest.Mock).mockResolvedValue({ id: 'p2' });

      const response = await request(app)
        .delete('/api/portfolios/p2')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
