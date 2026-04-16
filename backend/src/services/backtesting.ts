/**
 * Model Backtesting Service
 *
 * Compares past predictions against actual outcomes.
 * Uses the existing mapeTracking.ts PredictionLog infrastructure.
 *
 * Computes MAPE over 7/30/90 day windows and identifies
 * accuracy trends (improving/stable/degrading).
 */

import { prisma } from '@/lib';
import { logger } from '@/lib';

export interface BacktestWindow {
  days: number;
  mape: number | null;
  predictionCount: number;
  verifiedCount: number;
}

export interface BacktestResult {
  modelId: string;
  commodityId: string | null;
  windows: BacktestWindow[];
  trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
  trendDescription: string;
  generatedAt: string;
}

/**
 * Run backtest for a specific model
 */
export async function runBacktest(
  modelId: string,
  commodityId?: string,
  windows: number[] = [7, 30, 90]
): Promise<BacktestResult> {
  const windowResults: BacktestWindow[] = [];

  for (const days of windows) {
    const since = new Date(Date.now() - days * 86400000);

    const where: any = {
      modelId,
      status: 'verified',
      verifiedAt: { gte: since },
    };
    if (commodityId) where.commodityId = commodityId;

    const verified = await prisma.predictionLog.findMany({
      where,
      select: { mape: true, verifiedAt: true },
      orderBy: { verifiedAt: 'desc' },
    });

    const totalCount = await prisma.predictionLog.count({
      where: {
        modelId,
        ...(commodityId ? { commodityId } : {}),
        predictedAt: { gte: since },
      },
    });

    let mape: number | null = null;
    if (verified.length > 0) {
      const sum = verified.reduce((s, l) => s + (l.mape?.toNumber() ?? 0), 0);
      mape = Math.round((sum / verified.length) * 100) / 100;
    }

    windowResults.push({
      days,
      mape,
      predictionCount: totalCount,
      verifiedCount: verified.length,
    });
  }

  // Determine trend by comparing recent (7d) vs longer (90d) MAPE
  const trend = computeTrend(windowResults);

  return {
    modelId,
    commodityId: commodityId ?? null,
    windows: windowResults,
    trend: trend.direction,
    trendDescription: trend.description,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Compare recent accuracy vs long-term to detect trends
 */
function computeTrend(windows: BacktestWindow[]): {
  direction: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
  description: string;
} {
  const recent = windows.find((w) => w.days === 7);
  const longTerm = windows.find((w) => w.days === 90);

  if (!recent?.mape || !longTerm?.mape) {
    return {
      direction: 'insufficient_data',
      description: 'Not enough verified predictions to determine trend',
    };
  }

  const delta = recent.mape - longTerm.mape;

  // Lower MAPE = better. Negative delta = improving.
  if (delta < -1) {
    return {
      direction: 'improving',
      description: `MAPE improved by ${Math.abs(delta).toFixed(2)}pp (7d: ${recent.mape}% vs 90d: ${longTerm.mape}%)`,
    };
  }

  if (delta > 1) {
    return {
      direction: 'degrading',
      description: `MAPE worsened by ${delta.toFixed(2)}pp (7d: ${recent.mape}% vs 90d: ${longTerm.mape}%)`,
    };
  }

  return {
    direction: 'stable',
    description: `MAPE stable within 1pp (7d: ${recent.mape}% vs 90d: ${longTerm.mape}%)`,
  };
}
