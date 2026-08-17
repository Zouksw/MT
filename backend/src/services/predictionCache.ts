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
import { STALE_WINDOW_DAYS } from "./beefFreshness";
import { cacheKeys } from "./cache";
import { predict } from "./inference/client";
import { getCommodityPriceValues } from "./inference/data-fetcher";
import { BASELINE_MODELS, getAllModels } from "./modelRegistry";

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
// In-flight guard: if a refresh cycle runs longer than REFRESH_INTERVAL_MS,
// the next interval tick must skip rather than overlap. Overlapping cycles
// would concurrently call runAndCachePrediction for the same commodity/model,
// and logPrediction is an unconditional create (not an upsert) → duplicate
// prediction_log rows that inflate MAPE denominators.
let refreshInProgress = false;

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

		// Log prediction for MAPE accuracy tracking.
		//
		// This MUST be awaited (not fire-and-forget). The previous fire-and-forget
		// `import(...).then(() => logPrediction(...).catch(...))` form silently
		// dropped writes: the outer .then returned undefined (it didn't return the
		// logPrediction promise), so the outer .catch only caught import errors,
		// and a logPrediction that never settled left no trace. Symptom observed
		// live (round-71): scheduler fired inference (200 OK), Redis cache wrote,
		// but prediction_logs got 0 new rows for 8+ hours with zero error logs.
		// Awaiting makes the write deterministic and any failure observable.
		//
		// The DB write is wrapped so a failure never breaks the cached prediction
		// (the caller still gets a result) — but it IS awaited so the gap is
		// visible in logs and the row either lands or logs an error, never
		// silently vanishes.
		try {
			const { logPrediction } = await import("./mapeTracking");
			await logPrediction({
				modelId,
				commodityId,
				horizon,
				predictedValues: result.values,
				lowerBounds: result.lower_bound ?? undefined,
				upperBounds: result.upper_bound ?? undefined,
				// The forecast's own timeline start (first predicted step =
				// day after the last training point). Verification aligns
				// actuals to this, not to the log time (round-104).
				forecastStartAt:
					Array.isArray(result.timestamps) && result.timestamps.length > 0
						? new Date(result.timestamps[0])
						: undefined,
			});
		} catch (error) {
			logger.error(
				`Failed to log prediction for ${modelId}/${commodityId} (MAPE tracking): ${error}`,
			);
		}

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
			// Skip if the previous cycle is still running (see refreshInProgress
			// comment above). Also wrap the whole body so an escaped error
			// becomes a logged warning, not an unhandled rejection that the
			// global handler (server.ts) turns into process exit.
			if (refreshInProgress) return;
			refreshInProgress = true;
			try {
				for (const sub of subscriptions.values()) {
					await refreshCommodityPredictions(sub);
				}
			} catch (error) {
				logger.error(`Prediction refresh cycle failed: ${error}`);
			} finally {
				refreshInProgress = false;
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
 * Invalidate ALL cached predictions for a commodity, across every model and
 * horizon. Used after a scraper writes fresh/changed prices via upsertPrice:
 * any cached forecast built on the OLD price series is now stale and must be
 * evicted so the next request recomputes against the new data — otherwise the
 * platform serves predictions based on pre-scrape prices for up to 45 minutes
 * (the TTL), which is dishonest after newer data has landed.
 *
 * Symmetric to invalidateCutSeriesCache (round-30) for the commodity side.
 * The previous version required the caller to enumerate model + horizon, which
 * is why it was never wired in (callers don't know which combinations are
 * cached). This SCAN-by-prefix version evicts every variant regardless.
 *
 * Key pattern: prediction:{commodityId}:{modelId}:{horizon}
 * Match:       prediction:{commodityId}:*
 */
export async function invalidateCommodityCache(commodityId: string): Promise<number> {
	const client = await getRedisClient();
	if (!client) return 0;

	const pattern = `prediction:${commodityId}:*`;
	let deleted = 0;
	let cursor = 0;
	do {
		const { cursor: nextCursor, keys } = await client.scan(cursor, {
			MATCH: pattern,
			COUNT: 100,
		});
		cursor = nextCursor;
		if (keys.length > 0) {
			await client.del(keys);
			deleted += keys.length;
		}
	} while (cursor !== 0);

	return deleted;
}

/**
 * Invalidate ALL cached predictions for a cut-series key, across every model
 * and horizon. Used after a manual beef-price import: when an operator uploads
 * fresh CSV rows for a (factoryId, cutCode) pair, any cached forecast built on
 * the OLD price series is now stale and must be evicted so the next request
 * recomputes against the new data — otherwise the platform serves predictions
 * based on pre-import prices for up to 45 minutes (the TTL), which would be
 * dishonest after the operator has explicitly provided newer data.
 *
 * Unlike invalidateCommodityCache (which needs the caller to enumerate model
 * + horizon), this scans by key prefix so it catches every variant regardless
 * of which horizon the cache was filled with. SCAN (not KEYS) is used to avoid
 * blocking Redis on large keyspaces.
 */
export async function invalidateCutSeriesCache(
	factoryId: string,
	cutCode: string,
): Promise<number> {
	const client = await getRedisClient();
	if (!client) return 0;

	// Match prediction:cut:{factoryId}:{cutCode}:* — the trailing wildcard
	// covers every {modelId}:{horizon} suffix that was ever cached.
	const pattern = `prediction:cut:${factoryId}:${cutCode}:*`;
	let deleted = 0;
	let cursor = 0;
	do {
		// SCAN with COUNT to limit work per iteration; returns {cursor, keys}.
		// cursor 0 means the scan is complete. SCAN (not KEYS) avoids blocking
		// Redis on large keyspaces.
		const { cursor: nextCursor, keys } = await client.scan(cursor, {
			MATCH: pattern,
			COUNT: 100,
		});
		cursor = nextCursor;
		if (keys.length > 0) {
			await client.del(keys);
			deleted += keys.length;
		}
	} while (cursor !== 0);

	return deleted;
}

/**
 * Schedule predictions for active commodities that actually have price data.
 *
 * Previously this subscribed ALL active commodities (111), but 64% had zero
 * CommodityPrice rows — every 30-min refresh fired 3 model predictions that
 * all failed with "Insufficient price data", wasting inference-service work
 * and polluting logs. The first fix required ≥2 daily prices (the inference
 * engine's minimum for fitting a model).
 *
 * Recency gate (round-62, 2026-08-02): a count-only gate still subscribed
 * commodities whose latest price was months old (15 commodities frozen since
 * 2026-04-29 / 2026-06-01 with thousands of historical rows). Every 30-min
 * refresh generated 3 chronos predictions for each that could NEVER be
 * verified (no new actuals ever arrive) — ~92k permanently-unverifiable rows
 * accumulated, diluting verificationRatio to 0.006 and starving the verify
 * loop's batch of real candidates. Now we additionally require ≥2 daily
 * prices WITHIN STALE_WINDOW_DAYS (7), mirroring the beef-cut scheduler
 * (scheduleBeefCutPredictions) and findForecastableFactoryForCut. A frozen
 * commodity (e.g. wheat_cn, latest 2026-04-29) has 0 in-window rows → not
 * subscribed → no new unverifiable predictions generated.
 */
export async function schedulePredictionsFromPostgreSQL(): Promise<number> {
	// Recency window: only subscribe commodities with fresh data. Same
	// constant the beef-cut path uses (STALE_WINDOW_DAYS=7), so a commodity
	// is subscribed iff its forecast would not be honesty-gated on read.
	const since = new Date();
	since.setDate(since.getDate() - STALE_WINDOW_DAYS);

	// Sub-query: active commodities with ≥2 daily prices WITHIN the window.
	// The _count is now window-scoped, so the >=2 check below is both the
	// inference-minimum gate AND the recency gate in one predicate.
	const commodities = await prisma.commodity.findMany({
		where: {
			isActive: true,
			prices: { some: { interval: "daily", date: { gte: since } } },
		},
		select: {
			id: true,
			_count: {
				select: { prices: { where: { interval: "daily", date: { gte: since } } } },
			},
		},
	});

	const MODELS = getAllModels();
	let subscribed = 0;
	for (const commodity of commodities) {
		// _count.prices is now the in-window daily-price count.
		if (commodity._count.prices >= 2) {
			subscribeCommodity(commodity.id, MODELS, 10);
			subscribed++;
		}
	}

	const skipped = commodities.length - subscribed;
	logger.info(
		`[PREDICT] Subscribed ${subscribed} commodities to prediction refresh (${skipped} active commodities had <2 daily prices in last ${STALE_WINDOW_DAYS}d, skipped)`,
	);

	return subscribed;
}

/**
 * Generate one batch of BASELINE model predictions for fresh commodities.
 *
 * Baseline revival (round-110, PREDICTION-STRATEGY §4 item 5): statistical
 * baselines left background scheduling on 2026-07-26 when chronos became the
 * primary ensemble, so their verified pools froze — the "naive bar" any real
 * model must beat has no same-generation evidence to be compared against
 * (chronos fresh-cohort MAPE 0.68-0.70 vs naive's frozen 05-19→07-26 pool
 * mixed across 7 commodities is not a fair comparison).
 *
 * This runs the 4 baseline models on every fresh commodity (same ≥2 daily
 * prices within STALE_WINDOW_DAYS gate as schedulePredictionsFromPostgreSQL).
 * Each call goes through runAndCachePrediction → logPrediction, so the rows
 * enter the MAPE verification loop and mature into verified evidence ~10
 * days later. Cadence is deliberately DAILY (server.ts), not the 30-min
 * primary cadence: baselines only need enough verified rows for the accuracy
 * comparison page (16 rows/day → ~120/model in a 30d window), and the daily
 * cadence keeps prediction_logs growth and inference load bounded.
 *
 * Deliberately does NOT use subscribeCommodity: the subscriptions map is
 * keyed by commodityId, so a second subscribe for baselines would REPLACE
 * the chronos subscription instead of adding to it. Calling
 * runAndCachePrediction directly leaves the 30-min primary machinery intact.
 *
 * @returns number of baseline predictions generated this run
 */
export async function generateBaselinePredictions(): Promise<number> {
	const since = new Date();
	since.setDate(since.getDate() - STALE_WINDOW_DAYS);

	const commodities = await prisma.commodity.findMany({
		where: {
			isActive: true,
			prices: { some: { interval: "daily", date: { gte: since } } },
		},
		select: {
			id: true,
			_count: {
				select: { prices: { where: { interval: "daily", date: { gte: since } } } },
			},
		},
	});

	let generated = 0;
	let fresh = 0;
	for (const commodity of commodities) {
		if (commodity._count.prices < 2) continue;
		fresh++;
		for (const modelId of BASELINE_MODELS) {
			try {
				await runAndCachePrediction(commodity.id, modelId, 10);
				generated++;
			} catch (error) {
				// Per-model failure must not abort the batch — the remaining
				// models still produce comparison evidence this cycle.
				logger.error(`[BASELINE] Failed ${modelId} for ${commodity.id}: ${error}`);
			}
		}
	}

	logger.info(
		`[BASELINE] Generated ${generated} baseline predictions (${BASELINE_MODELS.length} models × ${fresh} fresh commodities)`,
	);

	return generated;
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
	// STALE_WINDOW_DAYS is imported from beefFreshness (shared with the
	// commodity scheduler above and findForecastableFactoryForCut).
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
