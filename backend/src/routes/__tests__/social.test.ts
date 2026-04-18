/**
 * Social Route Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    sharedSignal: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    signalLike: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    signalComment: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
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
  BadRequestError: class BadRequestError extends Error {
    status = 400;
    constructor(msg: string) { super(msg); }
  },
}));

import { socialRouter } from '@/routes/social';
import { prisma } from '@/lib';

function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Social Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/social', socialRouter);
    app.use(errorHandler);
  });

  describe('GET /api/social/feed', () => {
    test('should return paginated feed', async () => {
      (prisma.sharedSignal.findMany as jest.Mock).mockResolvedValue([
        {
          id: 's1',
          userId: 'u1',
          commoditySlug: 'brisket_cn',
          signalType: 'BUY',
          confidence: 0.85,
          reasoning: 'Strong demand',
          currentPrice: 79.5,
          targetPrice: 85,
          likes: 5,
          commentsCount: 2,
          createdAt: new Date(),
          user: { id: 'u1', name: 'Alice', avatarUrl: null },
          _count: { signalComments: 2, signalLikes: 5 },
        },
      ]);
      (prisma.sharedSignal.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/social/feed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.feed).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    test('should return empty feed', async () => {
      (prisma.sharedSignal.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.sharedSignal.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/social/feed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.feed).toHaveLength(0);
    });
  });

  describe('POST /api/social/signals', () => {
    test('should create a shared signal', async () => {
      (prisma.sharedSignal.create as jest.Mock).mockResolvedValue({
        id: 's1',
        userId: 'test-user',
        commoditySlug: 'brisket_cn',
        signalType: 'BUY',
        confidence: 0.85,
        user: { id: 'test-user', name: 'Test User' },
      });

      const response = await request(app)
        .post('/api/social/signals')
        .send({
          commoditySlug: 'brisket_cn',
          signalType: 'BUY',
          confidence: 0.85,
          reasoning: 'Test signal',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid signal type', async () => {
      const response = await request(app)
        .post('/api/social/signals')
        .send({
          commoditySlug: 'brisket_cn',
          signalType: 'INVALID',
          confidence: 0.85,
        })
        .expect(500);
    });
  });

  describe('POST /api/social/signals/:id/like', () => {
    test('should add a like when none exists', async () => {
      (prisma.sharedSignal.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
      (prisma.signalLike.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const response = await request(app)
        .post('/api/social/signals/s1/like')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.liked).toBe(true);
    });

    test('should remove like when already liked', async () => {
      (prisma.sharedSignal.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
      (prisma.signalLike.findUnique as jest.Mock).mockResolvedValue({ id: 'like-1' });
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const response = await request(app)
        .post('/api/social/signals/s1/like')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.liked).toBe(false);
    });

    test('should return 404 for missing signal', async () => {
      (prisma.sharedSignal.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .post('/api/social/signals/missing/like')
        .expect(404);
    });
  });

  describe('GET /api/social/signals/:id/comments', () => {
    test('should return comments', async () => {
      (prisma.signalComment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'c1',
          content: 'Great signal!',
          user: { id: 'u1', name: 'Alice', avatarUrl: null },
          createdAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get('/api/social/signals/s1/comments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comments).toHaveLength(1);
    });
  });

  describe('POST /api/social/signals/:id/comments', () => {
    test('should add a comment', async () => {
      (prisma.sharedSignal.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
      (prisma.signalComment.create as jest.Mock).mockResolvedValue({
        id: 'c1',
        content: 'Nice analysis',
        user: { id: 'test-user', name: 'Test User' },
      });
      (prisma.sharedSignal.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/social/signals/s1/comments')
        .send({ content: 'Nice analysis' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject empty comment', async () => {
      const response = await request(app)
        .post('/api/social/signals/s1/comments')
        .send({ content: '' })
        .expect(500);
    });

    test('should return 404 for missing signal', async () => {
      (prisma.sharedSignal.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .post('/api/social/signals/missing/comments')
        .send({ content: 'Test' })
        .expect(404);
    });
  });
});
