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
import { getBeefCutSeries, isCutSeriesKey, parseCutSeriesKey } from "./beefCutSeries";
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
		// Dual-backend: if commodityId is a virtual cut-series key
		// (cut:{factoryId}:{cutCode}), extract the series from BeefCutPrice
		// instead of CommodityPrice. This lets the same consensus/MAPE pipeline
		// forecast a beef cut — closing the architecture gap where predictions
		// only ran on macro commodities. See services/beefCutSeries.ts.
		let values: number[];
		let timestamps: number[];
		if (isCutSeriesKey(commodityId)) {
			const parsed = parseCutSeriesKey(commodityId);
			if (!parsed) {
				throw new Error(`Malformed cut-series key: ${commodityId}`);
			}
			({ values, timestamps } = await getBeefCutSeries({
				factoryId: parsed.factoryId,
				cutCode: parsed.cutCode,
			}));
		} else {
			({ values, timestamps } = await getCommodityPriceValues(commodityId, 200));
		}

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

		// Log prediction for MAPE accuracy tracking (non-blocking).
		// Failures here must not break the cached prediction (the caller still
		// gets a result), but they MUST be observable — a silent swallow leaves
		// prediction_logs with gaps and hides a broken DB write path. Log the
		// error with enough context to diagnose, then move on.
		import("./mapeTracking")
			.then(({ logPrediction }) => {
				logPrediction({
					modelId,
					commodityId,
					horizon,
					predictedValues: result.values,
					lowerBounds: result.lower_bound ?? undefined,
					upperBounds: result.upper_bound ?? undefined,
				}).catch((error) => {
					logger.error(
						`Failed to log prediction for ${modelId}/${commodityId} (MAPE tracking): ${error}`,
					);
				});
			})
			.catch((error) => {
				logger.error(`Failed to load mapeTracking module: ${error}`);
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
 * Schedule predictions for active commodities that actually have price data.
 *
 * Previously this subscribed ALL active commodities (111), but 64% had zero
 * CommodityPrice rows — every 30-min refresh fired 3 model predictions that
 * all failed with "Insufficient price data", wasting inference-service work
 * and polluting logs. Now we only subscribe commodities with ≥2 daily prices
 * (the inference engine's minimum for fitting a model).
 */
export async function schedulePredictionsFromPostgreSQL(): Promise<number> {
	// Sub-query: commodities that have at least 2 daily price rows. The
	// inference engine needs ≥2 points to fit any model; fewer is guaranteed
	// to fail, so we exclude them upfront.
	const commodities = await prisma.commodity.findMany({
		where: {
			isActive: true,
			prices: { some: { interval: "daily" } },
		},
		select: {
			id: true,
			_count: { select: { prices: { where: { interval: "daily" } } } },
		},
	});

	const MODELS = getAllModels();
	let subscribed = 0;
	for (const commodity of commodities) {
		// _count.prices is the daily-price count for this commodity
		if (commodity._count.prices >= 2) {
			subscribeCommodity(commodity.id, MODELS, 10);
			subscribed++;
		}
	}

	const skipped = commodities.length - subscribed;
	logger.info(
		`[PREDICT] Subscribed ${subscribed} commodities to prediction refresh (${skipped} had <2 daily prices, skipped)`,
	);

	return subscribed;
}

/**
 * Schedule predictions for beef CUTS — the dual-backend path.
 *
 * Mirrors schedulePredictionsFromPostgreSQL but for BeefCutPrice series
 * addressed by the virtual key cut:{factoryId}:{cutCode}. Only (factoryId,
 * cutCode) pairs with ≥2 fresh (non-bridge) price points AND latest within
 * STALE_WINDOW_DAYS are subscribed — the same honesty gate the forecast API
 * applies, so we never background-refresh a forecast that would be rejected
 * on-demand. runAndCachePrediction detects the cut: prefix and routes to
 * getBeefCutSeries automatically.
 *
 * This warms the Redis cache so the per-row /beef forecast column and the
 * cut-detail page hit cache (sub-50ms) instead of computing 3 models
 * synchronously on first request.
 */
export async function scheduleBeefCutPredictions(): Promise<number> {
	// Find (factoryId, cutCode) pairs with ≥2 non-bridge points and a recent
	// latest date. The freshness gate matches findForecastableFactoryForCut.
	const STALE_WINDOW_DAYS = 7;
	const since = new Date();
	since.setDate(since.getDate() - STALE_WINDOW_DAYS);

	const cuts = await prisma.beefCutPrice.groupBy({
		by: ["factoryId", "cutCode"],
		where: {
			source: { not: { startsWith: "bridge:" } },
			date: { gte: since },
		},
		_count: { _all: true },
	});

	const MODELS = getAllModels();
	let subscribed = 0;
	for (const c of cuts) {
		if (c._count._all >= 2) {
			// Virtual key routes runAndCachePrediction → getBeefCutSeries.
			const key = `cut:${c.factoryId}:${c.cutCode}`;
			subscribeCommodity(key, MODELS, 10);
			subscribed++;
		}
	}

	logger.info(
		`[PREDICT-CUT] Subscribed ${subscribed} beef cut series to prediction refresh (${cuts.length - subscribed} had <2 fresh non-bridge points, skipped)`,
	);

	return subscribed;
}
