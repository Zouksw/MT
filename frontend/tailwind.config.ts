import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — Gold accent (Vercel-style: accent only, NOT on buttons)
        primary: {
          DEFAULT: "#B8860B",
          hover: "#9A7209",
          active: "#7D5D07",
          light: "#FDF6E3",
        },

        // Secondary
        secondary: {
          DEFAULT: "#475569",
          hover: "#334155",
          light: "#94A3B8",
        },

        // Semantic colors
        success: {
          DEFAULT: "#16A34A",
          light: "#F0FDF4",
          dark: "#15803D",
        },
        warning: {
          DEFAULT: "#D97706",
          light: "#FFFBEB",
          dark: "#B45309",
        },
        error: {
          DEFAULT: "#DC2626",
          light: "#FEF2F2",
          dark: "#B91C1C",
        },
        info: {
          DEFAULT: "#B8860B",
          light: "#FDF6E3",
          dark: "#8B6914",
        },

        // Neutrals — standard Tailwind gray
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
          950: "#0A0A0A",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Arial", "Apple Color Emoji", "Segoe UI Emoji", "sans-serif"],
        display: ["var(--font-geist-sans)", "Arial", "Apple Color Emoji", "Segoe UI Emoji", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Roboto Mono", "Menlo", "monospace"],
        code: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Roboto Mono", "Menlo", "monospace"],
      },
      fontSize: {
        "display": ["48px", { lineHeight: "1.1", letterSpacing: "-2.4px" }],
        "h1": ["36px", { lineHeight: "1.2", letterSpacing: "-1.44px" }],
        "h2": ["28px", { lineHeight: "1.25", letterSpacing: "-0.96px" }],
        "h3": ["22px", { lineHeight: "1.3", letterSpacing: "-0.48px" }],
        "h4": ["18px", { lineHeight: "1.4" }],
        "body-lg": ["16px", { lineHeight: "1.5", letterSpacing: "-0.32px" }],
        "body": ["14px", { lineHeight: "1.5" }],
        "body-sm": ["12px", { lineHeight: "1.5" }],
        "data-lg": ["18px", { lineHeight: "1.4" }],
        "data": ["14px", { lineHeight: "1.4" }],
        "data-sm": ["12px", { lineHeight: "1.4" }],
        "code": ["13px", { lineHeight: "1.6" }],
      },
      borderRadius: {
        "sm": "4px",
        "md": "8px",
        "lg": "12px",
        "xl": "16px",
        "2xl": "16px",
        "pill": "9999px",
      },
      boxShadow: {
        "shadow-border": "0 0 0 1px rgba(0, 0, 0, 0.05)",
        "ring-border": "0 0 0 1px rgba(0, 0, 0, 0.1)",
        "card": "0 0 0 1px rgba(0, 0, 0, 0.05)",
        "card-hover": "0 0 0 1px rgba(0, 0, 0, 0.08)",
        "card-hover-dark": "0 0 0 1px rgba(255, 255, 255, 0.12), 0 2px 8px rgba(0, 0, 0, 0.3)",
        "card-elevated": "0 0 0 1px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.08)",
        "card-elevated-dark": "0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.3)",
        "button-hover": "0 0 0 1px rgba(0, 0, 0, 0.08)",
        "focus": "0 0 0 2px rgba(184, 134, 11, 0.6)",
        "shadow-border-dark": "0 0 0 1px rgba(255, 255, 255, 0.08)",
        "card-dark": "0 0 0 1px rgba(255, 255, 255, 0.08)",
      },
      transitionTimingFunction: {
        'enter': 'cubic-bezier(0, 0, 0.2, 1)',
        'exit': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      animation: {
        "skeleton-pulse": "skeleton-pulse 1.5s ease-in-out infinite",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "modal-in": "modal-in 0.3s ease-out",
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "fade-in": {
          "from": { opacity: "0" },
          "to": { opacity: "1" },
        },
        "slide-up": {
          "from": {
            transform: "translateY(10px)",
            opacity: "0",
          },
          "to": {
            transform: "translateY(0)",
            opacity: "1",
          },
        },
        "modal-in": {
          "from": {
            opacity: "0",
            transform: "scale(0.95) translateY(-10px)",
          },
          "to": {
            opacity: "1",
            transform: "scale(1) translateY(0)",
          },
        },
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
