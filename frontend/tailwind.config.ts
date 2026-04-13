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
        // Vercel Primary - Develop Blue
        primary: {
          DEFAULT: "#0a72ef",
          hover: "#0055A3",
          active: "#004080",
          light: "#ebf5ff",
        },

        // Secondary - Slate Blue
        secondary: {
          DEFAULT: "#475569",
          hover: "#334155",
          light: "#94A3B8",
        },

        // Semantic colors
        success: {
          DEFAULT: "#10B981",
          light: "#D1FAE5",
          dark: "#047857",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light: "#FEF3C7",
          dark: "#B45309",
        },
        error: {
          DEFAULT: "#EF4444",
          light: "#FEE2E2",
          dark: "#B91C1C",
        },
        info: {
          DEFAULT: "#3B82F6",
          light: "#DBEAFE",
          dark: "#1D4ED8",
        },

        // Neutrals - Cool grays
        gray: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Geist", "Arial", "sans-serif"],
        display: ["var(--font-geist-sans)", "Geist", "Arial", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "monospace"],
        code: ["var(--font-geist-mono)", "Geist Mono", "monospace"],
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
      spacing: {
        "2xs": "4px",
        "3xs": "8px", // alias for xs
      },
      borderRadius: {
        "sm": "4px",
        "md": "6px",
        "lg": "8px",
        "xl": "12px",
        "2xl": "16px",
        "pill": "9999px",
      },
      boxShadow: {
        "shadow-border": "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
        "ring-border": "rgb(235, 235, 235) 0px 0px 0px 1px",
        "card": "rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, rgba(0,0,0,0.04) 0px 8px 8px -8px, #fafafa 0px 0px 0px 1px",
        "card-hover": "rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.06) 0px 4px 4px, rgba(0,0,0,0.04) 0px 8px 8px -8px, #fafafa 0px 0px 0px 1px",
        "card-hover-dark": "rgba(0,0,0,0.3) 0px 0px 0px 1px, rgba(0,0,0,0.2) 0px 4px 4px, rgba(0,0,0,0.2) 0px 8px 8px -8px",
        "button-hover": "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 4px 4px",
        "focus": "hsla(212, 100%, 48%, 1) 0px 0px 0px 2px",
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
