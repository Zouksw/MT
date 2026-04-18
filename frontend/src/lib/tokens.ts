/**
 * Design Tokens for TradeMind AI Frontend
 * Modern Minimalist Design System
 */

// ============================================================================
// COLORS - LIGHT MODE
// ============================================================================

export const lightColors = {
  // Primary - Refined Blue
  primary: "#0a72ef",
  primaryBg: "#E6F0FA",
  primaryBgHover: "#D6E6F8",
  primaryBorder: "#66B3FF",
  primaryBorderHover: "#3399FF",
  primaryText: "#0055A3",
  primaryTextHover: "#004488",

  // Secondary - Neutral Gray
  secondary: "#6B7280",
  secondaryBg: "#F3F4F6",
  secondaryText: "#4B5563",

  // Success - Refined Green
  success: "#10B981",
  successBg: "#ECFDF5",
  successBorder: "#6EE7B7",

  // Warning - Refined Amber
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  warningBorder: "#FCD34D",

  // Error - Refined Red
  error: "#EF4444",
  errorBg: "#FEF2F2",
  errorBorder: "#FCA5A5",

  // Info - Refined Sky
  info: "#0EA5E9",
  infoBg: "#E0F2FE",
  infoBorder: "#7DD3FC",

  // Neutral Grays (Tailwind-inspired scale)
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

  // Background Layers
  bgContainer: "#FFFFFF",
  bgLayout: "#F9FAFB",
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

  // Accent Colors (for data visualization)
  accent1: "#6366F1", // Indigo
  accent2: "#8B5CF6", // Violet
  accent3: "#EC4899", // Pink
  accent4: "#14B8A6", // Teal
  accent5: "#F97316", // Orange
};

// ============================================================================
// COLORS - DARK MODE
// ============================================================================

export const darkColors = {
  // Primary - Lighter for dark mode
  primary: "#3B82F6",
  primaryBg: "#1E3A5F",
  primaryBgHover: "#2563EB",
  primaryBorder: "#60A5FA",
  primaryBorderHover: "#93C5FD",
  primaryText: "#93C5FD",
  primaryTextHover: "#BFDBFE",

  // Secondary
  secondary: "#9CA3AF",
  secondaryBg: "#1F2937",
  secondaryText: "#D1D5DB",

  // Success
  success: "#34D399",
  successBg: "#064E3B",
  successBorder: "#10B981",

  // Warning
  warning: "#FBBF24",
  warningBg: "#451A03",
  warningBorder: "#F59E0B",

  // Error
  error: "#F87171",
  errorBg: "#450A0A",
  errorBorder: "#EF4444",

  // Info
  info: "#38BDF8",
  infoBg: "#0C4A6E",
  infoBorder: "#0EA5E9",

  // Neutral Grays - Dark Mode (inverted for contrast)
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

  // Background Layers
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

  // Accent Colors
  accent1: "#818CF8", // Indigo (lighter)
  accent2: "#A78BFA", // Violet (lighter)
  accent3: "#F472B6", // Pink (lighter)
  accent4: "#2DD4BF", // Teal (lighter)
  accent5: "#FB923C", // Orange (lighter)
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font Family
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMono:
    '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',

  // Font Sizes (in rem, base 16px)
  fontSizeXS: "0.75rem", // 12px
  fontSizeSM: "0.875rem", // 14px
  fontSizeBase: "1rem", // 16px
  fontSizeLG: "1.125rem", // 18px
  fontSizeXL: "1.25rem", // 20px
  fontSize2XL: "1.5rem", // 24px
  fontSize3XL: "1.875rem", // 30px
  fontSize4XL: "2.25rem", // 36px
  fontSize5XL: "3rem", // 48px

  // Heading Sizes
  fontSizeHeading1: "2.25rem", // 36px
  fontSizeHeading2: "1.875rem", // 30px
  fontSizeHeading3: "1.5rem", // 24px
  fontSizeHeading4: "1.25rem", // 20px
  fontSizeHeading5: "1.125rem", // 18px

  // Font Weights
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 600,

  // Line Heights
  lineHeightTight: 1.25,
  lineHeightBase: 1.5,
  lineHeightRelaxed: 1.75,

  // Letter Spacing
  letterSpacingTight: "-0.025em",
  letterSpacingNormal: "0",
  letterSpacingWide: "0.025em",
};

