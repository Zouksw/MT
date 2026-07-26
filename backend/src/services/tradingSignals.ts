/**
 * Price Forecast Engine — Multi-Model Ensemble
 *
 * Generates a *price forecast* (not a trade recommendation) from multiple AI
 * model predictions. This is the information-platform framing: the platform
 * tells the user "commodity X is projected at $Y in N days, range [lo, hi]",
 * not "BUY/SELL". Trade-recommendation semantics (BUY/SELL/HOLD) were removed
 * when the product was repositioned to an information/analysis platform.
 *
 * Forecast logic:
 * - direction: up if models predict >+1% on average, down if <-1%, else flat
 * - confidence = agreement ratio blended with predicted magnitude, in [0,1]
 * - predictedPrice / range = median of available models' end-of-horizon values;
 *   range = [min, max] across models (robust to outlier models)
 * - support / resistance = price floor / ceiling implied by the forecast range
 *
 * Uses Promise.allSettled for parallel execution — failed models don't block.
 */

import { logger, prisma } from "../lib";
import { cutSeriesKey, getBeefCutSeries } from "./beefCutSeries";
import { STALE_WINDOW_DAYS } from "./beefFreshness";
import { getCachedPrediction, runAndCachePrediction } from "./predictionCache";

// All pretrained / ready-to-use models (IoTDB AINode style — no self-training).
// Timer-XL/Sundial (per-request online training) removed in Round 12.
const ALL_MODELS = [
	"arima",
	"holtwinters",
	"exponential_smoothing",
	"naive_forecaster",
	"stl_forecaster",
] as const;

/** Direction of the consensus forecast — replaces the old BUY/SELL/HOLD union. */
export type Direction = "up" | "down" | "flat";

export interface ModelForecast {
	modelId: string;
	/** This model's direction: up/down/flat. */
	direction: Direction;
	/** Predicted % change at end of horizon vs current price. */
	predictedChange: number;
	currentPrice: number;
	/** Predicted price at end of horizon. */
	predictedPrice: number;
	/** Confidence derived from this model's prediction-interval width, [0,1]. */
	confidence: number;
	status: "available" | "unavailable";
	error?: string;
}

export interface PriceForecast {
	/** Consensus direction across models. */
	direction: Direction;
	/** Blended confidence: agreement ratio + magnitude, in [0,1]. */
	confidence: number;
	/** Number of models agreeing with the consensus direction. */
	modelsAgree: number;
	totalModels: number;
	availableModels: number;
	/** Consensus predicted % change at end of horizon (mean of available models). */
	predictedChange: number;
	/** Current spot price the forecast is measured from. */
	currentPrice: number;
	/** Consensus predicted price at end of horizon (median of available models). */
	predictedPrice: number;
	/** Forecast horizon in steps (days for daily series). */
	horizon: number;
	/** Consensus price range across models: [min, max] of end-of-horizon values. */
	range: { lower: number; upper: number };
	/** Price floor implied by non-down models (former "support"). */
	supportLevel: number;
	/** Price ceiling implied by non-up models (former "resistance"). */
	resistanceLevel: number;
	/** Per-model forecasts. */
	individualForecasts: ModelForecast[];
	/** How many models point up / down / flat. */
	distribution: { up: number; down: number; flat: number };
	/** Model id with the highest confidence among available models, if any. */
	bestModel?: string;
	timestamp: string;
}

export interface ForecastRequest {
	commodityId: string;
	horizon: number;
	currentPrice: number;
	models?: string[];
}

/** Direction band: |change| at or below this is "flat", in percent. */
const FLAT_BAND_PCT = 1;

/**
 * Classify a predicted change (%) into a direction.
 */
function classifyDirection(predictedChangePct: number): Direction {
	if (predictedChangePct > FLAT_BAND_PCT) return "up";
	if (predictedChangePct < -FLAT_BAND_PCT) return "down";
	return "flat";
}

/**
 * Calculate model confidence from prediction bounds
 */
