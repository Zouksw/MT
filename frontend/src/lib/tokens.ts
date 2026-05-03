/**
 * Design Tokens for MT Frontend
 * Vercel/Tailwind-inspired: pure black/white + gold accent
 */

// ============================================================================
// COLORS - LIGHT MODE
// ============================================================================

export const lightColors = {
	// Primary - Gold accent (Vercel-style: accent only, NOT on buttons/bg)
	primary: "#B8860B",
	primaryBg: "#FDF6E3",
	primaryBgHover: "#FAECC8",
	primaryBorder: "#D4A030",
	primaryBorderHover: "#B8860B",
	primaryText: "#8B6914",
	primaryTextHover: "#6B520E",

	// Secondary - Neutral Gray
	secondary: "#6B7280",
	secondaryBg: "#F3F4F6",
	secondaryText: "#4B5563",

	// Success - Green
	success: "#16A34A",
	successBg: "#F0FDF4",
	successBorder: "#86EFAC",

	// Warning - Amber
	warning: "#D97706",
	warningBg: "#FFFBEB",
	warningBorder: "#FCD34D",

	// Error - Red
	error: "#DC2626",
	errorBg: "#FEF2F2",
	errorBorder: "#FCA5A5",

	// Info - Gold (same as primary)
	info: "#B8860B",
	infoBg: "#FDF6E3",
	infoBorder: "#D4A030",

	// Neutral Grays — standard Tailwind gray scale
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

	// Background Layers — pure white
	bgContainer: "#FFFFFF",
	bgLayout: "#FFFFFF",
	bgSpotlight: "#FFFFFF",
	bgElevated: "#FFFFFF",

	// Text Hierarchy
	text: "#111827",
	textSecondary: "#6B7280",
	textTertiary: "#9CA3AF",
	textQuaternary: "#D1D5DB",

	// Border Colors
	border: "#E5E7EB",
	borderSecondary: "#F3F4F6",

	// Accent Colors (for data visualization — warm earth palette)
	accent1: "#B8860B", // Gold
	accent2: "#3D6B4F", // Forest
	accent3: "#DC2626", // Red
	accent4: "#D97706", // Amber
	accent5: "#6B5B4E", // Umber
	accent6: "#8B7355", // Bronze
	accent7: "#A0522D", // Sienna
	accent8: "#556B2F", // Olive
};

// ============================================================================
// COLORS - DARK MODE
// ============================================================================

export const darkColors = {
	// Primary - Brighter gold for dark surfaces
	primary: "#D4A030",
	primaryBg: "rgba(184, 134, 11, 0.15)",
	primaryBgHover: "rgba(184, 134, 11, 0.25)",
	primaryBorder: "rgba(212, 160, 48, 0.4)",
	primaryBorderHover: "rgba(212, 160, 48, 0.6)",
	primaryText: "#E0B440",
	primaryTextHover: "#F0C850",

	// Secondary
	secondary: "#9CA3AF",
	secondaryBg: "#1F2937",
	secondaryText: "#D1D5DB",

	// Success
	success: "#34D399",
	successBg: "rgba(52, 211, 153, 0.15)",
	successBorder: "rgba(52, 211, 153, 0.3)",

	// Warning
	warning: "#FBBF24",
	warningBg: "rgba(251, 191, 36, 0.15)",
	warningBorder: "rgba(251, 191, 36, 0.3)",

	// Error
	error: "#F87171",
	errorBg: "rgba(248, 113, 113, 0.15)",
	errorBorder: "rgba(248, 113, 113, 0.3)",

	// Info
	info: "#D4A030",
	infoBg: "rgba(184, 134, 11, 0.15)",
	infoBorder: "rgba(212, 160, 48, 0.3)",

	// Neutral Grays - Dark Mode (inverted)
	gray50: "#111827",
	gray100: "#1F2937",
	gray200: "#374151",
	gray300: "#4B5563",
	gray400: "#6B7280",
	gray500: "#9CA3AF",
	gray600: "#D1D5DB",
	gray700: "#E5E7EB",
	gray800: "#F3F4F6",
	gray900: "#F9FAFB",

	// Background Layers — dark
	bgContainer: "#1F2937",
	bgLayout: "#111827",
	bgSpotlight: "#374151",
	bgElevated: "#1F2937",

	// Text Hierarchy
	text: "#F9FAFB",
	textSecondary: "#D1D5DB",
	textTertiary: "#9CA3AF",
	textQuaternary: "#6B7280",

	// Border Colors
	border: "#374151",
	borderSecondary: "#1F2937",

	// Accent Colors (lighter for dark mode)
	accent1: "#D4A030",
	accent2: "#4E8766",
	accent3: "#F87171",
	accent4: "#FBBF24",
	accent5: "#9CA3AF",
	accent6: "#B8A080",
	accent7: "#D2691E",
	accent8: "#6B8E23",
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	fontFamilyMono:
		'"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',

	fontSizeXS: "0.75rem",
	fontSizeSM: "0.875rem",
	fontSizeBase: "1rem",
	fontSizeLG: "1.125rem",
	fontSizeXL: "1.25rem",
	fontSize2XL: "1.5rem",
	fontSize3XL: "1.875rem",
	fontSize4XL: "2.25rem",
	fontSize5XL: "3rem",

	fontSizeHeading1: "2.25rem",
	fontSizeHeading2: "1.875rem",
	fontSizeHeading3: "1.5rem",
	fontSizeHeading4: "1.25rem",
	fontSizeHeading5: "1.125rem",

	fontWeightNormal: 400,
	fontWeightMedium: 500,
	fontWeightSemibold: 600,
	fontWeightBold: 600,

	lineHeightTight: 1.25,
	lineHeightBase: 1.5,
	lineHeightRelaxed: 1.75,

	letterSpacingTight: "-0.025em",
	letterSpacingNormal: "0",
	letterSpacingWide: "0.025em",
};

