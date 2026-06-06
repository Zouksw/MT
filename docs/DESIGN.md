# Design System — MT Platform

## Product Context

- **What this is**: MT Platform — 大宗商品市场信息与分析平台 (commodity market information & analytics)
- **Who it's for**: 商品分析师、贸易商、市场研究员
- **Space/industry**: Commodity Markets / Price Analysis / AI Predictions
- **Project type**: 信息展示平台（营销网站 + 数据仪表板 + AI 信号引擎）
- **Current tech**: Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
- **NOT**: 交易平台. 不涉及下单、账户余额、订单执行.

## Aesthetic Direction

- **Direction**: Refined Industrial — 数据驱动的专业感，温暖不冰冷
- **Decoration level**: Intentional — 微妙但精心设计的视觉层次
- **Mood**: 专业可靠、工业级精度、现代不冰冷、数据优先但易用
- **Reference sites**:
  - [Grafana](https://grafana.com) — 数据密集布局参考
  - [TradingView](https://www.tradingview.com) — 金融图表交互参考
  - [Linear](https://linear.app) — 现代应用交互参考

---

## Typography

### Font Stack

通过 Next.js `next/font/google` 加载 Geist 字体族:

- **Sans** (body, UI): Geist Sans — weights 400/500/600 only
- **Mono** (data, code): Geist Mono — weights 400/500/600 only
- **Display**: Geist Sans (same family, used at larger sizes)

### Type Scale

| Token | Size | Line Height | Letter Spacing | Usage |
|-------|------|-------------|----------------|-------|
| display | 48px | 1.1 | -2.4px | Hero headlines |
| h1 | 36px | 1.2 | -1.44px | Page titles |
| h2 | 28px | 1.25 | -0.96px | Section headers |
| h3 | 22px | 1.3 | -0.48px | Card headers |
| h4 | 18px | 1.4 | — | Sub-headers |
| body-lg | 16px | 1.5 | -0.32px | Feature descriptions |
| body | 14px | 1.5 | — | Default body text |
| body-sm | 12px | 1.5 | — | Metadata, captions |
| data-lg | 18px | 1.4 | — | Large data values |
| data | 14px | 1.4 | — | Default data values |

### Font Weights

**Only use 400, 500, 600.** Never use `font-bold` (700) or `font-light` (300).
Use `font-semibold` (600) for emphasis, `font-medium` (500) for labels.

---

## Color

### Primary — DarkGoldenrod Gold

| Token | Hex | Usage |
|-------|-----|-------|
| primary | `#B8860B` | Accent color, CTAs, highlights, chart primary |
| primary-hover | `#9A7209` | Hover state |
| primary-active | `#7D5D07` | Active/pressed state |
| primary-light | `#FDF6E3` | Backgrounds, subtle highlights |

### Neutrals — Standard Tailwind Gray

| Token | Hex | Usage |
|-------|-----|-------|
| gray-950 | `#0A0A0A` | Page background |
| gray-900 | `#111827` | Card backgrounds |
| gray-800 | `#1F2937` | Elevated surfaces |
| gray-700 | `#374151` | Borders, dividers |
| gray-600 | `#4B5563` | Secondary text |
| gray-500 | `#6B7280` | Muted text |
| gray-400 | `#9CA3AF` | Placeholder text |
| gray-300 | `#D1D5DB` | Disabled borders |
| gray-50 | `#F9FAFB` | Light mode background |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| success | `#16A34A` | Bullish signals, positive changes |
| warning | `#D97706` | Caution, moderate alerts |
| error | `#DC2626` | Bearish signals, errors, critical alerts |
| info | `#B8860B` | Informational (same as primary) |

### Chart Color System

Chart colors are defined in `frontend/src/lib/chart-config.ts`:
- **Primary series**: Gold variants (#B8860B, #D4A030, #8B6914)
- **Market semantic**: Bullish green (#16A34A), Bearish red (#DC2626)
- **Multi-series overlay**: Gold, Copper (#B87333), Bronze (#CD7F32), Pewter (#96A8A1), Tungsten (#7A7A8E)

---

## Spacing

- **Base unit**: 4px (Tailwind default)
- **Common spacing**: `p-4` (16px), `p-6` (24px), `gap-4` (16px), `gap-6` (24px)
- **Density**: Compact but breathable — data tables use `px-4 py-3`, cards use `p-6`

---

## Layout

### Grid System

- **Use 2-column grids** for data-heavy layouts (commodity cards, signal panels)
- **Avoid 3-column grids** — too cramped on data-dense pages
- **Max content width**: `max-w-7xl` (1280px)

### Border Radius

- **Minimum: `rounded` (4px)** — nothing smaller
- Cards: `rounded-lg` (8px)
- Buttons: `rounded-md` (6px)
- Inputs: `rounded-md` (6px)
- Badges/tags: `rounded` (4px)
- **No `rounded-sm` or `rounded-[2px]`**

### Shadows (Border-as-Shadow Technique)

Instead of colored borders, use subtle shadows for card elevation:
```css
border: 1px solid transparent;  /* shadow-as-border */
box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05);
```

---

## Components

### Buttons
- **Primary**: Gold bg (#B8860B), white text, `rounded-md`, `font-medium`
- **Secondary**: Gray-800 bg, gray-300 text, `rounded-md`
- **Ghost**: Transparent bg, primary text, hover: primary-light bg

### Cards
- **Dark mode**: `bg-gray-900` bg, subtle border via shadow technique, `rounded-lg`
- **Content**: `p-6` padding, clear header/body separation

### Data Tables
- **Header**: `text-xs font-medium text-muted-foreground`
- **Rows**: `px-4 py-3`, hover state with `hover:bg-accent/50`
- **No colored left-borders on rows**

### Badges
- **Signal badges**: BUY (success), SELL (error), HOLD (gray-400)
- **Status badges**: Subtle bg + text color, `rounded` radius

---

## Page Templates

### 1. Marketing Landing
- Hero with large display text + gold accent
- Feature grid (2-column) with icon cards
- Pricing section (2-tier)

### 2. Dashboard
- Grid of metric cards (2-column on desktop)
- ProfessionalChart component with OHLCV candlestick
- Market factors panel (expandable groups)
- AI signal consensus panel

### 3. Data Table
- Search + filter bar
- Commodity list with price, change %, signal
- Responsive: cards on mobile, table on desktop

### 4. AI Signal Panel
- Model comparison table (8 models)
- Prediction overlays on chart
- Backtest results with MAPE metrics
- Confidence interval bars

### 5. Commodity Detail
- Professional chart with multi-source overlay
- Price statistics summary
- Related factors panel
- AI prediction section

---

## Accessibility

- **Contrast**: All text meets WCAG AA (4.5:1 for body, 3:1 for large text)
- **Gold on dark**: `#B8860B` on `#0A0A0A` passes AA for large text, use white for body text
- **Focus**: Visible focus rings on all interactive elements
- **Keyboard**: Full keyboard navigation support

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/tailwind.config.ts` | Color tokens, font families, type scale |
| `frontend/src/lib/chart-config.ts` | Chart colors, tooltip styles |
| `frontend/src/app/globals.css` | CSS variables, base styles |
| `frontend/src/app/layout.tsx` | Font loading, root layout |
| `frontend/src/components/ui/` | shadcn/ui component library |

---

## Design Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05 | Gold (#B8860B) as primary | Commodity/precious metal association, professional warmth |
| 2026-05 | Removed Ant Design/Refine | Simplified to Tailwind + shadcn/ui for full design control |
| 2026-05 | 2-column grid standard | Data-heavy pages need space; 3-column too cramped |
| 2026-05 | font-semibold max | font-bold (700) too heavy for dark backgrounds |
| 2026-05 | Shadow-as-border | Cleaner than colored borders on dark theme |
