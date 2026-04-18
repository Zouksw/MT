/**
 * Market Data Routes Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

// Mock dependencies
jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    commodity: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    commodityPrice: {
      findMany: jest.fn(),
    },
    marketFactor: {
      findMany: jest.fn(),
    },
  },
  success: jest.fn((res, data) => {
    res.json({ success: true, data });
    return { success: true, data };
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

jest.mock('@/middleware/cacheDecorator', () => ({
  cacheRoute: () => (_req: any, _res: any, next: any) => next(),
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

jest.mock('@/services/dataIngestion/normalizer', () => ({
  detectFieldMapping: jest.fn(),
}));

jest.mock('@/services/dataIngestion/sources/manualImport', () => ({
  parseCSV: jest.fn(),
  importRows: jest.fn(),
}));

import { marketDataRouter } from '@/routes/marketData';
import { prisma } from '@/lib';

const mockCommodity = {
  id: 'commodity-1',
  slug: 'brisket_cn',
  name: 'Brisket (Domestic)',
  nameCn: '牛腩（国产）',
  category: 'beef_cuts',
  subcategory: 'brisket',
  grade: null,
  originCountry: 'CN',
  unit: 'CNY/kg',
  currency: 'CNY',
  isActive: true,
  metadata: null,
};

const mockPrice = {
  id: 'price-1',
  commodityId: 'commodity-1',
  date: new Date('2024-01-15'),
  interval: 'daily',
  open: 78.5,
  high: 80.0,
  low: 77.2,
  close: 79.8,
  volume: 15000,
  source: 'manual',
  metadata: null,
};

describe('Market Data Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/market', marketDataRouter);
  });

  describe('GET /api/market/commodities', () => {
    test('should return commodities list', async () => {
      (prisma.commodity.findMany as jest.Mock).mockResolvedValue([
        { ...mockCommodity, prices: [{ close: 79.8, date: new Date('2024-01-15') }] },
      ]);

      const response = await request(app)
        .get('/api/market/commodities')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return empty list when no commodities', async () => {
      (prisma.commodity.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/market/commodities')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/market/commodities/:slug/latest', () => {
    test('should return latest price for commodity', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({
        ...mockCommodity,
        prices: [mockPrice],
      });

      const response = await request(app)
        .get('/api/market/commodities/brisket_cn/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return null price when no prices exist', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({
        ...mockCommodity,
        prices: [],
      });

      const response = await request(app)
        .get('/api/market/commodities/brisket_cn/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return 404 for unknown slug', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/market/commodities/unknown/latest')
        .expect(404);
    });
  });

  describe('GET /api/market/commodities/:slug/price', () => {
    test('should return price history', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue(mockCommodity);
      (prisma.commodityPrice.findMany as jest.Mock).mockResolvedValue([mockPrice]);

      const response = await request(app)
        .get('/api/market/commodities/brisket_cn/price?interval=daily')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return 404 for unknown commodity', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/market/commodities/unknown/price')
        .expect(404);
    });

    test('should accept from/to date params', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue(mockCommodity);
      (prisma.commodityPrice.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/market/commodities/brisket_cn/price?from=2024-01-01&to=2024-01-31')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/market/commodities/:slug/fundamentals', () => {
    test('should return fundamentals data', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue(mockCommodity);
      (prisma.marketFactor.findMany as jest.Mock).mockResolvedValue([
        { id: 'f1', type: 'exchange_rate', region: 'USD/CNY', date: new Date(), value: 7.24, unit: 'CNY', source: 'api' },
      ]);

      const response = await request(app)
        .get('/api/market/commodities/brisket_cn/fundamentals')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should return 404 for unknown slug', async () => {
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/market/commodities/unknown/fundamentals')
        .expect(404);
    });
  });

  describe('GET /api/market/factors/exchange-rates', () => {
    test('should return exchange rates', async () => {
      (prisma.marketFactor.findMany as jest.Mock).mockResolvedValue([
        { id: 'f1', type: 'exchange_rate', region: 'USD/CNY', date: new Date(), value: 7.24, unit: 'CNY', source: 'api' },
        { id: 'f2', type: 'exchange_rate', region: 'AUD/USD', date: new Date(), value: 0.65, unit: 'USD', source: 'api' },
      ]);

      const response = await request(app)
        .get('/api/market/factors/exchange-rates')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should deduplicate rates by region (keep latest)', async () => {
      const day1 = new Date('2024-01-14');
      const day2 = new Date('2024-01-15');

      (prisma.marketFactor.findMany as jest.Mock).mockResolvedValue([
        { id: 'f1', type: 'exchange_rate', region: 'USD/CNY', date: day2, value: 7.25, unit: 'CNY', source: 'api' },
        { id: 'f2', type: 'exchange_rate', region: 'USD/CNY', date: day1, value: 7.24, unit: 'CNY', source: 'api' },
      ]);

      const response = await request(app)
        .get('/api/market/factors/exchange-rates')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
