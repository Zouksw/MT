/**
 * Community Route Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    simulationAccount: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
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
  NotFoundError: class NotFoundError extends Error {
    status = 404;
    constructor(msg: string) { super(msg); }
  },
}));

import { communityRouter } from '@/routes/community';
import { prisma } from '@/lib';

function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Community Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/community', communityRouter);
    app.use(errorHandler);
  });

  describe('GET /api/community/leaderboard', () => {
    test('should return empty leaderboard', async () => {
      (prisma.simulationAccount.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/community/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toHaveLength(0);
    });

    test('should return ranked accounts', async () => {
      (prisma.simulationAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'a1',
          userId: 'u1',
          name: 'Top Trader',
          initialBalance: 100000,
          currentBalance: 120000,
          user: { id: 'u1', name: 'Alice', avatarUrl: null },
          _count: { trades: 50 },
        },
        {
          id: 'a2',
          userId: 'u2',
          name: 'Second',
          initialBalance: 100000,
          currentBalance: 105000,
          user: { id: 'u2', name: 'Bob', avatarUrl: null },
          _count: { trades: 20 },
        },
      ]);

      const response = await request(app)
        .get('/api/community/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toHaveLength(2);
      expect(response.body.data.leaderboard[0].rank).toBe(1);
      expect(response.body.data.leaderboard[0].pnl).toBe(20000);
      expect(response.body.data.leaderboard[1].rank).toBe(2);
    });
  });

  describe('GET /api/community/profile/:userId', () => {
    test('should return null for missing user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/community/profile/nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toBeNull();
    });

    test('should return user profile with accounts and signals', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        avatarUrl: null,
        createdAt: new Date(),
        simAccounts: [{
          name: 'Main',
          initialBalance: 100000,
          currentBalance: 110000,
          _count: { trades: 30 },
        }],
        sharedSignals: [{
          commoditySlug: 'brisket_cn',
          signalType: 'BUY',
          confidence: 0.85,
          likes: 5,
          commentsCount: 2,
          createdAt: new Date(),
        }],
        _count: { sharedSignals: 10, signalLikes: 20 },
      });

      const response = await request(app)
        .get('/api/community/profile/u1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.name).toBe('Alice');
      expect(response.body.data.profile.signalCount).toBe(10);
      expect(response.body.data.profile.accounts).toHaveLength(1);
      expect(response.body.data.profile.accounts[0].pnl).toBe(10000);
      expect(response.body.data.profile.recentSignals).toHaveLength(1);
    });
  });
});
