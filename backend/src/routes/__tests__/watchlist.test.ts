/**
 * Watchlist Routes Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    watchlist: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    watchlistItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    commodity: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
  success: jest.fn((res, data, status) => {
    res.status(status || 200).json({ success: true, data });
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
  BadRequestError: class BadRequestError extends Error {
    status = 400;
    constructor(msg: string) { super(msg); }
  },
  NotFoundError: class NotFoundError extends Error {
    status = 404;
    constructor(msg: string) { super(msg); }
  },
}));

import { watchlistRouter } from '@/routes/watchlist';
import { prisma } from '@/lib';

// Error handler that maps custom errors to status codes
function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Watchlist Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/watchlists', watchlistRouter);
    app.use(errorHandler);
  });

  describe('GET /api/watchlists', () => {
    test('should return empty list', async () => {
      (prisma.watchlist.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/watchlists')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return watchlists with items', async () => {
      (prisma.watchlist.findMany as jest.Mock).mockResolvedValue([{
        id: 'wl-1',
        name: 'My List',
        isDefault: true,
        createdAt: new Date(),
        items: [],
      }]);

      const response = await request(app)
        .get('/api/watchlists')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/watchlists', () => {
    test('should create a watchlist', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.watchlist.create as jest.Mock).mockResolvedValue({
        id: 'wl-new',
        name: 'Test',
        isDefault: false,
        items: [],
      });

      const response = await request(app)
        .post('/api/watchlists')
        .send({ name: 'Test' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject duplicate name', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue({
        id: 'wl-existing',
        name: 'Test',
      });

      const response = await request(app)
        .post('/api/watchlists')
        .send({ name: 'Test' })
        .expect(400);
    });
  });

  describe('DELETE /api/watchlists/:id', () => {
    test('should delete non-default watchlist', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue({
        id: 'wl-1',
        userId: 'test-user',
        isDefault: false,
      });
      (prisma.watchlist.delete as jest.Mock).mockResolvedValue({ id: 'wl-1' });

      const response = await request(app)
        .delete('/api/watchlists/wl-1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject deleting default watchlist', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue({
        id: 'wl-1',
        userId: 'test-user',
        isDefault: true,
      });

      await request(app)
        .delete('/api/watchlists/wl-1')
        .expect(400);
    });

    test('should return 404 for missing watchlist', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .delete('/api/watchlists/missing')
        .expect(404);
    });
  });

  describe('POST /api/watchlists/:id/items', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    test('should add commodity to watchlist', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue({
        id: 'wl-1',
        userId: 'test-user',
      });
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({
        id: uuid,
        slug: 'brisket_cn',
      });
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.watchlistItem.create as jest.Mock).mockResolvedValue({
        id: 'item-1',
        watchlistId: 'wl-1',
        commodityId: uuid,
      });

      const response = await request(app)
        .post('/api/watchlists/wl-1/items')
        .send({ commodityId: uuid })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject duplicate commodity', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue({
        id: 'wl-1',
        userId: 'test-user',
      });
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({ id: uuid });
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({ id: 'item-1' });

      await request(app)
        .post('/api/watchlists/wl-1/items')
        .send({ commodityId: uuid })
        .expect(400);
    });
  });

  describe('GET /api/watchlists/:id/quotes', () => {
    test('should return quotes for watchlist items', async () => {
      (prisma.watchlist.findUnique as jest.Mock).mockResolvedValue({
        id: 'wl-1',
        userId: 'test-user',
        items: [{
          commodityId: 'c-1',
          commodity: {
            id: 'c-1',
            slug: 'brisket_cn',
            name: 'Brisket',
            nameCn: '牛腩',
            unit: 'CNY/kg',
          },
        }],
      });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { commodity_id: 'c-1', close: 79.8, date: new Date('2024-01-15'), rn: 1 },
        { commodity_id: 'c-1', close: 78.5, date: new Date('2024-01-14'), rn: 2 },
      ]);

      const response = await request(app)
        .get('/api/watchlists/wl-1/quotes')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
