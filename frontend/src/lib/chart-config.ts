/**
 * Unified Chart Configuration for MT
 * DESIGN.md: Gold = AI intelligence, green/red = market direction ONLY
 */

// Chart color palette — gold-centric per DESIGN.md "Refined Industrial" spec
export const chartColors = {
	// Gold accent — THE signature color
	primary: "#B8860B",
	primaryLight: "#D4A030",
	primaryDark: "#9A7209",

	// Semantic — market direction per spec rules
	bullish: "#22c55e",
	bearish: "#ef4444",
	warning: "#D4A030",
	info: "#B8860B",

	// Legacy aliases (semantic names used elsewhere)
	success: "#22c55e",
	error: "#ef4444",

	// Series palette — gold variants for multi-model/AI charts
	gold: "#B8860B",
	goldLight: "#D4A030",
	goldPale: "#DAB84A",
	goldWarm: "#C4960E",
	goldDark: "#9A7209",
	goldDeep: "#8B6914",
	goldMuted: "#A07B0A",
	goldBright: "#E8C560",

	// Legacy aliases for chart components still referencing old names
	purple: "#8B6914",
	pink: "#D4A030",
	blue: "#B8860B",

	// Design system neutrals (zinc scale matching #fafafa/#a1a1aa/#71717a)
	gray50: "#fafafa",
	gray100: "#f4f4f5",
	gray200: "#e4e4e7",
	gray300: "#d4d4d8",
	gray400: "#a1a1aa",
	gray500: "#71717a",
	gray600: "#52525b",
	gray700: "#3f3f46",
	gray800: "#27272a",
	gray900: "#18181b",
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

// Tooltip styles — dark-first per DESIGN.md
export const chartTooltipStyles = {
	backgroundColor: "rgba(31, 31, 31, 0.98)",
	border: "1px solid rgba(255, 255, 255, 0.08)",
	borderRadius: 4,
	padding: "12px",
	boxShadow: "rgba(255, 255, 255, 0.08) 0px 0px 0px 1px, 0px 2px 8px rgba(0, 0, 0, 0.4)",
	fontSize: 12,
	color: chartColors.gray400,
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
	radius: [4, 4, 0, 0],
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

// Series colors — gold variants for multi-model/AI overlays
export const seriesColors = [
	chartColors.gold,
	chartColors.goldLight,
	chartColors.goldDark,
	chartColors.goldPale,
	chartColors.goldDeep,
	chartColors.goldWarm,
	chartColors.goldMuted,
	chartColors.goldBright,
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
