/**
 * Theme Configuration for Ant Design ConfigProvider
 * Commercial SaaS Design System with Glassmorphism
 */

import { RefineThemes } from "@refinedev/antd";
import tokens from "./tokens";

// ============================================================================
// DESIGN TOKENS - GRADIENTS & GLASSMORPHISM
// ============================================================================

export const gradients = {
  primary: "#171717",
  secondary: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  success: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  dark: "linear-gradient(135deg, #434343 0%, #000000 100%)",
  purple: "#171717",
  blue: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
  sunset: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  midnight: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
};

export const glassmorphism = {
  light: {
    background: "rgba(255, 255, 255, 0.7)",
    backgroundHover: "rgba(255, 255, 255, 0.85)",
    border: "rgba(255, 255, 255, 0.3)",
    blur: "blur(10px)",
    shadow: "0 8px 32px rgba(31, 38, 135, 0.15)",
  },
  dark: {
    background: "rgba(17, 25, 40, 0.75)",
    backgroundHover: "rgba(17, 25, 40, 0.85)",
    border: "rgba(255, 255, 255, 0.125)",
    blur: "blur(16px)",
    shadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  },
};

// ============================================================================
// LIGHT THEME
// ============================================================================

export const lightTheme = {
  ...RefineThemes.Blue,
  token: {
    ...RefineThemes.Blue.token,

    // Primary Colors - More vibrant for commercial look
    colorPrimary: "#0a72ef", // Indigo 500
    colorPrimaryBg: "#eef2ff",
    colorPrimaryBgHover: "#e0e7ff",
    colorPrimaryBorder: "#c7d2fe",
    colorPrimaryBorderHover: "#a5b4fc",
    colorPrimaryText: "#ffffff",
    colorPrimaryTextHover: "#f8fafc",

    // Semantic Colors
    colorSuccess: tokens.colors.success,
    colorSuccessBg: tokens.colors.successBg,
    colorSuccessBorder: tokens.colors.successBorder,

    colorWarning: tokens.colors.warning,
    colorWarningBg: tokens.colors.warningBg,
    colorWarningBorder: tokens.colors.warningBorder,

    colorError: tokens.colors.error,
    colorErrorBg: tokens.colors.errorBg,
    colorErrorBorder: tokens.colors.errorBorder,

    colorInfo: tokens.colors.info,
    colorInfoBg: tokens.colors.infoBg,
    colorInfoBorder: tokens.colors.infoBorder,

    // Background Colors
    colorBgContainer: tokens.colors.bgContainer,
    colorBgLayout: tokens.colors.bgLayout,
    colorBgSpotlight: tokens.colors.bgSpotlight,
    colorBgElevated: tokens.colors.bgElevated,

    // Text Colors
    colorText: tokens.colors.text,
    colorTextSecondary: tokens.colors.textSecondary,
    colorTextTertiary: tokens.colors.textTertiary,
    colorTextQuaternary: tokens.colors.textQuaternary,

    // Border Colors
    colorBorder: tokens.colors.border,
    colorBorderSecondary: tokens.colors.borderSecondary,

    // Typography
    fontSize: parseInt(tokens.typography.fontSizeSM), // 14px
    fontSizeHeading1: parseInt(tokens.typography.fontSizeHeading1), // 36px
    fontSizeHeading2: parseInt(tokens.typography.fontSizeHeading2), // 30px
    fontSizeHeading3: parseInt(tokens.typography.fontSizeHeading3), // 24px
    fontSizeHeading4: parseInt(tokens.typography.fontSizeHeading4), // 20px
    fontSizeHeading5: parseInt(tokens.typography.fontSizeHeading5), // 18px
    fontFamily: tokens.typography.fontFamily,

    // Spacing
    marginXS: parseInt(tokens.spacing.marginXS), // 8px
    marginSM: parseInt(tokens.spacing.marginSM), // 12px
    margin: parseInt(tokens.spacing.marginMD), // 16px
    marginMD: parseInt(tokens.spacing.marginMD), // 16px
    marginLG: parseInt(tokens.spacing.marginLG), // 24px
    marginXL: parseInt(tokens.spacing.marginXL), // 32px

    paddingXS: parseInt(tokens.spacing.paddingXS), // 8px
    paddingSM: parseInt(tokens.spacing.paddingSM), // 12px
    padding: parseInt(tokens.spacing.paddingMD), // 16px
    paddingMD: parseInt(tokens.spacing.paddingMD), // 16px
    paddingLG: parseInt(tokens.spacing.paddingLG), // 24px
    paddingXL: parseInt(tokens.spacing.paddingXL), // 32px

    // Border Radius
    borderRadius: tokens.borderRadius.MD, // 8px
    borderRadiusLG: tokens.borderRadius.LG, // 12px
    borderRadiusSM: tokens.borderRadius.SM, // 6px
    borderRadiusXS: tokens.borderRadius.XS, // 4px

    // Shadows
    boxShadow: tokens.shadows.SM,
    boxShadowSecondary: tokens.shadows.MD,

    // Wireframe
    wireframe: false,
  },
  components: {
    ...RefineThemes.Blue.components,

    // Layout
    Layout: {
      headerBg: tokens.colors.gray900,
      headerHeight: 64,
      siderBg: tokens.colors.gray900,
      bodyBg: tokens.colors.bgLayout,
    },

    // Table
    Table: {
      headerBg: tokens.colors.gray50,
      headerSplit: false,
      borderColor: tokens.colors.border,
      borderRadius: tokens.borderRadius.MD,
      cellPaddingInline: parseInt(tokens.spacing.paddingLG),
      cellPaddingBlock: parseInt(tokens.spacing.paddingMD),
    },

    // Card
    Card: {
      borderRadiusLG: tokens.borderRadius.LG,
      paddingLG: parseInt(tokens.spacing.paddingLG),
    },

    // Button
    Button: {
      borderRadius: tokens.componentTokens.buttonBorderRadius,
      controlHeight: tokens.componentTokens.buttonHeightMD,
      controlHeightLG: tokens.componentTokens.buttonHeightLG,
      controlHeightSM: tokens.componentTokens.buttonHeightSM,
      paddingInline: parseInt(tokens.spacing.paddingMD),
      paddingInlineSM: parseInt(tokens.spacing.paddingSM),
      paddingInlineLG: parseInt(tokens.spacing.paddingLG),
      fontWeightPrimary: 500,
    },

    // Input
    Input: {
      borderRadius: tokens.componentTokens.inputBorderRadius,
      controlHeight: tokens.componentTokens.inputHeightMD,
      controlHeightLG: tokens.componentTokens.inputHeightLG,
      controlHeightSM: tokens.componentTokens.inputHeightSM,
      paddingInline: parseInt(tokens.spacing.paddingSM),
    },

    // Select
    Select: {
      borderRadius: tokens.componentTokens.inputBorderRadius,
      controlHeight: tokens.componentTokens.inputHeightMD,
      controlHeightLG: tokens.componentTokens.inputHeightLG,
      controlHeightSM: tokens.componentTokens.inputHeightSM,
    },

    // Modal
    Modal: {
      borderRadius: tokens.componentTokens.modalBorderRadius,
      contentBg: tokens.colors.bgContainer,
    },

    // Tag
    Tag: {
      borderRadius: tokens.componentTokens.tagBorderRadius,
    },

    // Form
    Form: {
      itemMarginBottom: parseInt(tokens.spacing.marginLG),
      verticalLabelPadding: parseInt(tokens.spacing.paddingXS),
    },

    // Tabs
    Tabs: {
      itemActiveColor: tokens.colors.primary,
      itemSelectedColor: tokens.colors.primary,
      inkBarColor: tokens.colors.primary,
      itemHoverColor: tokens.colors.primaryTextHover,
    },

    // Menu
    Menu: {
      itemBorderRadius: tokens.borderRadius.SM,
      itemMarginInline: parseInt(tokens.spacing.spacing2),
      itemMarginBlock: parseInt(tokens.spacing.spacing1),
      itemPaddingInline: parseInt(tokens.spacing.paddingMD),
      itemPaddingBlock: parseInt(tokens.spacing.paddingSM),
    },

    // Pagination
    Pagination: {
      borderRadius: tokens.borderRadius.SM,
      itemSizeBG: parseInt(tokens.spacing.paddingMD),
    },
  },
};