// ============================================================================
// SPACING (4px base unit)
// ============================================================================

export const spacing = {
  // Base spacing scale
  spacing0: 0,
  spacing1: "0.25rem", // 4px
  spacing2: "0.5rem", // 8px
  spacing3: "0.75rem", // 12px
  spacing4: "1rem", // 16px
  spacing5: "1.25rem", // 20px
  spacing6: "1.5rem", // 24px
  spacing8: "2rem", // 32px
  spacing10: "2.5rem", // 40px
  spacing12: "3rem", // 48px
  spacing16: "4rem", // 64px
  spacing20: "5rem", // 80px
  spacing24: "6rem", // 96px

  // Component-specific padding
  paddingXS: "0.5rem", // 8px
  paddingSM: "0.75rem", // 12px
  paddingMD: "1rem", // 16px
  paddingLG: "1.5rem", // 24px
  paddingXL: "2rem", // 32px

  // Component-specific margins
  marginXS: "0.5rem", // 8px
  marginSM: "0.75rem", // 12px
  marginMD: "1rem", // 16px
  marginLG: "1.5rem", // 24px
  marginXL: "2rem", // 32px

  // Layout gaps
  gapSM: "0.75rem", // 12px
  gapMD: "1rem", // 16px
  gapLG: "1.5rem", // 24px
  gapXL: "2rem", // 32px
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  XS: 2, // Small elements: tags, badges
  SM: 3, // Inputs, buttons
  MD: 4, // Cards, panels - reduced from 8 for more professional look
  LG: 6, // Large cards, modals - reduced from 12
  XL: 8, // Hero sections, special containers - reduced from 16
  Full: 9999, // Pills, avatar circles
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  // Light shadows (subtle depth) - lighter for cleaner look
  XS: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
  SM: "0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  MD: "0 2px 4px 0 rgba(0, 0, 0, 0.08)",
  LG: "0 4px 8px 0 rgba(0, 0, 0, 0.08)",
  XL: "0 8px 16px 0 rgba(0, 0, 0, 0.08)",

  // Dark mode shadows (more opaque)
  darkSM: "0 1px 3px 0 rgba(0, 0, 0, 0.4)",
  darkMD: "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
  darkLG: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",

  // Colored shadows for accents - lighter
  primary: "0 2px 8px 0 rgba(0, 102, 204, 0.12)",
  success: "0 2px 8px 0 rgba(16, 185, 129, 0.12)",
  warning: "0 2px 8px 0 rgba(245, 158, 11, 0.12)",
  error: "0 2px 8px 0 rgba(239, 68, 68, 0.12)",
};

// ============================================================================
// COMPONENT-SPECIFIC TOKENS
// ============================================================================

export const componentTokens = {
  // Button
  buttonHeightSM: 32,
  buttonHeightMD: 40,
  buttonHeightLG: 48,
  buttonPaddingSM: "0.5rem 1rem",
  buttonPaddingMD: "0.625rem 1.25rem",
  buttonPaddingLG: "0.75rem 1.5rem",
  buttonBorderRadius: 3, // Reduced from 6

  // Input
  inputHeightSM: 32,
  inputHeightMD: 40,
  inputHeightLG: 48,
  inputPadding: "0.625rem 0.875rem",
  inputBorderRadius: 3, // Reduced from 6

  // Card
  cardPadding: "1.5rem",
  cardBorderRadius: 4, // Reduced from 12
  cardMarginBottom: "1.5rem",

  // Table
  tableHeaderBg: "transparent",
  tableCellPadding: "1rem 1.25rem",
  tableRowHoverBg: "rgba(0, 102, 204, 0.04)",
  tableBorderRadius: 4, // Reduced from 8

  // Modal
  modalBorderRadius: 6, // Reduced from 12
  modalPadding: "1.5rem",
  modalHeaderPadding: "1.5rem 1.5rem 1rem",
  modalFooterPadding: "1rem 1.5rem 1.5rem",

  // Tag/Badge
  tagBorderRadius: 2, // Reduced from 4
  tagPaddingXS: "0.125rem 0.5rem",
  tagPaddingSM: "0.25rem 0.625rem",
  tagPaddingMD: "0.375rem 0.75rem",
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get color tokens based on mode
 */
export const getColors = (mode: "light" | "dark") =>
  mode === "light" ? lightColors : darkColors;

/**
 * Get shadow based on mode
 */
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
