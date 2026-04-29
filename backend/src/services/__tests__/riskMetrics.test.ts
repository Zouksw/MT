/**
 * Risk Metrics Tests
 */

import { describe, it, expect } from 'vitest';
import {
  sharpeRatio,
  sortinoRatio,
  maxDrawdown,
  valueAtRisk,
  calmarRatio,
  winRate,
  profitFactor,
  computeRiskReport,
} from '@/services/riskMetrics';

describe('Risk Metrics', () => {
  describe('sharpeRatio', () => {
    it('should compute positive Sharpe for positive returns', () => {
      const returns = [0.01, 0.02, 0.015, 0.005, 0.02];
      const sharpe = sharpeRatio(returns);
      expect(sharpe).toBeGreaterThan(0);
    });

    it('should return 0 for empty returns', () => {
      expect(sharpeRatio([])).toBe(0);
      expect(sharpeRatio([0.01])).toBe(0);
    });

    it('should return 0 for constant returns (zero std dev)', () => {
      expect(sharpeRatio([0.01, 0.01, 0.01])).toBe(0);
    });

    it('should be negative for losing returns', () => {
      const returns = [-0.02, -0.01, -0.03];
      expect(sharpeRatio(returns)).toBeLessThan(0);
    });
  });

  describe('sortinoRatio', () => {
    it('should compute Sortino for mixed returns', () => {
      const returns = [0.02, -0.01, 0.03, -0.005, 0.01];
      const sortino = sortinoRatio(returns);
      expect(sortino).toBeGreaterThan(0);
    });

    it('should return Infinity for all positive returns', () => {
      const returns = [0.01, 0.02, 0.03];
      expect(sortinoRatio(returns)).toBe(Infinity);
    });

    it('should return 0 for empty array', () => {
      expect(sortinoRatio([])).toBe(0);
    });
  });

  describe('maxDrawdown', () => {
    it('should compute max drawdown', () => {
      const equity = [100, 110, 105, 115, 100, 120];
      const dd = maxDrawdown(equity);
      expect(dd.maxDD).toBeLessThan(0);
      expect(dd.maxDD).toBeCloseTo(-0.1304, 2); // (115 -> 100) / 115
    });

    it('should return 0 for monotonically increasing', () => {
      const dd = maxDrawdown([100, 110, 120, 130]);
      expect(Math.abs(dd.maxDD)).toBe(0);
    });

    it('should handle single element', () => {
      const dd = maxDrawdown([100]);
      expect(dd.maxDD).toBe(0);
    });

    it('should handle empty array', () => {
      const dd = maxDrawdown([]);
      expect(dd.maxDD).toBe(0);
    });
  });

  describe('valueAtRisk', () => {
    it('should compute VaR at 95% confidence', () => {
      const returns = Array.from({ length: 100 }, (_, i) => (i - 50) * 0.001);
      const var95 = valueAtRisk(returns, 0.95);
      expect(var95).toBeLessThan(0);
    });

    it('should return 0 for insufficient data', () => {
      expect(valueAtRisk([0.01, 0.02])).toBe(0);
    });
  });

  describe('calmarRatio', () => {
    it('should compute Calmar ratio', () => {
      const calmar = calmarRatio(0.15, -0.10);
      expect(calmar).toBeCloseTo(1.5);
    });

    it('should return Infinity for zero drawdown with positive return', () => {
      expect(calmarRatio(0.15, 0)).toBe(Infinity);
    });

    it('should return 0 for zero drawdown with no return', () => {
      expect(calmarRatio(0, 0)).toBe(0);
    });
  });

  describe('winRate', () => {
    it('should compute win rate', () => {
      const trades = [
        { realizedPnl: 100 },
        { realizedPnl: -50 },
        { realizedPnl: 200 },
        { realizedPnl: -30 },
      ];
      expect(winRate(trades)).toBe(0.5);
    });

    it('should return 0 for no closed trades', () => {
      expect(winRate([])).toBe(0);
      expect(winRate([{ realizedPnl: null }])).toBe(0);
    });

    it('should return 1 for all wins', () => {
      expect(winRate([{ realizedPnl: 100 }, { realizedPnl: 50 }])).toBe(1);
    });
  });

  describe('profitFactor', () => {
    it('should compute profit factor', () => {
      const trades = [
        { realizedPnl: 200 },
        { realizedPnl: -100 },
      ];
      expect(profitFactor(trades)).toBe(2);
    });

    it('should return Infinity for no losses', () => {
      expect(profitFactor([{ realizedPnl: 100 }])).toBe(Infinity);
    });

    it('should return 0 for no trades', () => {
      expect(profitFactor([])).toBe(0);
    });
  });

  describe('computeRiskReport', () => {
    it('should compute full risk report', () => {
      const dailyReturns = [0.01, -0.005, 0.02, -0.01, 0.015, 0.005, -0.003, 0.01];
      const trades = [
        { realizedPnl: 100 },
        { realizedPnl: -50 },
        { realizedPnl: 200 },
      ];

      const report = computeRiskReport(dailyReturns, trades);

      expect(report.sharpe).toBeDefined();
      expect(report.sortino).toBeDefined();
      expect(report.maxDrawdown).toBeLessThan(0);
      expect(report.var95).toBeDefined();
      expect(report.var99).toBeDefined();
      expect(report.winRate).toBeCloseTo(0.667, 1);
      expect(report.profitFactor).toBeCloseTo(6, 0);
      expect(report.totalTrades).toBe(3);
      expect(report.avgTrade).toBeCloseTo(83.33, 0);
      expect(report.annualizedReturn).toBeDefined();
    });

    it('should handle empty data', () => {
      const report = computeRiskReport([], []);
      expect(report.sharpe).toBe(0);
      expect(report.totalTrades).toBe(0);
    });
  });
});
