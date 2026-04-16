/**
 * Prediction Cache Layer
 *
 * Caches AI prediction results in Redis so the dashboard loads in <2s
 * instead of waiting 30-60s for subprocess predictions.
 *
 * Key pattern: prediction:{commodityId}:{modelId}:{horizon}
 * TTL: 45 minutes (expires before next scheduled refresh)
 * Background refresh: every 30 minutes per commodity
 */

import { getRedisClient } from '@/lib/redis';
import { logger } from '../lib';
import { cacheKeys } from './cache';
import { iotdbAIService } from './iotdb/ai';

const PREDICTION_TTL_SECONDS = 45 * 60; // 45 minutes
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedPrediction {
  timestamps: number[];
  values: number[];
  lowerBound?: number[];
  upperBound?: number[];
  algorithm: string;
  cachedAt: number;
  commodityId: string;
  horizon: number;
}

interface CommoditySubscription {
  commodityId: string;
  timeseriesPath: string;
  models: string[];
  horizon: number;
}

// Active subscriptions for background refresh
const subscriptions = new Map<string, CommoditySubscription>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get a cached prediction, or return null if not cached/expired
 */
export async function getCachedPrediction(
  commodityId: string,
  modelId: string,
  horizon: number
): Promise<CachedPrediction | null> {
  const key = cacheKeys.prediction(commodityId, modelId, horizon);
  const client = await getRedisClient();

  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;

    return JSON.parse(raw) as CachedPrediction;
  } catch (error) {
    logger.error(`Prediction cache read error: ${error}`);
    return null;
  }
}

/**
 * Get all cached predictions for a commodity (all models)
 */
export async function getAllCachedPredictions(
  commodityId: string,
  horizon: number,
  models: string[]
): Promise<Map<string, CachedPrediction>> {
  const results = new Map<string, CachedPrediction>();

  await Promise.all(
    models.map(async (modelId) => {
      const cached = await getCachedPrediction(commodityId, modelId, horizon);
      if (cached) {
        results.set(modelId, cached);
      }
    })
  );

  return results;
}

/**
 * Run a prediction and cache the result
 */
export async function runAndCachePrediction(
  commodityId: string,
  timeseriesPath: string,
  modelId: string,
  horizon: number,
  confidenceLevel: number = 0.95
): Promise<CachedPrediction> {
  const key = cacheKeys.prediction(commodityId, modelId, horizon);

  try {
    const result = await iotdbAIService.predict({
      timeseries: timeseriesPath,
      horizon,
      algorithm: modelId as any,
      confidenceLevel,
    });

    const cached: CachedPrediction = {
      timestamps: result.timestamps,
      values: result.values,
      lowerBound: result.lowerBound,
      upperBound: result.upperBound,
      algorithm: modelId,
      cachedAt: Date.now(),
      commodityId,
      horizon,
    };

    const client = await getRedisClient();
    if (client) {
      await client.setEx(key, PREDICTION_TTL_SECONDS, JSON.stringify(cached));
    }

    // Log prediction for MAPE accuracy tracking (non-blocking)
    import('./mapeTracking').then(({ logPrediction }) => {
      logPrediction({
        modelId,
        commodityId,
        timeseriesPath,
        horizon,
        predictedValues: result.values,
        lowerBounds: result.lowerBound,
        upperBounds: result.upperBound,
      }).catch(() => { /* non-blocking */ });
    }).catch(() => { /* non-blocking */ });

    return cached;
  } catch (error) {
    logger.error(`Prediction failed for ${modelId}: ${error}`);
    throw error;
  }
}

/**
 * Refresh all predictions for a subscribed commodity
 */
async function refreshCommodityPredictions(sub: CommoditySubscription): Promise<void> {
  logger.info(`Refreshing predictions for ${sub.commodityId} (${sub.models.length} models)`);

  await Promise.allSettled(
    sub.models.map(async (modelId) => {
      try {
        await runAndCachePrediction(
          sub.commodityId,
          sub.timeseriesPath,
          modelId,
          sub.horizon
        );
      } catch (error) {
        logger.error(`Failed to refresh ${modelId} for ${sub.commodityId}: ${error}`);
      }
    })
  );
}

/**
 * Subscribe a commodity to background prediction refresh
 */
export function subscribeCommodity(
  commodityId: string,
  timeseriesPath: string,
  models: string[],
  horizon: number
): void {
  subscriptions.set(commodityId, {
    commodityId,
    timeseriesPath,
    models,
    horizon,
  });

  // Start background refresh timer if not already running
  if (!refreshTimer) {
    refreshTimer = setInterval(async () => {
      for (const sub of subscriptions.values()) {
        await refreshCommodityPredictions(sub);
      }
    }, REFRESH_INTERVAL_MS);

    // Don't block process exit
    if (refreshTimer.unref) {
      refreshTimer.unref();
    }
  }
}

/**
 * Unsubscribe a commodity from background refresh
 */
export function unsubscribeCommodity(commodityId: string): void {
  subscriptions.delete(commodityId);

  if (subscriptions.size === 0 && refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Get list of subscribed commodities
 */
export function getSubscribedCommodities(): string[] {
  return Array.from(subscriptions.keys());
}

/**
 * Invalidate all cached predictions for a commodity
 */
export async function invalidateCommodityCache(
  commodityId: string,
  horizon: number,
  models: string[]
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  await Promise.all(
    models.map(async (modelId) => {
      const key = cacheKeys.prediction(commodityId, modelId, horizon);
      await client.del(key);
    })
  );
}
