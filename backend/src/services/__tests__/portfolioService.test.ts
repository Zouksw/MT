/**
 * Portfolio Service Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  prisma: {
    position: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    commodityPrice: {
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  },
}));

import { computePortfolioPnL, updatePositionPrices } from '@/services/portfolioService';
import { prisma } from '@/lib';

describe('portfolioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computePortfolioPnL', () => {
    it('should compute P&L for long position', async () => {
      (prisma.position.findMany as jest.Mock).mockResolvedValue([{
        id: 'pos-1',
        side: 'LONG',
        quantity: 100,
        avgEntryPrice: 50.0,
        currentPrice: 55.0,
        unrealizedPnl: 500,
        realizedPnl: 0,
        closedAt: null,
        commodity: { slug: 'brisket_cn', name: 'Brisket', unit: 'CNY/kg' },
      }]);

      const result = await computePortfolioPnL('portfolio-1');

      expect(result.totalUnrealizedPnl).toBe(500);
      expect(result.totalPnl).toBe(500);
      expect(result.longCount).toBe(1);
      expect(result.shortCount).toBe(0);
      expect(result.positionCount).toBe(1);
    });

    it('should compute P&L for short position', async () => {
      (prisma.position.findMany as jest.Mock).mockResolvedValue([{
        id: 'pos-2',
        side: 'SHORT',
        quantity: 50,
        avgEntryPrice: 60.0,
        currentPrice: 55.0,
        unrealizedPnl: 250,
        realizedPnl: 0,
        closedAt: null,
        commodity: { slug: 'corn', name: 'Corn', unit: 'CNY/ton' },
      }]);

      const result = await computePortfolioPnL('portfolio-1');

      expect(result.totalUnrealizedPnl).toBe(250);
      expect(result.shortCount).toBe(1);
    });

    it('should handle empty portfolio', async () => {
      (prisma.position.findMany as jest.Mock).mockResolvedValue([]);

      const result = await computePortfolioPnL('portfolio-1');

      expect(result.totalPnl).toBe(0);
      expect(result.positionCount).toBe(0);
    });

    it('should aggregate multiple positions', async () => {
      (prisma.position.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pos-1',
          side: 'LONG',
          quantity: 100,
          avgEntryPrice: 50.0,
          currentPrice: 55.0,
          unrealizedPnl: 500,
          realizedPnl: 100,
          closedAt: null,
          commodity: { slug: 'brisket_cn', name: 'Brisket', unit: 'CNY/kg' },
        },
        {
          id: 'pos-2',
          side: 'SHORT',
          quantity: 50,
          avgEntryPrice: 60.0,
          currentPrice: 58.0,
          unrealizedPnl: 100,
          realizedPnl: -50,
          closedAt: null,
          commodity: { slug: 'corn', name: 'Corn', unit: 'CNY/ton' },
        },
      ]);

      const result = await computePortfolioPnL('portfolio-1');

      expect(result.totalUnrealizedPnl).toBe(600);
      expect(result.totalRealizedPnl).toBe(50);
      expect(result.totalPnl).toBe(650);
      expect(result.longCount).toBe(1);
      expect(result.shortCount).toBe(1);
    });
  });

  describe('updatePositionPrices', () => {
    it('should batch update positions when price exists', async () => {
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue({
        close: 80.0,
      });
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(1);

      await updatePositionPrices('c-1');

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should skip when no price exists', async () => {
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue(null);

      await updatePositionPrices('c-1');

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should handle zero updated positions', async () => {
      (prisma.commodityPrice.findFirst as jest.Mock).mockResolvedValue({
        close: 80.0,
      });
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(0);

      await updatePositionPrices('c-1');

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });
});