// ============================================================================
// SPACING (4px base unit)
// ============================================================================

export const spacing = {
	spacing0: 0,
	spacing1: "0.25rem",
	spacing2: "0.5rem",
	spacing3: "0.75rem",
	spacing4: "1rem",
	spacing5: "1.25rem",
	spacing6: "1.5rem",
	spacing8: "2rem",
	spacing10: "2.5rem",
	spacing12: "3rem",
	spacing16: "4rem",
	spacing20: "5rem",
	spacing24: "6rem",

	paddingXS: "0.5rem",
	paddingSM: "0.75rem",
	paddingMD: "1rem",
	paddingLG: "1.5rem",
	paddingXL: "2rem",

	marginXS: "0.5rem",
	marginSM: "0.75rem",
	marginMD: "1rem",
	marginLG: "1.5rem",
	marginXL: "2rem",

	gapSM: "0.75rem",
	gapMD: "1rem",
	gapLG: "1.5rem",
	gapXL: "2rem",
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
	XS: 2,
	SM: 4,
	MD: 8,
	LG: 12,
	XL: 16,
	Full: 9999,
};

// ============================================================================
// SHADOWS — minimal, Vercel-style (mostly none)
// ============================================================================

export const shadows = {
	XS: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
	SM: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
	MD: "0 1px 3px 0 rgba(0, 0, 0, 0.06)",
	LG: "0 2px 4px 0 rgba(0, 0, 0, 0.06)",
	XL: "0 4px 8px 0 rgba(0, 0, 0, 0.06)",

	darkSM: "0 1px 3px 0 rgba(0, 0, 0, 0.4)",
	darkMD: "0 2px 4px 0 rgba(0, 0, 0, 0.4)",
	darkLG: "0 4px 8px 0 rgba(0, 0, 0, 0.4)",

	primary: "0 0 0 1px rgba(0, 0, 0, 0.05)",
	success: "0 0 0 1px rgba(0, 0, 0, 0.05)",
	warning: "0 0 0 1px rgba(0, 0, 0, 0.05)",
	error: "0 0 0 1px rgba(0, 0, 0, 0.05)",
};

// ============================================================================
// COMPONENT-SPECIFIC TOKENS
// ============================================================================

export const componentTokens = {
	buttonHeightSM: 32,
	buttonHeightMD: 40,
	buttonHeightLG: 48,
	buttonPaddingSM: "0.5rem 1rem",
	buttonPaddingMD: "0.625rem 1.25rem",
	buttonPaddingLG: "0.75rem 1.5rem",
	buttonBorderRadius: 9999,

	inputHeightSM: 32,
	inputHeightMD: 40,
	inputHeightLG: 48,
	inputPadding: "0.625rem 0.875rem",
	inputBorderRadius: 8,

	cardPadding: "1.5rem",
	cardBorderRadius: 16,
	cardMarginBottom: "1.5rem",

	tableHeaderBg: "transparent",
	tableCellPadding: "1rem 1.25rem",
	tableRowHoverBg: "rgba(0, 0, 0, 0.02)",
	tableBorderRadius: 12,

	modalBorderRadius: 16,
	modalPadding: "1.5rem",
	modalHeaderPadding: "1.5rem 1.5rem 1rem",
	modalFooterPadding: "1rem 1.5rem 1.5rem",

	tagBorderRadius: 9999,
	tagPaddingXS: "0.125rem 0.5rem",
	tagPaddingSM: "0.25rem 0.625rem",
	tagPaddingMD: "0.375rem 0.75rem",
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getColors = (mode: "light" | "dark") => (mode === "light" ? lightColors : darkColors);

export const getShadow = (level: keyof typeof shadows, mode: "light" | "dark") => {
	if (mode === "dark" && (level === "SM" || level === "MD" || level === "LG")) {
		return shadows[`dark${level}`];
	}
	return shadows[level];
};

// ============================================================================
// EXPORT ALL TOKENS
// ============================================================================

export const tokens = {
	colors: lightColors,
	darkColors,
	typography,
	spacing,
	borderRadius,
	shadows,
	componentTokens,
	getColors,
	getShadow,
};

export default tokens;
