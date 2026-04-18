/**
 * Signals Route Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {},
  success: jest.fn((res, data, status) => {
    res.status(status || 200).json({ success: true, data });
  }),
}));

jest.mock('@/services/tradingSignals', () => ({
  getAllModels: jest.fn().mockReturnValue([
    { id: 'arima', name: 'ARIMA', type: 'statistical' },
    { id: 'holtwinters', name: 'HoltWinters', type: 'statistical' },
  ]),
  generateSignal: jest.fn().mockResolvedValue({
    type: 'BUY',
    confidence: 0.85,
    models: { arima: 'BUY', holtwinters: 'BUY' },
    predictions: { arima: [80, 82], holtwinters: [81, 83] },
  }),
}));

jest.mock('@/services/predictionCache', () => ({
  getAllCachedPredictions: jest.fn().mockResolvedValue(new Map([
    ['arima', [{ horizon: 1, value: 80 }]],
  ])),
}));

jest.mock('@/services/mapeTracking', () => ({
  getAllModelAccuracy: jest.fn().mockResolvedValue([
    { modelId: 'arima', mape: 3.2, sampleCount: 100 },
  ]),
  getModelAccuracy: jest.fn().mockResolvedValue({
    modelId: 'arima',
    mape: 3.2,
    sampleCount: 100,
  }),
}));

jest.mock('@/services/correlationAnalysis', () => ({
  computeCorrelation: jest.fn().mockResolvedValue({
    a: 'brisket_cn',
    b: 'shin_cn',
    correlation: 0.85,
    sampleCount: 90,
  }),
  computeCorrelationMatrix: jest.fn().mockResolvedValue([
    { a: 'brisket_cn', b: 'shin_cn', corr: 0.85 },
    { a: 'brisket_cn', b: 'brisket_cn', corr: 1.0 },
    { a: 'shin_cn', b: 'shin_cn', corr: 1.0 },
  ]),
  getAvailableCommodities: jest.fn().mockResolvedValue([
    { slug: 'brisket_cn', name: 'Brisket' },
    { slug: 'shin_cn', name: 'Shin' },
  ]),
}));

jest.mock('@/services/alertNotifications', () => ({
  checkSignalChange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/backtesting', () => ({
  runBacktest: jest.fn().mockResolvedValue({
    modelId: 'arima',
    windows: { 7: { mape: 2.1 }, 30: { mape: 3.5 } },
  }),
}));

jest.mock('@/middleware/cacheDecorator', () => ({
  cacheRoute: () => (_req: any, _res: any, next: any) => next(),
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

import { signalsRouter } from '@/routes/signals';

function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Signals Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.set('io', { emit: jest.fn() });
    app.use('/api/signals', signalsRouter);
    app.use(errorHandler);
  });

  describe('GET /api/signals/models', () => {
    test('should list all models', async () => {
      const response = await request(app)
        .get('/api/signals/models')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.models).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });
  });

  describe('GET /api/signals/models/accuracy', () => {
    test('should return accuracy for all models', async () => {
      const response = await request(app)
        .get('/api/signals/models/accuracy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accuracy).toHaveLength(1);
    });
  });

  describe('GET /api/signals/models/:modelId/accuracy', () => {
    test('should return accuracy for specific model', async () => {
      const response = await request(app)
        .get('/api/signals/models/arima/accuracy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.modelId).toBe('arima');
    });
  });

  describe('GET /api/signals/models/:modelId/backtest', () => {
    test('should run backtest', async () => {
      const response = await request(app)
        .get('/api/signals/models/arima/backtest')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/signals/correlation', () => {
    test('should return 400 when missing params', async () => {
      await request(app)
        .get('/api/signals/correlation')
        .expect(400);
    });

    test('should compute correlation between two commodities', async () => {
      const response = await request(app)
        .get('/api/signals/correlation?a=brisket_cn&b=shin_cn')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.correlation).toBe(0.85);
    });
  });

  describe('GET /api/signals/correlation/matrix', () => {
    test('should compute correlation matrix', async () => {
      const response = await request(app)
        .get('/api/signals/correlation/matrix?commodities=brisket_cn,shin_cn')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should reject fewer than 2 commodities', async () => {
      await request(app)
        .get('/api/signals/correlation/matrix?commodities=brisket_cn')
        .expect(400);
    });
  });

  describe('GET /api/signals/commodities', () => {
    test('should list available commodities', async () => {
      const response = await request(app)
        .get('/api/signals/commodities')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/signals/:commodityId', () => {
    test('should generate signal for commodity', async () => {
      const response = await request(app)
        .get('/api/signals/brisket_cn?currentPrice=79.5&timeseriesPath=/test&horizon=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.commodityId).toBe('brisket_cn');
      expect(response.body.data.type).toBe('BUY');
    });

    test('should reject missing required params', async () => {
      await request(app)
        .get('/api/signals/brisket_cn')
        .expect(500);
    });
  });

  describe('GET /api/signals/:commodityId/predictions', () => {
    test('should return cached predictions', async () => {
      const response = await request(app)
        .get('/api/signals/brisket_cn/predictions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.commodityId).toBe('brisket_cn');
    });
  });
});