// ============================================================================
// DARK THEME
// ============================================================================

export const darkTheme = {
  ...RefineThemes.Blue,
  token: {
    ...RefineThemes.Blue.token,

    // Primary Colors - Professional blue for dark mode
    colorPrimary: "#3b82f6", // Blue 500
    colorPrimaryBg: "rgba(0, 102, 204, 0.15)",
    colorPrimaryBgHover: "rgba(0, 102, 204, 0.25)",
    colorPrimaryBorder: "rgba(0, 102, 204, 0.3)",
    colorPrimaryBorderHover: "rgba(0, 102, 204, 0.5)",
    colorPrimaryText: "#ffffff",
    colorPrimaryTextHover: "#f1f5f9",

    // Semantic Colors - More vibrant
    colorSuccess: "#34d399", // Emerald 400
    colorSuccessBg: "rgba(52, 211, 153, 0.15)",
    colorSuccessBorder: "rgba(52, 211, 153, 0.3)",

    colorWarning: "#fbbf24", // Amber 400
    colorWarningBg: "rgba(251, 191, 36, 0.15)",
    colorWarningBorder: "rgba(251, 191, 36, 0.3)",

    colorError: "#f87171", // Red 400
    colorErrorBg: "rgba(248, 113, 113, 0.15)",
    colorErrorBorder: "rgba(248, 113, 113, 0.3)",

    colorInfo: "#60a5fa", // Blue 400
    colorInfoBg: "rgba(96, 165, 250, 0.15)",
    colorInfoBorder: "rgba(96, 165, 250, 0.3)",

    // Background Colors - Dark mode with glassmorphism
    colorBgContainer: "#1e293b", // Slate 800
    colorBgLayout: "#0f172a", // Slate 900
    colorBgSpotlight: "#334155", // Slate 700
    colorBgElevated: "#1e293b", // Slate 800

    // Text Colors
    colorText: "#f1f5f9", // Slate 100
    colorTextSecondary: "#cbd5e1", // Slate 300
    colorTextTertiary: "#94a3b8", // Slate 400
    colorTextQuaternary: "#64748b", // Slate 500

    // Border Colors
    colorBorder: "#334155", // Slate 700
    colorBorderSecondary: "#1e293b", // Slate 800

    // Typography
    fontSize: parseInt(tokens.typography.fontSizeSM), // 14px
    fontSizeHeading1: parseInt(tokens.typography.fontSizeHeading1), // 36px
    fontSizeHeading2: parseInt(tokens.typography.fontSizeHeading2), // 30px
    fontSizeHeading3: parseInt(tokens.typography.fontSizeHeading3), // 24px
    fontSizeHeading4: parseInt(tokens.typography.fontSizeHeading4), // 20px
    fontSizeHeading5: parseInt(tokens.typography.fontSizeHeading5), // 18px
    fontFamily: tokens.typography.fontFamily,

    // Spacing
    marginXS: parseInt(tokens.spacing.marginXS), // 8px
    marginSM: parseInt(tokens.spacing.marginSM), // 12px
    margin: parseInt(tokens.spacing.marginMD), // 16px
    marginMD: parseInt(tokens.spacing.marginMD), // 16px
    marginLG: parseInt(tokens.spacing.marginLG), // 24px
    marginXL: parseInt(tokens.spacing.marginXL), // 32px

    paddingXS: parseInt(tokens.spacing.paddingXS), // 8px
    paddingSM: parseInt(tokens.spacing.paddingSM), // 12px
    padding: parseInt(tokens.spacing.paddingMD), // 16px
    paddingMD: parseInt(tokens.spacing.paddingMD), // 16px
    paddingLG: parseInt(tokens.spacing.paddingLG), // 24px
    paddingXL: parseInt(tokens.spacing.paddingXL), // 32px

    // Border Radius
    borderRadius: tokens.borderRadius.MD, // 8px
    borderRadiusLG: tokens.borderRadius.LG, // 12px
    borderRadiusSM: tokens.borderRadius.SM, // 6px
    borderRadiusXS: tokens.borderRadius.XS, // 4px

    // Shadows (darker for dark mode)
    boxShadow: tokens.shadows.darkSM,
    boxShadowSecondary: tokens.shadows.darkMD,

    // Wireframe
    wireframe: false,
  },
  components: {
    ...RefineThemes.Blue.components,

    // Layout
    Layout: {
      headerBg: tokens.darkColors.bgLayout,
      headerHeight: 64,
      siderBg: tokens.darkColors.bgLayout,
      bodyBg: tokens.darkColors.bgLayout,
    },

    // Table
    Table: {
      headerBg: tokens.darkColors.bgContainer,
      headerSplit: false,
      borderColor: tokens.darkColors.border,
      borderRadius: tokens.borderRadius.MD,
      cellPaddingInline: parseInt(tokens.spacing.paddingLG),
      cellPaddingBlock: parseInt(tokens.spacing.paddingMD),
    },

    // Card
    Card: {
      borderRadiusLG: tokens.borderRadius.LG,
      paddingLG: parseInt(tokens.spacing.paddingLG),
    },

    // Button
    Button: {
      borderRadius: tokens.componentTokens.buttonBorderRadius,
      controlHeight: tokens.componentTokens.buttonHeightMD,
      controlHeightLG: tokens.componentTokens.buttonHeightLG,
      controlHeightSM: tokens.componentTokens.buttonHeightSM,
      paddingInline: parseInt(tokens.spacing.paddingMD),
      paddingInlineSM: parseInt(tokens.spacing.paddingSM),
      paddingInlineLG: parseInt(tokens.spacing.paddingLG),
      fontWeightPrimary: 500,
    },

    // Input
    Input: {
      borderRadius: tokens.componentTokens.inputBorderRadius,
      controlHeight: tokens.componentTokens.inputHeightMD,
      controlHeightLG: tokens.componentTokens.inputHeightLG,
      controlHeightSM: tokens.componentTokens.inputHeightSM,
      paddingInline: parseInt(tokens.spacing.paddingSM),
      colorBgContainer: tokens.darkColors.bgLayout,
    },

    // Select
    Select: {
      borderRadius: tokens.componentTokens.inputBorderRadius,
      controlHeight: tokens.componentTokens.inputHeightMD,
      controlHeightLG: tokens.componentTokens.inputHeightLG,
      controlHeightSM: tokens.componentTokens.inputHeightSM,
      colorBgContainer: tokens.darkColors.bgLayout,
    },

    // Modal
    Modal: {
      borderRadius: tokens.componentTokens.modalBorderRadius,
      contentBg: tokens.darkColors.bgContainer,
    },

    // Tag
    Tag: {
      borderRadius: tokens.componentTokens.tagBorderRadius,
    },

    // Form
    Form: {
      itemMarginBottom: parseInt(tokens.spacing.marginLG),
      verticalLabelPadding: parseInt(tokens.spacing.paddingXS),
    },

    // Tabs
    Tabs: {
      itemActiveColor: tokens.darkColors.primary,
      itemSelectedColor: tokens.darkColors.primary,
      inkBarColor: tokens.darkColors.primary,
      itemHoverColor: tokens.darkColors.primaryTextHover,
    },

    // Menu
    Menu: {
      itemBorderRadius: tokens.borderRadius.SM,
      itemMarginInline: parseInt(tokens.spacing.spacing2),
      itemMarginBlock: parseInt(tokens.spacing.spacing1),
      itemPaddingInline: parseInt(tokens.spacing.paddingMD),
      itemPaddingBlock: parseInt(tokens.spacing.paddingSM),
    },

    // Pagination
    Pagination: {
      borderRadius: tokens.borderRadius.SM,
      itemSizeBG: parseInt(tokens.spacing.paddingMD),
    },
  },
};

export default { lightTheme, darkTheme };
