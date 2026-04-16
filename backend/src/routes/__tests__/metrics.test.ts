/**
 * Metrics Route Tests
 *
 * Tests the performance metrics endpoints:
 * - GET / — server metrics (uptime, memory, event loop)
 * - GET /endpoints — endpoint performance stats
 * - POST /web-vitals — record Web Vitals from client
 * - GET /web-vitals — retrieve latest Web Vitals
 * - GET /web-vitals/history — historical Web Vitals
 * - GET /api-latency — API latency distribution
 * - GET /summary — overall performance summary
 */

import request from 'supertest';
import express from 'express';

const mockRedisClient = {
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
  setEx: jest.fn(() => Promise.resolve('OK')),
  del: jest.fn(() => Promise.resolve(1)),
  keys: jest.fn(() => Promise.resolve([])),
  quit: jest.fn(() => Promise.resolve('OK')),
  zAdd: jest.fn(() => Promise.resolve(1)),
  zRemRangeByScore: jest.fn(() => Promise.resolve(0)),
  zRange: jest.fn(() => Promise.resolve([])),
  zRangeByScore: jest.fn(() => Promise.resolve([])),
  zCard: jest.fn(() => Promise.resolve(0)),
  lRange: jest.fn(() => Promise.resolve([])),
  rPush: jest.fn(() => Promise.resolve(1)),
  hGetAll: jest.fn(() => Promise.resolve({})),
};

jest.mock('@/lib/redis', () => ({
  redis: jest.fn(() => Promise.resolve(mockRedisClient)),
  getRedisClient: jest.fn(() => Promise.resolve(mockRedisClient)),
}));

jest.mock('@/lib', () => ({
  prisma: {},
}));

import { metricsRouter } from '../metrics';

const app = express();
app.use(express.json());
app.use('/metrics', metricsRouter);

describe('GET /metrics', () => {
  it('returns server performance metrics', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.uptime).toBeDefined();
    expect(res.body.data.memory).toBeDefined();
  });
});

describe('GET /metrics/endpoints', () => {
  it('returns endpoint performance stats', async () => {
    // First make a request to populate metrics
    await request(app).get('/metrics');

    const res = await request(app).get('/metrics/endpoints');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.endpoints).toBeDefined();
    expect(typeof res.body.data.endpoints).toBe('object');
  });
});

describe('POST /metrics/web-vitals', () => {
  it('records Web Vitals data', async () => {
    const res = await request(app)
      .post('/metrics/web-vitals')
      .send({
        name: 'LCP',
        value: 2.5,
        path: '/dashboard',
        timestamp: Date.now(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid Web Vitals data', async () => {
    const res = await request(app)
      .post('/metrics/web-vitals')
      .send({ invalid: true });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects invalid metric name', async () => {
    const res = await request(app)
      .post('/metrics/web-vitals')
      .send({ name: 'INVALID', value: 1, path: '/' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects missing path', async () => {
    const res = await request(app)
      .post('/metrics/web-vitals')
      .send({ name: 'LCP', value: 2.5 });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('GET /metrics/web-vitals', () => {
  it('returns Web Vitals data', async () => {
    // First record some vitals
    await request(app)
      .post('/metrics/web-vitals')
      .send({
        name: 'LCP',
        value: 1.2,
        path: '/trading',
        timestamp: Date.now(),
      });

    const res = await request(app).get('/metrics/web-vitals');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /metrics/web-vitals/history', () => {
  it('returns historical Web Vitals', async () => {
    const res = await request(app).get('/metrics/web-vitals/history');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /metrics/api-latency', () => {
  it('returns API latency distribution', async () => {
    // Make some requests to generate latency data
    await request(app).get('/metrics');
    await request(app).get('/metrics');

    const res = await request(app).get('/metrics/api-latency');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /metrics/summary', () => {
  it('returns overall performance summary', async () => {
    const res = await request(app).get('/metrics/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});
