/**
 * MAPE Logging & Model Accuracy Tracking
 *
 * Logs every prediction. When actual data arrives, computes MAPE
 * (Mean Absolute Percentage Error) and stores accuracy metrics.
 *
 * MAPE = (1/n) * Σ(|actual - predicted| / |actual|) * 100
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib';
import { logger } from '@/lib';

export interface LogPredictionParams {
  modelId: string;
  commodityId: string;
  timeseriesPath: string;
  horizon: number;
  predictedValues: number[];
  lowerBounds?: number[];
  upperBounds?: number[];
  confidence?: number;
}

/**
 * Log a prediction for later accuracy verification
 */
export async function logPrediction(params: LogPredictionParams): Promise<string> {
  const log = await prisma.predictionLog.create({
    data: {
      modelId: params.modelId,
      commodityId: params.commodityId,
      timeseriesPath: params.timeseriesPath,
      horizon: params.horizon,
      predictedValues: params.predictedValues,
      lowerBounds: params.lowerBounds ?? undefined,
      upperBounds: params.upperBounds ?? undefined,
      confidence: params.confidence ?? undefined,
      status: 'pending',
    },
  });

  return log.id;
}

/**
 * Verify a prediction against actual values and compute MAPE
 */
export async function verifyPrediction(
  logId: string,
  actualValues: number[]
): Promise<{ mape: number } | null> {
  const log = await prisma.predictionLog.findUnique({ where: { id: logId } });
  if (!log) return null;

  const predicted = log.predictedValues as number[];
  if (!Array.isArray(predicted) || predicted.length === 0) return null;

  // Compute MAPE over the overlapping range
  const n = Math.min(predicted.length, actualValues.length);
  if (n === 0) return null;

  let sumAbsPctError = 0;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    const actual = actualValues[i];
    const pred = predicted[i];
    if (actual !== 0 && isFinite(actual) && isFinite(pred)) {
      sumAbsPctError += Math.abs((actual - pred) / actual);
      validCount++;
    }
  }

  if (validCount === 0) return null;

  const mape = (sumAbsPctError / validCount) * 100;

  await prisma.predictionLog.update({
    where: { id: logId },
    data: {
      actualValues: actualValues,
      mape: Math.round(mape * 10000) / 10000,
      status: 'verified',
      verifiedAt: new Date(),
    },
  });

  return { mape: Math.round(mape * 100) / 100 };
}

/**
 * Get model accuracy (average MAPE) over a time window
 */
export async function getModelAccuracy(
  modelId: string,
  commodityId?: string,
  days: number = 30
): Promise<{
  modelId: string;
  avgMape: number | null;
  predictionCount: number;
  verifiedCount: number;
  last7dMape: number | null;
  last30dMape: number | null;
}> {
  const since = new Date(Date.now() - days * 86400000);

  const where: Prisma.PredictionLogWhereInput = {
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
    where: { modelId, ...(commodityId ? { commodityId } : {}), predictedAt: { gte: since } },
  });

  const computeAvg = (logs: typeof verified) => {
    if (logs.length === 0) return null;
    const sum = logs.reduce((s, l) => s + (l.mape?.toNumber() ?? 0), 0);
    return Math.round((sum / logs.length) * 100) / 100;
  };

  const last7d = new Date(Date.now() - 7 * 86400000);
  const last7dLogs = verified.filter((l) => l.verifiedAt && l.verifiedAt >= last7d);

  return {
    modelId,
    avgMape: computeAvg(verified),
    predictionCount: totalCount,
    verifiedCount: verified.length,
    last7dMape: computeAvg(last7dLogs),
    last30dMape: computeAvg(verified),
  };
}

/**
 * Get accuracy for all models (for comparison view)
 */
export async function getAllModelAccuracy(
  commodityId?: string,
  days: number = 30
): Promise<Array<{
  modelId: string;
  avgMape: number | null;
  predictionCount: number;
  verifiedCount: number;
}>> {
  const models = ['arima', 'holtwinters', 'exponential_smoothing', 'naive_forecaster', 'stl_forecaster', 'timer_xl', 'sundial'];

  const results = await Promise.all(
    models.map(async (modelId) => {
      const accuracy = await getModelAccuracy(modelId, commodityId, days);
      return {
        modelId,
        avgMape: accuracy.avgMape,
        predictionCount: accuracy.predictionCount,
        verifiedCount: accuracy.verifiedCount,
      };
    })
  );

  return results;
}
