/**
 * Color Contrast Utilities
 *
 * Ensures all color combinations meet WCAG AA (4.5:1 for normal text)
 * and AAA (7:1 for large text) requirements.
 */

// RGB interface
interface RGB {
	r: number;
	g: number;
	b: number;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
	// Remove # if present
	const cleanHex = hex.replace("#", "");

	const r = parseInt(cleanHex.substring(0, 2), 16);
	const g = parseInt(cleanHex.substring(2, 4), 16);
	const b = parseInt(cleanHex.substring(4, 6), 16);

	return { r, g, b };
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.0 specification
 */
export function getLuminance(color: string | RGB): number {
	const rgb = typeof color === "string" ? hexToRgb(color) : color;

	const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
		const normalized = val / 255;
		return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * Returns value between 1 and 21
 */
export function getContrastRatio(foreground: string | RGB, background: string | RGB): number {
	const fgLuminance = getLuminance(foreground);
	const bgLuminance = getLuminance(background);

	const lighter = Math.max(fgLuminance, bgLuminance);
	const darker = Math.min(fgLuminance, bgLuminance);

	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG compliance levels
 */
export const WCAG_AA = {
	normal_text: 4.5,
	large_text: 3.0,
	ui_components: 3.0,
} as const;

export const WCAG_AAA = {
	normal_text: 7.0,
	large_text: 4.5,
	ui_components: 4.5,
} as const;

/**
 * Test if a color combination meets WCAG AA
 */
export function meetsWCAG_AA(foreground: string, background: string, isLargeText = false): boolean {
	const ratio = getContrastRatio(foreground, background);
	const threshold = isLargeText ? WCAG_AA.large_text : WCAG_AA.normal_text;
	return ratio >= threshold;
}

/**
 * Test if a color combination meets WCAG AAA
 */
export function meetsWCAG_AAA(
	foreground: string,
	background: string,
	isLargeText = false,
): boolean {
	const ratio = getContrastRatio(foreground, background);
	const threshold = isLargeText ? WCAG_AAA.large_text : WCAG_AAA.normal_text;
	return ratio >= threshold;
}

/**
 * Design system color palette
 */
export const DESIGN_COLORS = {
	// Primary colors
	primary: "#B8860B",
	"primary-hover": "#9A7209",
	"primary-light": "#FDF6E3",

	// Secondary colors
	secondary: "#475569",
	"secondary-hover": "#334155",

	// Semantic colors — MUST match tailwind.config.ts tokens (#16A34A / #DC2626),
	// not the stale #10B981 / #EF4444 from the old DESIGN.md.
	success: "#16A34A",
	warning: "#D97706",
	error: "#DC2626",
	info: "#B8860B",

	// Neutral colors
	white: "#FFFFFF",
	"gray-50": "#F9FAFB",
	"gray-100": "#F3F4F6",
	"gray-200": "#E5E7EB",
	"gray-300": "#D1D5DB",
	"gray-400": "#9CA3AF",
	"gray-500": "#6B7280",
	"gray-600": "#4B5563",
	"gray-700": "#374151",
	"gray-800": "#1F2937",
	"gray-900": "#111827",

	// Dark mode colors
	"dark-bg": "#0F172A",
	"dark-bg-secondary": "#1E293B",
	"dark-border": "#334155",
} as const;

/**
 * Test all design system color combinations
 */
export const COLOR_CONTRAST_TESTS = {
	// Primary on white
	"primary-on-white": getContrastRatio(DESIGN_COLORS.primary, DESIGN_COLORS.white),

	// Primary on gray
	"primary-on-gray-50": getContrastRatio(DESIGN_COLORS.primary, DESIGN_COLORS["gray-50"]),
	"primary-on-gray-100": getContrastRatio(DESIGN_COLORS.primary, DESIGN_COLORS["gray-100"]),
	"primary-on-gray-900": getContrastRatio(DESIGN_COLORS.primary, DESIGN_COLORS["gray-900"]),

	// Secondary on white
	"secondary-on-white": getContrastRatio(DESIGN_COLORS.secondary, DESIGN_COLORS.white),

	// Semantic colors on white
	"success-on-white": getContrastRatio(DESIGN_COLORS.success, DESIGN_COLORS.white),
	"warning-on-white": getContrastRatio(DESIGN_COLORS.warning, DESIGN_COLORS.white),
	"error-on-white": getContrastRatio(DESIGN_COLORS.error, DESIGN_COLORS.white),
	"info-on-white": getContrastRatio(DESIGN_COLORS.info, DESIGN_COLORS.white),

	// Gray text on white
	"gray-500-on-white": getContrastRatio(DESIGN_COLORS["gray-500"], DESIGN_COLORS.white),
	"gray-600-on-white": getContrastRatio(DESIGN_COLORS["gray-600"], DESIGN_COLORS.white),
	"gray-700-on-white": getContrastRatio(DESIGN_COLORS["gray-700"], DESIGN_COLORS.white),
	"gray-900-on-white": getContrastRatio(DESIGN_COLORS["gray-900"], DESIGN_COLORS.white),

	// White text on dark backgrounds
	"white-on-gray-800": getContrastRatio(DESIGN_COLORS.white, DESIGN_COLORS["gray-800"]),
	"white-on-gray-900": getContrastRatio(DESIGN_COLORS.white, DESIGN_COLORS["gray-900"]),
	"white-on-dark-bg": getContrastRatio(DESIGN_COLORS.white, DESIGN_COLORS["dark-bg"]),

	// Primary on dark
	"primary-on-dark-bg": getContrastRatio(DESIGN_COLORS.primary, DESIGN_COLORS["dark-bg"]),
	"primary-on-dark-bg-secondary": getContrastRatio(
		DESIGN_COLORS.primary,
		DESIGN_COLORS["dark-bg-secondary"],
	),
} as const;

/**
 * Validate color combination and return result
 */
export interface ColorValidationResult {
	ratio: number;
	wcagAA: boolean;
	wcagAAA: boolean;
	recommendation?: string;
}

export function validateColorCombination(
	foreground: string,
	background: string,
	isLargeText = false,
): ColorValidationResult {
	const ratio = getContrastRatio(foreground, background);
	const wcagAA = meetsWCAG_AA(foreground, background, isLargeText);
	const wcagAAA = meetsWCAG_AAA(foreground, background, isLargeText);

	let recommendation: string | undefined;

	if (!wcagAA) {
		recommendation = `Contrast ratio ${ratio.toFixed(2)}:1 does not meet WCAG AA (requires ${isLargeText ? "3.0" : "4.5"}:1). Consider adjusting colors.`;
	}

	return {
		ratio,
		wcagAA,
		wcagAAA,
		recommendation,
	};
}

/**
 * Get text color that passes WCAG AA on given background
 */
export function getAccessibleTextColor(backgroundColor: string, preferLight = true): string {
	const whiteContrast = getContrastRatio("#FFFFFF", backgroundColor);
	const blackContrast = getContrastRatio("#000000", backgroundColor);

	// Return the color with better contrast
	if (whiteContrast >= blackContrast) {
		return preferLight ? "#F9FAFB" : "#FFFFFF";
	} else {
		return preferLight ? "#111827" : "#000000";
	}
}
