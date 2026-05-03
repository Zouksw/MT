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
	arima: "ARIMA",
	holtwinters: "Holt-Winters",
	exponential_smoothing: "Exp. Smoothing",
	naive_forecaster: "Naive",
	stl_forecaster: "STL",
	timer_xl: "Timer-XL",
	sundial: "Sundial",
};

export const MODEL_COLORS: Record<string, string> = {
	arima: "#B8860B",
	holtwinters: "#8B5CF6",
	exponential_smoothing: "#EC4899",
	naive_forecaster: "#F97316",
	stl_forecaster: "#14B8A6",
	timer_xl: "#06B6D4",
	sundial: "#6366F1",
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