function calculateConfidence(
	currentPrice: number,
	lowerBound?: number[],
	upperBound?: number[],
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
 * Median of a numeric array (used for robust consensus price).
 */
function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Generate a price forecast from multiple model predictions (parallel, fault-tolerant).
 */
export async function generateForecast(req: ForecastRequest): Promise<PriceForecast> {
	const models = req.models || (ALL_MODELS as readonly string[]);
	const horizon = req.horizon || 10;
	const currentPrice = req.currentPrice;

	if (!currentPrice || currentPrice <= 0) {
		throw new Error("Valid current price is required");
	}

	// Execute all models in parallel — failed models become "unavailable"
	const results = await Promise.allSettled(
		models.map(async (modelId): Promise<ModelForecast> => {
			try {
				let prediction = await getCachedPrediction(req.commodityId, modelId, horizon);

				if (!prediction) {
					prediction = await runAndCachePrediction(req.commodityId, modelId, horizon);
				}

				if (!prediction.values?.length) {
					return {
						modelId,
						direction: "flat",
						predictedChange: 0,
						currentPrice,
						predictedPrice: currentPrice,
						confidence: 0,
						status: "unavailable",
						error: "Empty prediction result",
					};
				}

				const lastPredicted = prediction.values[prediction.values.length - 1];
				const predictedChange = ((lastPredicted - currentPrice) / currentPrice) * 100;
				const confidence = calculateConfidence(
					currentPrice,
					prediction.lowerBound,
					prediction.upperBound,
				);

				return {
					modelId,
					direction: classifyDirection(predictedChange),
					predictedChange: Math.round(predictedChange * 100) / 100,
					currentPrice,
					predictedPrice: Math.round(lastPredicted * 100) / 100,
					confidence: Math.round(confidence * 100) / 100,
					status: "available",
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				logger.error(`Model ${modelId} failed: ${msg}`);
				return {
					modelId,
					direction: "flat",
					predictedChange: 0,
					currentPrice,
					predictedPrice: currentPrice,
					confidence: 0,
					status: "unavailable",
					error: msg,
				};
			}
		}),
	);

	// Collect results
	const individualForecasts: ModelForecast[] = results.map((r) => {
		if (r.status === "fulfilled") return r.value;
		return {
			modelId: "unknown",
			direction: "flat" as Direction,
			predictedChange: 0,
			currentPrice,
			predictedPrice: currentPrice,
			confidence: 0,
			status: "unavailable" as const,
			error: r.reason?.message || "Unknown error",
		};
	});

	const availableForecasts = individualForecasts.filter((f) => f.status === "available");
	const availableCount = availableForecasts.length;

	// All models failed
	if (availableCount === 0) {
		return {
			direction: "flat",
			confidence: 0,
			modelsAgree: 0,
			totalModels: models.length,
			availableModels: 0,
			predictedChange: 0,
			currentPrice,
			predictedPrice: currentPrice,
			horizon,
			range: { lower: currentPrice, upper: currentPrice },
			supportLevel: currentPrice,
			resistanceLevel: currentPrice,
			individualForecasts,
			distribution: { up: 0, down: 0, flat: 0 },
			timestamp: new Date().toISOString(),
		};
	}

	// Count directions
	const upCount = availableForecasts.filter((f) => f.direction === "up").length;
	const downCount = availableForecasts.filter((f) => f.direction === "down").length;
	const flatCount = availableCount - upCount - downCount;

	// Determine consensus direction (plurality, must beat the others)
	let consensusDirection: Direction = "flat";
	let modelsAgree = flatCount;

	if (upCount > downCount && upCount > flatCount) {
		consensusDirection = "up";
		modelsAgree = upCount;
	} else if (downCount > upCount && downCount > flatCount) {
		consensusDirection = "down";
		modelsAgree = downCount;
	}

	// Confidence = agreement ratio + magnitude bonus
	const agreementRatio = modelsAgree / availableCount;
	const avgMagnitude = Math.abs(
		availableForecasts.reduce((sum, f) => sum + f.predictedChange, 0) / availableCount,
	);
	const consensusConfidence = Math.min(
		1,
		agreementRatio * 0.7 + Math.min(avgMagnitude / 5, 1) * 0.3,
	);

	// Consensus predicted price = median of available models (robust to outliers)
	const predictedPrices = availableForecasts.map((f) => f.predictedPrice);
	const consensusPrice = median(predictedPrices);

	// Forecast range = min/max across models (shows model disagreement spread)
	const rangeLower = Math.min(...predictedPrices);
	const rangeUpper = Math.max(...predictedPrices);

	// Support & resistance: price floor from non-down models, ceiling from non-up models
	const supportLevel = availableForecasts
		.filter((f) => f.direction !== "down")
		.reduce((min, f) => Math.min(min, f.predictedPrice), currentPrice * 0.95);

	const resistanceLevel = availableForecasts
		.filter((f) => f.direction !== "up")
		.reduce((max, f) => Math.max(max, f.predictedPrice), currentPrice * 1.05);

	const predictedChange =
		availableForecasts.reduce((sum, f) => sum + f.predictedChange, 0) / availableCount;

	// Best model = highest confidence among available models
	let bestModel: string | undefined;
	let bestConfidence = -1;
	for (const f of availableForecasts) {
		if (f.confidence > bestConfidence) {
			bestConfidence = f.confidence;
			bestModel = f.modelId;
		}
	}

	return {
		direction: consensusDirection,
		confidence: Math.round(consensusConfidence * 100) / 100,
		modelsAgree,
		totalModels: models.length,
		availableModels: availableCount,
		predictedChange: Math.round(predictedChange * 100) / 100,
		currentPrice,
		predictedPrice: Math.round(consensusPrice * 100) / 100,
		horizon,
		range: {
			lower: Math.round(rangeLower * 100) / 100,
			upper: Math.round(rangeUpper * 100) / 100,
		},
		supportLevel: Math.round(supportLevel * 100) / 100,
		resistanceLevel: Math.round(resistanceLevel * 100) / 100,
		individualForecasts,
		distribution: { up: upCount, down: downCount, flat: flatCount },
		bestModel,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Get all model IDs
 */
export function getAllModels(): string[] {
	return [...ALL_MODELS];
}

/**
 * Generate a price forecast for a single beef CUT (factoryId + cutCode),
 * reusing the same multi-model consensus pipeline as generateForecast.
 *
 * This is the dual-backend entry point (see docs/PROJECT-STATE-AND-VISION §3.1):
 * instead of forecasting a macro commodity by commodityId, it forecasts a
 * cut-level price series extracted from BeefCutPrice. The series is addressed
 * by the virtual key `cut:{factoryId}:{cutCode}`, which predictionCache
 * detects and routes to getBeefCutSeries.
 *
 * Data-honesty: bridge-proxy rows are excluded from the training series
 * (getBeefCutSeries default), so a cut forecast is never trained on a carcass
 * aggregate masquerading as a cut price.
 *
 * Throws if the cut has insufficient real data (<2 non-bridge points).
 */
export async function generateBeefCutForecast(
	factoryId: string,
	cutCode: string,
	horizon: number = 10,
	models?: string[],
): Promise<PriceForecast> {
	// Resolve the cut's current (latest non-bridge) price as the forecast anchor.
	// Reuse getBeefCutSeries so the "current price" is consistent with the
	// training series — both exclude bridge proxies.
	const series = await getBeefCutSeries({ factoryId, cutCode });
	const currentPrice = series.values[series.values.length - 1];

	if (!currentPrice || currentPrice <= 0) {
		throw new Error(`No valid current price for cut ${cutCode}/factory ${factoryId}`);
	}

	// The virtual key routes predictionCache → getBeefCutSeries automatically.
	const cutKey = cutSeriesKey(factoryId, cutCode);

	return generateForecast({
		commodityId: cutKey,
		horizon,
		currentPrice,
		models,
	});
}

/**
 * Find the best factory to forecast a given cutCode, or null if no factory
 * has sufficient real (non-bridge) data. Used by /api/beef/forecasts/* to
 * surface a representative per-cut forecast without the caller needing to
 * know factoryIds.
 *
 * DATA-HONESTY FRESHNESS GATE: even with ≥2 non-bridge points, if the LATEST
 * point is older than STALE_WINDOW_DAYS the series is treated as not
 * forecastable. Training a forecast on an 87-day-old synthetic snapshot (the
 * current seed state) would produce a real-looking prediction from fake data
 * — exactly the credibility problem the honesty framework exists to prevent.
 * The caller gets null + a reason so the UI can show an honest state.
 */
export async function findForecastableFactoryForCut(cutCode: string): Promise<{
	factoryId: string;
	latestPrice: number;
	latestDate: Date;
	pointCount: number;
} | null> {
	// Group by factoryId, count non-bridge rows per factory, pick the one with
	// the most points (most data = most reliable forecast).
	const factories = await prisma.beefCutPrice.groupBy({
		by: ["factoryId"],
		where: {
			cutCode,
			source: { not: { startsWith: "bridge:" } },
		},
		_count: { _all: true },
		orderBy: { _count: { id: "desc" } },
		take: 1,
	});

	if (factories.length === 0) return null;
	const factoryId = factories[0].factoryId;
	const pointCount = factories[0]._count._all;

	if (pointCount < 2) return null;

	// Latest non-bridge price for this factory+cut.
	const latest = await prisma.beefCutPrice.findFirst({
		where: { factoryId, cutCode, source: { not: { startsWith: "bridge:" } } },
		orderBy: { date: "desc" },
		select: { price: true, date: true },
	});

	if (!latest || latest.price == null) return null;

	// Freshness gate: a forecast trained on stale data is a fabricated
	// prediction. Reuse the honesty framework's threshold so the cut forecast
	// and the freshness badge agree on what "live" means.
	const ageDays = Math.floor((Date.now() - latest.date.getTime()) / 86_400_000);
	if (ageDays > STALE_WINDOW_DAYS) {
		return null;
	}

	return {
		factoryId,
		latestPrice: latest.price,
		latestDate: latest.date,
		pointCount,
	};
}
