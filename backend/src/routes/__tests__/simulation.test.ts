/**
 * Simulation Route Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    simulationAccount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    simulationOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    simulationTrade: {
      findMany: jest.fn(),
    },
    commodityPrice: {
      findFirst: jest.fn(),
    },
    commodity: {
      findUnique: jest.fn(),
    },
  },
  success: jest.fn((res, data, status) => {
    res.status(status || 200).json({ success: true, data });
  }),
}));

jest.mock('@/services/simulationEngine', () => ({
  executeMarketOrder: jest.fn().mockResolvedValue({ filledPrice: 79.5, filledQuantity: 10 }),
  getAccountSummary: jest.fn().mockResolvedValue({
    id: 'a1',
    name: 'Test Account',
    initialBalance: 100000,
    currentBalance: 105000,
    pnl: 5000,
    openTrades: 3,
    closedTrades: 10,
    pendingOrders: 1,
    recentTrades: [],
    recentOrders: [],
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

import { simulationRouter } from '@/routes/simulation';
import { prisma } from '@/lib';

function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { message: err.message } });
}

describe('Simulation Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/sim', simulationRouter);
    app.use(errorHandler);
  });

  describe('GET /api/sim/accounts', () => {
    test('should list user accounts', async () => {
      (prisma.simulationAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'a1',
          name: 'Main',
          initialBalance: 100000,
          currentBalance: 105000,
          isActive: true,
          createdAt: new Date(),
          _count: { orders: 15, trades: 10 },
        },
      ]);

      const response = await request(app)
        .get('/api/sim/accounts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accounts).toHaveLength(1);
      expect(response.body.data.accounts[0].pnl).toBe(5000);
    });
  });

  describe('POST /api/sim/accounts', () => {
    test('should create an account', async () => {
      (prisma.simulationAccount.create as jest.Mock).mockResolvedValue({
        id: 'a2',
        name: 'New Account',
        initialBalance: 100000,
        currentBalance: 100000,
      });

      const response = await request(app)
        .post('/api/sim/accounts')
        .send({ name: 'New Account', initialBalance: 100000 })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/sim/accounts/:id', () => {
    test('should return 404 for missing account', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/sim/accounts/missing')
        .expect(404);
    });

    test('should return account summary', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
      });

      const response = await request(app)
        .get('/api/sim/accounts/a1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.account.pnl).toBe(5000);
    });
  });

  describe('POST /api/sim/accounts/:id/orders', () => {
    const commodityId = '550e8400-e29b-41d4-a716-446655440000';

    test('should create and execute market order', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
        isActive: true,
        currentBalance: 100000,
      });
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({ id: commodityId });
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue({ close: 79.5 });
      (prisma.simulationOrder.create as jest.Mock).mockResolvedValue({
        id: 'o1',
        accountId: 'a1',
        commodityId,
        side: 'BUY',
        type: 'MARKET',
        quantity: 10,
        status: 'PENDING',
      });
      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'o1',
        status: 'FILLED',
        filledPrice: 79.5,
      });

      const response = await request(app)
        .post('/api/sim/accounts/a1/orders')
        .send({
          commodityId,
          side: 'BUY',
          type: 'MARKET',
          quantity: 10,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject order for inactive account', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
        isActive: false,
      });

      await request(app)
        .post('/api/sim/accounts/a1/orders')
        .send({ commodityId, side: 'BUY', type: 'MARKET', quantity: 10 })
        .expect(400);
    });

    test('should reject insufficient balance for BUY', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
        isActive: true,
        currentBalance: 100,
      });
      (prisma.commodity.findUnique as jest.Mock).mockResolvedValue({ id: commodityId });
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue({ close: 79.5 });

      await request(app)
        .post('/api/sim/accounts/a1/orders')
        .send({ commodityId, side: 'BUY', type: 'MARKET', quantity: 1000 })
        .expect(400);
    });
  });

  describe('GET /api/sim/accounts/:id/orders', () => {
    test('should list orders', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
      });
      (prisma.simulationOrder.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/sim/accounts/a1/orders')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/sim/accounts/:id/orders/:orderId', () => {
    test('should cancel pending order', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
      });
      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'o1',
        accountId: 'a1',
        status: 'PENDING',
      });
      (prisma.simulationOrder.update as jest.Mock).mockResolvedValue({
        id: 'o1',
        status: 'CANCELLED',
      });

      const response = await request(app)
        .patch('/api/sim/accounts/a1/orders/o1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject cancelling non-pending order', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
      });
      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'o1',
        accountId: 'a1',
        status: 'FILLED',
      });

      await request(app)
        .patch('/api/sim/accounts/a1/orders/o1')
        .expect(400);
    });
  });

  describe('GET /api/sim/accounts/:id/trades', () => {
    test('should list trades', async () => {
      (prisma.simulationAccount.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'test-user',
      });
      (prisma.simulationTrade.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          side: 'BUY',
          quantity: 10,
          entryPrice: 79.5,
          commodity: { slug: 'brisket_cn', name: 'Brisket', unit: 'CNY/kg' },
        },
      ]);

      const response = await request(app)
        .get('/api/sim/accounts/a1/trades')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trades).toHaveLength(1);
    });
  });
});
