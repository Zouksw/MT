export interface ModelAccuracy {
	modelId: string;
	avgMape: number | null;
	predictionCount: number;
	verifiedCount: number;
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
