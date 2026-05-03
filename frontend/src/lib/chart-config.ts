/**
 * Unified Chart Configuration for MT
 * Provides consistent styling for all Recharts components
 */

// Chart color palette - professional and accessible
export const chartColors = {
	// Primary colors - matching design system
	primary: "#B8860B",
	primaryLight: "#D4A030",
	primaryDark: "#9A7209",

	// Semantic colors
	success: "#10B981",
	warning: "#F59E0B",
	error: "#EF4444",
	info: "#0EA5E9",

	// Data visualization colors (colorblind-friendly palette)
	blue: "#B8860B",
	purple: "#8B5CF6",
	pink: "#EC4899",
	orange: "#F97316",
	teal: "#14B8A6",
	cyan: "#06B6D4",
	indigo: "#6366F1",
	rose: "#F43F5E",

	// Neutral grays
	gray50: "#F9FAFB",
	gray100: "#F3F4F6",
	gray200: "#E5E7EB",
	gray300: "#D1D5DB",
	gray400: "#9CA3AF",
	gray500: "#6B7280",
	gray600: "#4B5563",
	gray700: "#374151",
	gray800: "#1F2937",
	gray900: "#111827",
};

// Chart dimensions
export const chartDimensions = {
	defaultHeight: 400,
	compactHeight: 300,
	largeHeight: 500,
	margin: { top: 20, right: 20, left: 20, bottom: 60 },
};

// Typography
export const chartTypography = {
	axisLabel: {
		fontSize: 12,
		fill: chartColors.gray500,
		fontWeight: 400,
	},
	axisLabelDark: {
		fontSize: 12,
		fill: chartColors.gray400,
		fontWeight: 400,
	},
	title: {
		fontSize: 14,
		fill: chartColors.gray700,
		fontWeight: 600,
	},
	titleDark: {
		fontSize: 14,
		fill: chartColors.gray300,
		fontWeight: 600,
	},
	tooltip: {
		fontSize: 12,
		color: chartColors.gray600,
	},
	tooltipDark: {
		fontSize: 12,
		color: chartColors.gray400,
	},
	legend: {
		fontSize: 12,
		color: chartColors.gray600,
	},
	legendDark: {
		fontSize: 12,
		color: chartColors.gray400,
	},
};

// Grid and axis styles
export const chartGridStyles = {
	stroke: chartColors.gray200,
	strokeDasharray: "3 3",
	strokeWidth: 1,
	strokeDark: chartColors.gray700,
};

export const chartAxisStyles = {
	stroke: chartColors.gray200,
	strokeWidth: 1,
	strokeDark: chartColors.gray700,
	tick: {
		fill: chartColors.gray500,
		fontSize: 11,
	},
	tickDark: {
		fill: chartColors.gray400,
		fontSize: 11,
	},
	line: {
		stroke: chartColors.gray200,
		strokeWidth: 1,
	},
	lineDark: {
		stroke: chartColors.gray700,
		strokeWidth: 1,
	},
};

// Tooltip styles - professional and clean
export const chartTooltipStyles = {
	backgroundColor: "rgba(255, 255, 255, 0.98)",
	border: "1px solid #E5E7EB",
	borderRadius: 4,
	padding: "12px",
	boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
	fontSize: 12,
	color: chartColors.gray600,

	// Dark mode
	darkBackgroundColor: "rgba(31, 41, 55, 0.98)",
	darkBorder: "1px solid #374151",
	darkBoxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
};

// Line chart specific
export const lineChartStyles = {
	strokeWidth: 2,
	dot: {
		r: 4,
		strokeWidth: 2,
		fill: "#FFFFFF",
	},
	activeDot: {
		r: 6,
		strokeWidth: 2,
		fill: chartColors.primary,
	},
	stroke: chartColors.primary,
};

// Area chart fill
export const areaChartStyles = {
	fill: chartColors.primary,
	fillOpacity: 0.1,
	stroke: chartColors.primary,
	strokeWidth: 2,
};

// Bar chart styles
export const barChartStyles = {
	fill: chartColors.primary,
	radius: [2, 2, 0, 0], // top-left, top-right, bottom-right, bottom-left
	hoverFill: chartColors.primaryLight,
};

// Reference line styles
export const referenceLineStyles = {
	stroke: chartColors.error,
	strokeWidth: 2,
	strokeDasharray: "5 5",
	label: {
		fill: chartColors.error,
		fontSize: 11,
		fontWeight: 500,
	},
};

// Animation configs
export const chartAnimations = {
	duration: 300,
	easing: "ease-in-out" as const,
};

// Responsive container defaults
export const responsiveContainerProps = {
	width: "100%",
	height: chartDimensions.defaultHeight,
};

// Common chart props generator
export const getCommonChartProps = (_darkMode = false) => ({
	margin: chartDimensions.margin,
});

// Line colors for multiple series (colorblind-safe palette)
export const seriesColors = [
	chartColors.blue,
	chartColors.purple,
	chartColors.teal,
	chartColors.orange,
	chartColors.rose,
	chartColors.cyan,
	chartColors.indigo,
	chartColors.pink,
];

// Utility function to generate chart colors
export const getSeriesColor = (index: number) => {
	return seriesColors[index % seriesColors.length];
};

// Utility function to get gradient fill
export const getGradientFill = (color: string, _darkMode = false) => {
	const opacity = _darkMode ? 0.3 : 0.1;
	return {
		fill: color,
		fillOpacity: opacity,
		stroke: color,
		strokeWidth: 2,
	};
};

export default {
	chartColors,
	chartDimensions,
	chartTypography,
	chartGridStyles,
	chartAxisStyles,
	chartTooltipStyles,
	lineChartStyles,
	areaChartStyles,
	barChartStyles,
	referenceLineStyles,
	chartAnimations,
	responsiveContainerProps,
	getCommonChartProps,
	getSeriesColor,
	getGradientFill,
};
