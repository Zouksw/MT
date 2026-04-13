/**
 * Common Style Utilities
 *
 * Standardized style utilities using Ant Design theme tokens.
 * Import and use these styles to maintain consistency across the application.
 *
 * @example
 * ```tsx
 * import { useToken } from 'antd/es/theme/internal';
 * import { commonStyles, flexStyles, textStyles } from '@/styles/common';
 *
 * const { token } = useToken();
 *
 * <div style={commonStyles.centeredFlex}>
 *   <span style={textStyles.h1}>Title</span>
 * </div>
 * ```
 */

// Define a minimal theme token interface based on Ant Design's theme structure
interface ThemeTokens {
  // Text colors
  colorText: string;
  colorTextSecondary: string;
  colorTextTertiary: string;
  colorTextQuaternary: string;

  // Background colors
  colorBgContainer: string;
  colorBgElevated: string;
  colorBgLayout: string;

  // Border colors
  colorBorder: string;
  colorBorderSecondary: string;

  // Primary colors
  colorPrimary: string;
  colorPrimaryBg: string;
  colorPrimaryBorder: string;

  // Functional colors
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;

  // Additional color properties
  colorSuccessBg: string;
  colorWarningBg: string;
  colorErrorBg: string;
  colorInfoBg: string;
}

export type Theme = ThemeTokens & Record<string, any>;

// ============================================================================
// Layout Styles
// ============================================================================

/**
 * Flex container utilities
 */
export const flexStyles = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  between: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  start: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  end: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  column: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  columnCenter: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
};

/**
 * Spacing utilities
 */
export const spacingStyles = {
  // Margin
  mb0: { marginBottom: 0 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
  mb32: { marginBottom: 32 },

  mt0: { marginTop: 0 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt24: { marginTop: 24 },
  mt32: { marginTop: 32 },

  mx4: { marginLeft: 4, marginRight: 4 },
  mx8: { marginLeft: 8, marginRight: 8 },
  mx16: { marginLeft: 16, marginRight: 16 },

  my4: { marginTop: 4, marginBottom: 4 },
  my8: { marginTop: 8, marginBottom: 8 },
  my16: { marginTop: 16, marginBottom: 16 },

  // Padding
  p0: { padding: 0 },
  p4: { padding: 4 },
  p8: { padding: 8 },
  p12: { padding: 12 },
  p16: { padding: 16 },
  p20: { padding: 20 },
  p24: { padding: 24 },

  px4: { paddingLeft: 4, paddingRight: 4 },
  px8: { paddingLeft: 8, paddingRight: 8 },
  px16: { paddingLeft: 16, paddingRight: 16 },

  py4: { paddingTop: 4, paddingBottom: 4 },
  py8: { paddingTop: 8, paddingBottom: 8 },
  py16: { paddingTop: 16, paddingBottom: 16 },
};

// ============================================================================
// Typography Styles
// ============================================================================

/**
 * Text size utilities
 */
export const textStyles = {
  // Font sizes
  xs: { fontSize: 11 },
  sm: { fontSize: 12 },
  base: { fontSize: 13 },
  md: { fontSize: 14 },
  lg: { fontSize: 16 },
  xl: { fontSize: 18 },
  '2xl': { fontSize: 20 },
  '3xl': { fontSize: 24 },
  '4xl': { fontSize: 28 },

  // Font weights
  normal: { fontWeight: 400 as const },
  medium: { fontWeight: 500 as const },
  semibold: { fontWeight: 600 as const },
  bold: { fontWeight: 600 as const },

  // Combined typography
  h1: { fontSize: 28, fontWeight: 600 as const, lineHeight: 1.2 },
  h2: { fontSize: 24, fontWeight: 600 as const, lineHeight: 1.2 },
  h3: { fontSize: 20, fontWeight: 600 as const, lineHeight: 1.2 },
  h4: { fontSize: 18, fontWeight: 600 as const, lineHeight: 1.2 },
  h5: { fontSize: 16, fontWeight: 600 as const, lineHeight: 1.2 },
  h6: { fontSize: 14, fontWeight: 600 as const, lineHeight: 1.2 },
  body: { fontSize: 14, fontWeight: 400 as const, lineHeight: 1.5 },
  small: { fontSize: 12, fontWeight: 400 as const, lineHeight: 1.5 },
  tiny: { fontSize: 11, fontWeight: 400 as const, lineHeight: 1.5 },
};

// ============================================================================
// Common Container Styles
// ============================================================================

/**
 * Common layout containers
 */
export const commonStyles = {
  // Full viewport containers
  fullHeight: { minHeight: '100vh' },
  centeredFlex: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card containers
  cardPadding: { padding: '20px' },
  compactPadding: { padding: '16px' },
  cozyPadding: { padding: '24px' },

  // Width containers
  fullWidth: { width: '100%' },
  halfWidth: { width: '50%' },
  autoWidth: { width: 'auto' },
};

// ============================================================================
// Theme-Aware Style Generators
// ============================================================================

/**
 * Create theme-aware text color style
 */
export const textColor = (colorName: string) => (token: Theme) => ({
  color: (token as any)[colorName] || token.colorText,
});

/**
 * Create theme-aware background color style
 */
export const bgColor = (colorName: string) => (token: Theme) => ({
  backgroundColor: (token as any)[colorName] || token.colorBgContainer,
});

/**
 * Create theme-aware border color style
 */
export const borderColor = (colorName: string) => (token: Theme) => ({
  borderColor: (token as any)[colorName] || token.colorBorder,
});

/**
 * Common color utilities
 */
export const colorStyles = (token: Theme) => ({
  // Text colors
  textPrimary: { color: token.colorText },
  textSecondary: { color: token.colorTextSecondary },
  textTertiary: { color: token.colorTextTertiary },
  textQuaternary: { color: token.colorTextQuaternary },

  // Background colors
  bgContainer: { backgroundColor: token.colorBgContainer },
  bgElevated: { backgroundColor: token.colorBgElevated },
  bgLayout: { backgroundColor: token.colorBgLayout },

  // Border colors
  border: { borderColor: token.colorBorder },
  borderSecondary: { borderColor: token.colorBorderSecondary },

  // Primary color
  primary: { color: token.colorPrimary },
  primaryBg: { backgroundColor: token.colorPrimary },
  primaryBorder: { borderColor: token.colorPrimary },

  // Success color
  success: { color: token.colorSuccess },
  successBg: { backgroundColor: token.colorSuccess },

  // Warning color
  warning: { color: token.colorWarning },
  warningBg: { backgroundColor: token.colorWarning },

  // Error color
  error: { color: token.colorError },
  errorBg: { backgroundColor: token.colorError },

  // Info color
  info: { color: token.colorInfo },
  infoBg: { backgroundColor: token.colorInfo },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge multiple style objects
 */
export function mergeStyles(...styles: (React.CSSProperties | undefined)[]): React.CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
}

/**
 * Create a responsive style object
 */
export function responsiveStyle(base: React.CSSProperties, overrides: {
  sm?: React.CSSProperties;
  md?: React.CSSProperties;
  lg?: React.CSSProperties;
  xl?: React.CSSProperties;
}): React.CSSProperties {
  return {
    ...base,
    '@media (min-width: 576px)': overrides.sm,
    '@media (min-width: 768px)': overrides.md,
    '@media (min-width: 992px)': overrides.lg,
    '@media (min-width: 1200px)': overrides.xl,
  } as any;
}

export default {
  flexStyles,
  spacingStyles,
  textStyles,
  commonStyles,
  textColor,
  bgColor,
  borderColor,
  colorStyles,
  mergeStyles,
  responsiveStyle,
};
