/**
 * Trading Chart Color Configuration
 *
 * Amber-themed colors for trading dashboard charts.
 * Global app uses gold (#8B6914) — trading dashboard uses amber (#8B6914).
 */

export const TRADING_COLORS = {
	// Primary amber palette
	primary: "#8B6914",
	primaryLight: "#FEF3C7",
	primaryDark: "#D97706",

	// Signal colors
	buy: "#10B981",
	buyBg: "#ECFDF5",
	sell: "#EF4444",
	sellBg: "#FEF2F2",
	hold: "#64748B",
	holdBg: "#F8FAFC",

	// Chart colors
	forecastLine: "#8B6914",
	historicalLine: "#94A3B8",
	confidenceBand: "rgba(245, 158, 11, 0.15)",
	confidenceBorder: "rgba(245, 158, 11, 0.3)",
	supportLine: "#10B981",
	resistanceLine: "#EF4444",
	anomalyDot: "#EF4444",

	// Model-specific chart colors (for multi-model overlay)
	modelColors: {
		arima: "#8B6914",
		holtwinters: "#8B6914",
		exponential_smoothing: "#8B5CF6",
		naive_forecaster: "#64748B",
		stl_forecaster: "#EC4899",
	} as Record<string, string>,

	// Forecast zone annotation
	forecastZone: {
		fill: "rgba(245, 158, 11, 0.05)",
		stroke: "rgba(245, 158, 11, 0.2)",
	},
} as const;
