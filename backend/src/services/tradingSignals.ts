/**
 * Trading Signal Engine v2 — Multi-Model Ensemble
 *
 * Generates BUY/SELL/HOLD signals from multiple AI model predictions.
 * Uses Promise.allSettled for parallel execution — failed models don't block others.
 *
 * Signal logic (from design doc):
 * - Confidence = 1 - (upperBound - lowerBound) / currentPrice, clamped to [0, 1]
 * - BUY:  predicted increase > 1% AND confidence > 70%
 * - SELL: predicted decrease > 1% AND confidence > 70%
 * - HOLD: change < 1% OR confidence < 70%
 * - Consensus: count signals across all returning models, show distribution
 */

import { getCachedPrediction, runAndCachePrediction } from './predictionCache';
import { logger } from '../lib';

// All 7 AI Node models. TIMER_XL/SUNDIAL may be unavailable.
const ALL_MODELS = [
  'arima',
  'holtwinters',
  'exponential_smoothing',
  'naive_forecaster',
  'stl_forecaster',
  'timer_xl',
  'sundial',
] as const;

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface ModelSignal {
  modelId: string;
  type: SignalType;
  predictedChange: number;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  status: 'available' | 'unavailable';
  error?: string;
}

export interface TradingSignal {
  type: SignalType;
  confidence: number;
  modelsAgree: number;
  totalModels: number;
  availableModels: number;
  predictedDirection: number;
  supportLevel: number;
  resistanceLevel: number;
  individualSignals: ModelSignal[];
  distribution: { buy: number; sell: number; hold: number };
  timestamp: string;
}

export interface SignalRequest {
  commodityId: string;
  timeseriesPath: string;
  horizon: number;
  currentPrice: number;
  models?: string[];
}

/**
 * Calculate model confidence from prediction bounds
 */
function calculateConfidence(
  currentPrice: number,
  lowerBound?: number[],
  upperBound?: number[]
): number {
  if (!lowerBound?.length || !upperBound?.length) {
    return 0.5; // Default when no bounds available
  }

  // Use last prediction's bounds
  const lower = lowerBound[lowerBound.length - 1];
  const upper = upperBound[upperBound.length - 1];

  if (currentPrice <= 0) return 0.5;

  // Confidence = 1 - (spread / price), clamped to [0, 1]
  const spread = upper - lower;
  const rawConfidence = 1 - spread / currentPrice;
  return Math.max(0, Math.min(1, rawConfidence));
}

/**
 * Classify a prediction into BUY/SELL/HOLD
 */
function classifySignal(
  predictedChange: number,
  confidence: number
): SignalType {
  if (predictedChange > 1 && confidence > 0.7) return 'BUY';
  if (predictedChange < -1 && confidence > 0.7) return 'SELL';
  return 'HOLD';
}

/**
 * Generate trading signal from multiple model predictions (parallel, fault-tolerant)
 */
