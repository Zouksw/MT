/**
 * Simulation Engine Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    simulationOrder: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    simulationAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    simulationTrade: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    commodityPrice: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn({
      simulationOrder: { update: jest.fn().mockResolvedValue({ id: 'order-1' }) },
      simulationAccount: { findUnique: jest.fn().mockResolvedValue({ currentBalance: 100000 }), update: jest.fn().mockResolvedValue({ id: 'acc-1' }) },
      simulationTrade: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-trade' }), create: jest.fn().mockResolvedValue({ id: 'trade-1' }) },
    })),
  },
}));

import { executeMarketOrder, checkLimitOrders } from '@/services/simulationEngine';
import { prisma } from '@/lib';

describe('simulationEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeMarketOrder', () => {
    it('should execute a BUY market order with slippage', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PENDING',
        side: 'BUY',
        type: 'MARKET',
        quantity: 10,
        commodityId: 'c-1',
        accountId: 'acc-1',
        commodity: { slug: 'brisket_cn' },
        account: { id: 'acc-1' },
      };

      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue({ close: 80.0 });

      const mockTxOrderUpdate = jest.fn().mockResolvedValue({ id: 'order-1' });
      const mockTxAccUpdate = jest.fn().mockResolvedValue({ id: 'acc-1' });
      const mockTxTradeCreate = jest.fn().mockResolvedValue({ id: 'trade-1' });

      (prisma.$transaction as jest.Mock).mockImplementation((fn) =>
        fn({
          simulationOrder: { update: mockTxOrderUpdate },
          simulationAccount: { findUnique: jest.fn().mockResolvedValue({ currentBalance: 100000 }), update: mockTxAccUpdate },
          simulationTrade: { findFirst: jest.fn().mockResolvedValue(null), create: mockTxTradeCreate },
        }),
      );

      const result = await executeMarketOrder('order-1');

      expect(result.orderId).toBe('order-1');
      expect(result.filledPrice).toBeCloseTo(80.04, 1); // 80 + 0.05% slippage
      expect(result.filledQuantity).toBe(10);
      expect(result.commission).toBeCloseTo(80.04 * 10 * 0.001, 2);
    });

    it('should throw for non-pending order', async () => {
      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'FILLED',
      });

      await expect(executeMarketOrder('order-1')).rejects.toThrow('not pending');
    });

    it('should throw for missing order', async () => {
      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(executeMarketOrder('order-1')).rejects.toThrow('not found');
    });

    it('should throw for missing price data', async () => {
      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'PENDING',
        side: 'BUY',
        commodityId: 'c-1',
        commodity: { slug: 'brisket_cn' },
        account: {},
      });
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(executeMarketOrder('order-1')).rejects.toThrow('No price data');
    });
  });

  describe('checkLimitOrders', () => {
    it('should execute LIMIT BUY when price drops to target', async () => {
      (prisma.simulationOrder.findMany as jest.Mock).mockResolvedValue([{
        id: 'order-2',
        status: 'PENDING',
        type: 'LIMIT',
        side: 'BUY',
        price: 75.0,
        stopPrice: null,
        commodityId: 'c-1',
        commodity: { slug: 'brisket_cn' },
      }]);
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue({ close: 74.0 });

      // Mock executeMarketOrder indirectly by mocking $transaction
      (prisma.simulationOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-2',
        status: 'PENDING',
        side: 'BUY',
        quantity: 10,
        commodityId: 'c-1',
        accountId: 'acc-1',
        commodity: { slug: 'brisket_cn' },
        account: { id: 'acc-1' },
      });

      (prisma.$transaction as jest.Mock).mockImplementation((fn) =>
        fn({
          simulationOrder: { update: jest.fn().mockResolvedValue({ id: 'order-2' }) },
          simulationAccount: { findUnique: jest.fn().mockResolvedValue({ currentBalance: 100000 }), update: jest.fn().mockResolvedValue({ id: 'acc-1' }) },
          simulationTrade: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'trade-2' }) },
        }),
      );

      const executed = await checkLimitOrders();
      expect(executed).toBe(1);
    });

    it('should not execute when price has not reached target', async () => {
      (prisma.simulationOrder.findMany as jest.Mock).mockResolvedValue([{
        id: 'order-3',
        status: 'PENDING',
        type: 'LIMIT',
        side: 'BUY',
        price: 75.0,
        stopPrice: null,
        commodityId: 'c-1',
        commodity: { slug: 'brisket_cn' },
      }]);
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue({ close: 80.0 });

      const executed = await checkLimitOrders();
      expect(executed).toBe(0);
    });

    it('should return 0 when no pending orders', async () => {
      (prisma.simulationOrder.findMany as jest.Mock).mockResolvedValue([]);

      const executed = await checkLimitOrders();
      expect(executed).toBe(0);
    });
  });
});
