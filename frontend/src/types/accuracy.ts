export interface ModelAccuracy {
	modelId: string;
	avgMape: number | null;
	predictionCount: number;
	verifiedCount: number;
	/**
	 * Recent-window MAPE (forwarded from the backend, previously dropped at the
	 * getAllModelAccuracy boundary). Optional for backward compatibility with
	 * older API responses / mocks.
	 */
	last7dMape?: number | null;
	last30dMape?: number | null;
	/**
	 * ISO timestamp of the most-recently verified prediction for this model.
	 * null when verifiedCount === 0. Drives the "how stale is this MAPE?"
	 * freshness badge on the comparison page — a frozen historical baseline
	 * has an old lastVerifiedAt, while an actively-verified model is recent.
	 */
	lastVerifiedAt?: string | null;
	/**
	 * true = part of the primary chronos consensus (background-scheduled,
	 * feeds generateForecast). false = statistical baseline (on-demand via
	 * /ai predict only; its MAPE is historical and won't get new verified
	 * records by design — see commit 8992154).
	 */
	isPrimary?: boolean;
}

/**
 * Minimum verified-sample count below which a model's MAPE is too noisy to
 * display as a real accuracy figure. A single verified prediction (chronos
 * during the consensus-transition window) is not statistically meaningful;
 * showing 4.63% from N=1 next to 2.22% from N=133 would mislead users into
 * thinking the baselines are more accurate. Below this floor the badge shows
 * "Insufficient data" instead of a number.
 *
 * Shared between the page (per-row gating) and the hook (overallAccuracy /
 * bestModel aggregation) so both gates stay in lockstep.
 */
export const MIN_VERIFIED_SAMPLE = 5;

/**
 * Classify a modelId as part of the primary chronos consensus vs a statistical
 * baseline. Mirrors the backend's ALL_MODELS (tradingSignals.ts:29) — chronos_*
 * is the primary set, everything else is a baseline. Falls back to false so an
 * unknown id is treated conservatively as a baseline (not awarded primary
 * status it may not have).
 */
export function isPrimaryModel(modelId: string): boolean {
	return modelId.startsWith("chronos_");
}

export interface AccuracyResponse {
	accuracy: ModelAccuracy[];
	days: number;
}

export interface BacktestWindow {
	days: number;
	mape: number | null;
	predictionCount: number;
	verifiedCount: number;
}

export interface BacktestResponse {
	modelId: string;
	windows: BacktestWindow[];
	trend: "improving" | "stable" | "degrading" | "insufficient_data";
	trendDescription: string;
}

export interface ModelWithBacktest extends ModelAccuracy {
	backtest?: BacktestResponse;
	displayName: string;
}

export const MODEL_NAME_MAP: Record<string, string> = {
	// Chronos ensemble (primary consensus)
	chronos_tiny: "Chronos-T5-Tiny",
	chronos_mini: "Chronos-T5-Mini",
	chronos_base: "Chronos-T5-Base",
	// Statistical baselines (comparison only)
	arima: "ARIMA",
	holtwinters: "Holt-Winters",
	exponential_smoothing: "Exp. Smoothing",
	naive_forecaster: "Naive",
	stl_forecaster: "STL",
};

export const MODEL_COLORS: Record<string, string> = {
	// Chronos — gold family (primary)
	chronos_tiny: "#D4A017",
	chronos_mini: "#B8860B",
	chronos_base: "#8B6914",
	// Baselines — muted/distinct
	arima: "#6B7280",
	holtwinters: "#8B5CF6",
	exponential_smoothing: "#EC4899",
	naive_forecaster: "#F97316",
	stl_forecaster: "#14B8A6",
};

export interface PredictionLog {
	id: string;
	commodityId: string;
	timeseriesPath: string;
	horizon: number;
	predictedValues: number[];
	actualValues: number[] | null;
	lowerBounds: number[] | null;
	upperBounds: number[] | null;
	confidence: number | null;
	mape: number | null;
	status: string;
	predictedAt: string;
	verifiedAt: string | null;
}

export interface PredictionLogResponse {
	predictions: PredictionLog[];
	total: number;
	limit: number;
	offset: number;
}