export async function generateSignal(req: SignalRequest): Promise<TradingSignal> {
  const models = req.models || ALL_MODELS;
  const horizon = req.horizon || 10;
  const currentPrice = req.currentPrice;

  if (!currentPrice || currentPrice <= 0) {
    throw new Error('Valid current price is required');
  }

  // Execute all models in parallel — failed models become "unavailable"
  const results = await Promise.allSettled(
    models.map(async (modelId): Promise<ModelSignal> => {
      try {
        let prediction = await getCachedPrediction(req.commodityId, modelId, horizon);

        if (!prediction) {
          prediction = await runAndCachePrediction(
            req.commodityId,
            req.timeseriesPath,
            modelId,
            horizon
          );
        }

        if (!prediction.values?.length) {
          return {
            modelId,
            type: 'HOLD',
            predictedChange: 0,
            currentValue: currentPrice,
            predictedValue: currentPrice,
            confidence: 0,
            status: 'unavailable',
            error: 'Empty prediction result',
          };
        }

        const lastPredicted = prediction.values[prediction.values.length - 1];
        const predictedChange = ((lastPredicted - currentPrice) / currentPrice) * 100;
        const confidence = calculateConfidence(
          currentPrice,
          prediction.lowerBound,
          prediction.upperBound
        );

        return {
          modelId,
          type: classifySignal(predictedChange, confidence),
          predictedChange: Math.round(predictedChange * 100) / 100,
          currentValue: currentPrice,
          predictedValue: lastPredicted,
          confidence: Math.round(confidence * 100) / 100,
          status: 'available',
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`Model ${modelId} failed: ${msg}`);
        return {
          modelId,
          type: 'HOLD',
          predictedChange: 0,
          currentValue: currentPrice,
          predictedValue: currentPrice,
          confidence: 0,
          status: 'unavailable',
          error: msg,
        };
      }
    })
  );

  // Collect results
  const individualSignals: ModelSignal[] = results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      modelId: 'unknown',
      type: 'HOLD' as SignalType,
      predictedChange: 0,
      currentValue: currentPrice,
      predictedValue: currentPrice,
      confidence: 0,
      status: 'unavailable' as const,
      error: r.reason?.message || 'Unknown error',
    };
  });

  const availableSignals = individualSignals.filter((s) => s.status === 'available');
  const availableCount = availableSignals.length;

  // All models failed
  if (availableCount === 0) {
    return {
      type: 'HOLD',
      confidence: 0,
      modelsAgree: 0,
      totalModels: models.length,
      availableModels: 0,
      predictedDirection: 0,
      supportLevel: currentPrice,
      resistanceLevel: currentPrice,
      individualSignals,
      distribution: { buy: 0, sell: 0, hold: 0 },
      timestamp: new Date().toISOString(),
    };
  }

  // Count signals
  const buyCount = availableSignals.filter((s) => s.type === 'BUY').length;
  const sellCount = availableSignals.filter((s) => s.type === 'SELL').length;
  const holdCount = availableCount - buyCount - sellCount;

  // Determine consensus
  let consensusType: SignalType = 'HOLD';
  let modelsAgree = holdCount;

  if (buyCount > sellCount && buyCount >= Math.ceil(availableCount / 2)) {
    consensusType = 'BUY';
    modelsAgree = buyCount;
  } else if (sellCount > buyCount && sellCount >= Math.ceil(availableCount / 2)) {
    consensusType = 'SELL';
    modelsAgree = sellCount;
  }

  // Confidence = agreement ratio + magnitude bonus
  const agreementRatio = modelsAgree / availableCount;
  const avgMagnitude = Math.abs(
    availableSignals.reduce((sum, s) => sum + s.predictedChange, 0) / availableCount
  );
  const consensusConfidence = Math.min(
    1,
    agreementRatio * 0.7 + Math.min(avgMagnitude / 5, 1) * 0.3
  );

  // Support & resistance
  const supportLevel = availableSignals
    .filter((s) => s.type !== 'SELL')
    .reduce((min, s) => Math.min(min, s.predictedValue), currentPrice * 0.95);

  const resistanceLevel = availableSignals
    .filter((s) => s.type !== 'BUY')
    .reduce((max, s) => Math.max(max, s.predictedValue), currentPrice * 1.05);

  const predictedDirection =
    availableSignals.reduce((sum, s) => sum + s.predictedChange, 0) / availableCount;

  return {
    type: consensusType,
    confidence: Math.round(consensusConfidence * 100) / 100,
    modelsAgree,
    totalModels: models.length,
    availableModels: availableCount,
    predictedDirection: Math.round(predictedDirection * 100) / 100,
    supportLevel: Math.round(supportLevel * 100) / 100,
    resistanceLevel: Math.round(resistanceLevel * 100) / 100,
    individualSignals,
    distribution: { buy: buyCount, sell: sellCount, hold: holdCount },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get all model IDs
 */
export function getAllModels(): string[] {
  return [...ALL_MODELS];
}
