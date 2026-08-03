/**
 * Unified Chart Configuration for MT
 * DESIGN.md: Gold = AI intelligence, green/red = market direction ONLY
 *
 * Note (round-68): chartDimensions/chartTypography/barChartStyles/
 * referenceLineStyles/responsiveContainerProps/getCommonChartProps/
 * seriesColors/getSeriesColor/getGradientFill and the default export were
 * removed — each had 0 callers across chart components (all use the named
 * style exports retained below).
 */

// Chart color palette — gold-centric per DESIGN.md "Refined Industrial" spec.
// Gold unified to #8B6914 (5.1:1 on white, WCAG AA) across all configs.
export const chartColors = {
	// Gold accent — THE signature color
	primary: "#8B6914",
	primaryLight: "#A8821C",
	primaryDark: "#6B4F04",

	// Semantic — market direction per spec rules
	bullish: "#22c55e",
	bearish: "#ef4444",
	warning: "#D97706",
	info: "#8B6914",

	// Legacy aliases (semantic names used elsewhere)
	success: "#22c55e",
	error: "#ef4444",

	// Series palette — gold variants for multi-model/AI charts
	gold: "#8B6914",
	goldLight: "#A8821C",
	goldPale: "#C49A3A",
	goldWarm: "#9A7512",
	goldDark: "#6B4F04",
	goldDeep: "#5A4108",
	goldMuted: "#7A5F10",
	goldBright: "#D4B04A",

	// Legacy aliases for chart components still referencing old names
	purple: "#8B6914",
	pink: "#A8821C",
	blue: "#8B6914",

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

// Animation configs
export const chartAnimations = {
	duration: 300,
	easing: "ease-in-out" as const,
};
