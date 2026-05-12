/**
 * Prediction Cache Layer
 *
 * Caches AI prediction results in Redis so the dashboard loads in <2s
 * instead of waiting for inference service predictions.
 *
 * Key pattern: prediction:{commodityId}:{modelId}:{horizon}
 * TTL: 45 minutes (expires before next scheduled refresh)
 * Background refresh: every 30 minutes per commodity
 */

import { logger, prisma } from "@/lib";
import { getRedisClient } from "@/lib/redis";
import { cacheKeys } from "./cache";
import { predict } from "./inference/client";
import { getCommodityPriceValues } from "./inference/data-fetcher";
import { getAllModels } from "./tradingSignals";

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
	horizon: number,
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
	models: string[],
): Promise<Map<string, CachedPrediction>> {
	const results = new Map<string, CachedPrediction>();

	await Promise.all(
		models.map(async (modelId) => {
			const cached = await getCachedPrediction(commodityId, modelId, horizon);
			if (cached) {
				results.set(modelId, cached);
			}
		}),
	);

	return results;
}

/**
 * Run a prediction and cache the result
 */
export async function runAndCachePrediction(
	commodityId: string,
	modelId: string,
	horizon: number,
	confidenceLevel: number = 0.95,
): Promise<CachedPrediction> {
	const key = cacheKeys.prediction(commodityId, modelId, horizon);

	try {
		const { values, timestamps } = await getCommodityPriceValues(commodityId, 200);

		const result = await predict({
			values,
			timestamps,
			model_id: modelId,
			horizon,
			confidence_level: confidenceLevel,
		});

		const cached: CachedPrediction = {
			timestamps: result.timestamps,
			values: result.values,
			lowerBound: result.lower_bound ?? undefined,
			upperBound: result.upper_bound ?? undefined,
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
		import("./mapeTracking")
			.then(({ logPrediction }) => {
				logPrediction({
					modelId,
					commodityId,
					horizon,
					predictedValues: result.values,
					lowerBounds: result.lower_bound ?? undefined,
					upperBounds: result.upper_bound ?? undefined,
				}).catch(() => {
					/* non-blocking */
				});
			})
			.catch(() => {
				/* non-blocking */
			});

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
				await runAndCachePrediction(sub.commodityId, modelId, sub.horizon);
			} catch (error) {
				logger.error(`Failed to refresh ${modelId} for ${sub.commodityId}: ${error}`);
			}
		}),
	);
}

/**
 * Subscribe a commodity to background prediction refresh
 */
export function subscribeCommodity(commodityId: string, models: string[], horizon: number): void {
	subscriptions.set(commodityId, {
		commodityId,
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
	models: string[],
): Promise<void> {
	const client = await getRedisClient();
	if (!client) return;

	await Promise.all(
		models.map(async (modelId) => {
			const key = cacheKeys.prediction(commodityId, modelId, horizon);
			await client.del(key);
		}),
	);
}

/**
 * Schedule predictions for all active commodities
 */
export async function schedulePredictionsFromPostgreSQL(): Promise<number> {
	const commodities = await prisma.commodity.findMany({
		where: { isActive: true },
		select: { id: true },
	});

	const MODELS = getAllModels();

	for (const commodity of commodities) {
		subscribeCommodity(commodity.id, MODELS, 10);
	}

	return commodities.length;
}
