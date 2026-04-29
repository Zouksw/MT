import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('@/lib', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ result: 1 }]),
    $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn().mockResolvedValue({ ping: vi.fn().mockResolvedValue('PONG') }),
}));

vi.mock('@/services/iotdb', () => ({
  iotdbClient: { healthCheck: vi.fn().mockResolvedValue(true) },
}));

vi.mock('@/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test', role: 'user' };
    next();
  },
}));

vi.mock('@/middleware/errorHandler', () => ({
  errorHandler: (err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  },
  asyncHandler: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

import healthRouter from '@/routes/health';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRouter);
  return app;
}

describe('System Routes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return health status', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'ok', environment: 'test' });
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('should return readiness check', async () => {
    const res = await request(createApp()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checks).toMatchObject({
      database: true,
      redis: true,
      iotdb: true,
    });
  });

  it('should return liveness check', async () => {
    const res = await request(createApp()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('memory');
    expect(res.body.data).toHaveProperty('uptime');
  });
});
