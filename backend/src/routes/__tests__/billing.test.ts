/**
 * Billing Route Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
  success: jest.fn((res, data, status) => {
    res.status(status || 200).json({ success: true, data });
  }),
}));

jest.mock('@/services/usageService', () => ({
  getUserPlan: jest.fn().mockResolvedValue({ plan: 'free', limits: { maxWatchlistItems: 5 } }),
  getPlanLimits: jest.fn().mockReturnValue({ maxWatchlistItems: 5 }),
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

import { billingRouter } from '@/routes/billing';
import { prisma } from '@/lib';

function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Billing Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/billing', billingRouter);
    app.use(errorHandler);
  });

  describe('GET /api/billing/plans', () => {
    test('should return all plans', async () => {
      const response = await request(app)
        .get('/api/billing/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(3);
      expect(response.body.data.plans[0].id).toBe('free');
      expect(response.body.data.plans[1].id).toBe('pro');
      expect(response.body.data.plans[2].id).toBe('enterprise');
    });
  });

  describe('GET /api/billing/subscription', () => {
    test('should return current subscription', async () => {
      const response = await request(app)
        .get('/api/billing/subscription')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('free');
    });
  });

  describe('POST /api/billing/checkout', () => {
    test('should return 404 (endpoint removed)', async () => {
      const response = await request(app)
        .post('/api/billing/checkout')
        .send({ planId: 'pro' })
        .expect(404);
    });

    test('should return 404 for invalid planId', async () => {
      const response = await request(app)
        .post('/api/billing/checkout')
        .send({ planId: 'invalid' })
        .expect(404);
    });
  });

  describe('POST /api/billing/cancel', () => {
    test('should reject when no active subscription', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/billing/cancel')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should cancel active subscription', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        userId: 'test-user',
        plan: 'pro',
        status: 'active',
      });
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        userId: 'test-user',
        plan: 'free',
        status: 'canceled',
      });

      const response = await request(app)
        .post('/api/billing/cancel')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/billing/usage', () => {
    test('should return free plan usage when no subscription', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/billing/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('free');
    });

    test('should return usage records when subscription exists', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        userId: 'test-user',
        plan: 'pro',
        usageRecords: [{ type: 'signals', count: 42 }],
      });

      const response = await request(app)
        .get('/api/billing/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('pro');
      expect(response.body.data.usage).toHaveLength(1);
    });
  });
});
