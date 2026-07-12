# Round M2 — AI 预测融入主流程

**Date:** 2026-07-12
**Milestone:** M2 (AI 预测融入主流程) from `docs/PRODUCT-SPEC.md` §8
**Status:** ✅ Complete — tsc clean, next build exit 0, jest 304/304

## Goal

Make AI prediction a first-class part of the market view instead of a buried
subpage. Per PRODUCT-SPEC: the product is a 牧集网-style beef trade data board
augmented with IoTDB-AINode-style prediction — the forecast lives next to the
price, not behind a form.

## What changed

### M2-1 — Shared number formatter (`src/lib/format.ts`)

Single source of truth for price / percent / compact display. Replaces the 30
files of ad-hoc `toFixed(2)` / `$${x}` string concatenation with locale-aware
`Intl.NumberFormat`.

- `formatPrice(value, includeUnit)` → `$4.52/kg` (beef USD/kg default)
- `formatPriceRange(min, max)` → `$4.20 — $4.80/kg`
- `formatPercent(fraction, digits)` → `78%` (fractional input, 0–1)
- `formatPercentValue(value, digits)` → `5.2%` (already-scaled input)
- `formatSignedPercent(value, digits)` → `+2.3%` / `-1.1%`
- `formatCompact(value)` → `12.3K` (large counts)
- `formatCount(value)` → `1,234` with compact fallback above 100k
- `formatDecimal(value, digits)` → `4.52` (non-price numerics)
- `toNum(value)` → normalizes Prisma Decimal / string / number

29 unit tests in `src/lib/__tests__/format.test.ts`. Migrated `forecasts/page.tsx`
CSV export + table columns as the first consumer.

### M2-2 — Color semantic enforcement

**Rule (PRODUCT-SPEC):** green = up, red = down, **ONLY for market direction.**
Confidence / severity / freshness / anomaly status use blue / amber / gray.

- `forecasts/page.tsx` confidence: `success`(green) → `info`(blue); now uses
  `formatPercent`. Anomaly Yes/No: red/green → amber/muted. Algorithm tags:
  LSTM=green/ENSEMBLE=red → primary/info (model type is not direction).
- `StatCard` gained an `info` variant (blue `#2563EB`) for non-directional
  counts; fixed stale primary `#B8860B` → unified `#8B6914`.
- Gold unification sweep: `chart-config.ts` + 7 CSS files + 18 TS files still
  referenced the old `#B8860B`/`#D4A030`/`#9A7209` palette (M1 leftover).
  Batch-aligned to `#8B6914`/`#A8821C`/`#6B4F04` so charts now match the design
  system. `tokens.css` `--color-info` fixed too.

### M2-3 — Dashboard 行情总览重构

Replaced inventory-count StatCards with a **beef-price KPI hero**:

- Hero shows **Beef Average Price** (computed live from `/beef/prices/latest`)
  with min–max range, coverage %, and tracked-cuts count. Falls back to an
  honest "warming up" empty state when no price data exists.
- Supporting cards: Factories, Price Records (compact), Datasets, Alerts.
  Variants fixed to `info`/`primary` — no misleading green for non-direction.
- **Removed the hardcoded `aiModels: {active:8, total:8}` fake.** Now sourced
  from the models registry; the AI panel renders only when `total > 0`.
- Hook (`useDashboardStats`) derives `avgPrice/minPrice/maxPrice/coverage/
  latestDate` from the price array.

### M2-4 — AI prediction woven into market rows

New `MarketForecastBoard` component mounted on `/beef` (above the cut-prices
table). This is the product's signature experience: each beef commodity shows
its latest price **inline with a 7-day AI forecast** (↑2.3%, confidence band).

- `useMarketForecasts` hook: fetches beef_cut commodities → latest price per
  slug → batch-predicts (`/inference/predict/batch`, ARIMA, horizon 7).
  Computes `changePct` from latestPrice → forecastEnd.
- **Auth-aware:** permission state is `loading` / `allowed` / `no-token` /
  `denied`. Unauthenticated users see a "Sign in for forecast" affordance;
  VIEWER (free tier) sees "Pro feature" — never a silent empty board.
- **Color rule enforced:** green = forecast up, red = forecast down ONLY.
  Confidence band is muted; permission badges use primary (gold).
- Verified end-to-end against the live inference service
  (`aus_cube_roll_m9`, 180 price points, ARIMA returns real forecasts).

4 hook tests + permission matrix coverage.

## Files

**New:**
- `frontend/src/lib/format.ts`
- `frontend/src/lib/__tests__/format.test.ts`
- `frontend/src/hooks/useMarketForecasts.ts`
- `frontend/src/hooks/__tests__/useMarketForecasts.test.tsx`
- `frontend/src/components/market/MarketForecastBoard.tsx`

**Modified:**
- `frontend/src/app/forecasts/page.tsx` — formatter + color semantics
- `frontend/src/app/dashboard/page.tsx` — KPI hero restructure
- `frontend/src/app/dashboard/__tests__/page.test.tsx` — updated assertions
- `frontend/src/app/beef/page.tsx` — mount MarketForecastBoard
- `frontend/src/hooks/useDashboardStats.ts` — derived beef price stats, real AI count
- `frontend/src/hooks/__tests__/useDashboardStats.test.ts` — real AI count
- `frontend/src/components/ui/StatCard.tsx` — `info` variant, unified gold
- `frontend/src/lib/chart-config.ts` — unified gold palette
- `frontend/src/styles/tokens.css` + 7 CSS files — gold unification sweep

## Verification

- `npx tsc --noEmit` → clean
- `npx next build` → exit 0, 46/46 pages generated
- `jest` → **304/304 passed** (was 272; +32 new tests)
- Live inference verified: `POST /api/inference/predict` returns real ARIMA
  forecasts for beef commodities with price history

## Next (M3)

Per PRODUCT-SPEC §8, M3 is the 资讯/analysis module + brand polish. Deferred
from this round: R28b (3-commodity unit normalization), H1 (35-file card
migration), and migrating the remaining ~28 files' `toFixed` calls to the new
formatter in batches.
