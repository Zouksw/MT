import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createPrismaProxy, createLoggerMock, mockAuthenticate, } from '@/test-helpers';

vi.mock('@/lib', () => ({
  prisma: createPrismaProxy(),
  logger: createLoggerMock(),
}));

vi.mock('@/services/tradingSignals', () => ({
  getSignals: vi.fn().mockResolvedValue({ signals: [] }),
  generateSignal: vi.fn().mockResolvedValue({ signal: 'BUY', confidence: 0.8 }),
  getAllModels: vi.fn().mockReturnValue([
    { id: 'arima', name: 'ARIMA' },
    { id: 'holtwinters', name: 'HoltWinters' },
  ]),
}));

vi.mock('@/services/predictionCache', () => ({
  getCachedPredictions: vi.fn().mockResolvedValue(null),
  setCachedPredictions: vi.fn(),
  getAllCachedPredictions: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('@/services/mapeTracking', () => ({
  getAllModelAccuracy: vi.fn().mockResolvedValue({ accuracy: [{ modelId: 'arima', mape: 5.2 }] }),
  getModelAccuracy: vi.fn().mockResolvedValue({ accuracy: [] }),
  getBacktestWindows: vi.fn().mockResolvedValue({ windows: [], trend: 'insufficient_data' }),
}));

vi.mock('@/services/correlationAnalysis', () => ({
  getCorrelation: vi.fn().mockResolvedValue({ correlation: [] }),
  getCorrelationMatrix: vi.fn().mockResolvedValue({ matrix: [] }),
  getAvailableCommodities: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/alertNotifications', () => ({ checkAndNotify: vi.fn() }));
vi.mock('@/services/backtesting', () => ({ runBacktest: vi.fn().mockResolvedValue({ results: [] }) }));

vi.mock('@/middleware/auth', () => ({
  authenticate: mockAuthenticate,
}));

vi.mock('@/middleware/cacheDecorator', () => ({
  cacheRoute: () => (_req: any, _res: any, next: any) => next(),
  invalidateCache: vi.fn(),
}));

vi.mock('@/middleware/errorHandler', () => ({
  errorHandler: (err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  },
  NotFoundError: class extends Error { statusCode = 404; },
  BadRequestError: class extends Error { statusCode = 400; },
  asyncHandler: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

import { signalsRouter } from '@/routes/signals';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/signals', signalsRouter);
  return app;
}

describe('Signals/AI Routes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return model list with count', async () => {
    const res = await request(createApp()).get('/api/signals/models');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.models).toHaveLength(2);
    expect(res.body.data.count).toBe(2);
  });

  it('should return accuracy data', async () => {
    const res = await request(createApp()).get('/api/signals/models/accuracy');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accuracy).toBeDefined();
    expect(res.body.data.days).toBeDefined();
  });

  it('should return backtest windows', async () => {
    const res = await request(createApp()).get('/api/signals/models/arima/backtest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return predictions with pagination', async () => {
    const res = await request(createApp()).get('/api/signals/models/arima/predictions?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('predictions');
    expect(res.body.data).toHaveProperty('total');
  });
});
