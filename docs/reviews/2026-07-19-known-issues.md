# Known Issues — Open Blockers & Gaps

**Date:** 2026-07-19 (living document — update when an issue is resolved)
**Purpose:** Single index of issues that are *blocking or undermining*
PRODUCT-SPEC goals but are **not actionable in code right now** (need a
decision, a credential, an external dependency, or a scope sign-off).
Use this so we stop re-discovering the same gaps every round.

For work that *is* actionable and queued, see the统筹 section at the bottom.

**2026-07-19 status update:** DATA-2 and TRUST-1 **CLOSED** (G1/G3 shipped).
DATA-3 **RESCINDED** (was a phantom — the table+seed already existed; the
exploration agent's "missing" finding was wrong, verified live). DATA-4
**added** (2026-07-19) — full data-layer audit revealing the "2 healthy
sources" are non-beef; all beef data is seed snapshot. Only DATA-1 (now
informed by DATA-4) and the SCOPE items remain open as blockers.

---

## Issue tracker

### DATA-1 — Beef scraper fleet largely dormant (M1/M2 blocker)

**Impact:** The `/beef` page (core surface per PRODUCT-SPEC M1) has no
fresh per-cut price data beyond the single FRED-fed `beef_carcass_us`
aggregate (carcass, not cuts). 4 of 5 bridge-mapped slugs have zero
upstream rows.

**Verified state (live DB, 2026-07-19):**

| Source | Writes to | Rows | Latest | Root cause |
|---|---|---|---|---|
| `fred` → `beef_carcass_us` | CommodityPrice | 4213 | **2026-07-18** ✅ | Working (public CSV, no key) |
| `cme_futures` → beef futures | CommodityPrice | — | — | Working |
| `mla_nlrs` (AU, 1440 rows frozen 2026-04-30) | BeefCutPrice | 1440 | 2026-04-30 | `MLA_API_KEY=""` |
| `usda_ams` LM_XB405 (US cut-level) | BeefCutPrice | 0 | — | `USDA_MARS_API_KEY=""` |
| `cepea` (BR) | CommodityPrice | 0 | — | **Cloudflare bot challenge** (`cf-mitigated: challenge`, HTTP 403) — `fetch()` cannot pass |
| `inac` (UY) | BeefCutPrice | 0 | — | **Connection timeout** — host unreachable from this server (IP/geo-blocked or URL moved) |

**Resolution paths (require user input, not code):**
- **MLA + USDA-AMS:** user provides API keys → wire into `.env` → both
  scrapers already work end-to-end (key-gated only). Highest-yield fix.
- **CEPEA:** needs a headless-browser scraper (Playwright) to pass the
  Cloudflare challenge. Brittle, ToS-risky — **deferred unless prioritized.**
- **INAC:** confirm the URL is still valid; if the host is geo-blocked,
  consider a proxy or drop the source.

**Bridge workaround (already shipped):** `beefPriceBridge.ts` copies the 5
STRONG-mapped CommodityPrice slugs → BeefCutPrice, but only
`aus_cube_roll_m9` has upstream rows (180, latest 2026-04-29). The bridge
is correctly wired; it can only copy what exists upstream.

---

### DATA-2 — Freshness board lies about silent failures — ✅ CLOSED (G1, 2026-07-19)

**Resolution shipped:** `scraperManager` now flags 0-row runs with
`emptyAfterRun: true`; `/api/market-data/sources` surfaces them as
`status: "empty"` (amber) instead of `healthy` (green). The frontend
data-sources page (`/settings/data-sources`) renders an `Empty` badge
and a separate `Empty Runs` count so operators see silent failures
distinctly from real refreshes. **Live-verified:** after triggering
cepea+inac, `/sources` reports both as `empty` (was `healthy`).
Mutation-verified by 5 new scraperManager tests.

The underlying DATA-1 (sources unreachable) remains — this fix only
stops the board from misreporting it.

---

### DATA-3 — MarketNews migration + seed — ❌ RESCINDED (non-issue)

**Was claimed:** "table doesn't exist, no seed data." **Reality
(verified live 2026-07-19):** the `market_news` table exists, matches
schema.prisma exactly, and contains 5 published seed articles with
proper author + commodity-slug relations. `GET /api/news` returns them
correctly; `GET /api/news/stats` returns `{total:5, published:5}`.

The exploration agent's "absent from all migrations" finding was an
artifact of grepping for the literal string `market_news` — the table
was actually created by the `20260503_catchup` migration's bulk SQL,
which the grep missed. `prisma migrate status` reports
"Database schema is up to date!" No action needed; the M3 资讯 module
is functional as-is.

---

### TRUST-1 — Dashboard fake trend-0 + forced 100% AI active — ✅ CLOSED (G3, 2026-07-19)

**Resolution shipped:**
- All four dashboard trend deltas are now `null` (was hardcoded `0`).
  The StatCard hides its trend badge when null — honest "no trend data"
  instead of a fabricated "0%". Type widened `trend: number → number | null`.
- `aiModels.active` now comes from a separate `?isActive=true` count
  query (was force-set to `total`, fabricating 100% active). The
  "X of Y models" panel and progress bar now reflect real active/total
  ratio. Mutation-verified by a dedicated "active != total" test.

3 tests updated/added in `useDashboardStats.test.ts`.

---

### SCOPE-1 — Dashboard not yet the spec's 行情总览页 (M2)

**Impact:** PRODUCT-SPEC §5.1 wants 进口均价 / 国产均价 / AI 7日预测
as 3 StatCards + 热门部位价格 table (with 7日预测 column) + 资讯流.
Today's `/dashboard` shows a single aggregate avg + 4 internal StatCards
+ alerts/forecasts activity. No import/domestic split, no per-cut table,
no news feed on the dashboard.

**Status:** **Actionable but depends on DATA-1** — a per-cut price table
with inline 7-day prediction is hollow if only 1 cut has fresh data.
Build the table structure now, fill it as data lands. Queued as G4
(structure) + blocked-on-data (real content).

---

### SCOPE-2 — Inline AI prediction not in the main price tables (M2)

**Impact:** PRODUCT-SPEC §5.3 wants every price row to show its 7-day
prediction inline. Today only the dedicated `MarketForecastBoard`
(`beef/page.tsx:124`) shows direction+magnitude+band per cut — and it
**omits confidence and model count**. The primary price tables
("Latest Cut Prices" `beef/page.tsx:144-185`, "Prices by Source"
`trading/page.tsx:312-346`) have zero prediction column.

The backend already returns the full consensus shape (`direction`,
`confidence`, `modelsAgree`, `totalModels`, `predictedChange`) from
`POST /api/signals/batch`, and `useMarketForecasts` now calls it (G5).

**Status:** **Partially shipped — part (a) done in G5 (1378e5a),
part (b) blocked on data (G7).** Two parts: (a) enrich the forecast
hook to surface confidence/modelCount — ✅ done (useMarketForecasts
calls `/api/signals/batch`, MarketForecastBoard shows Confidence +
Models columns); (b) add a prediction column to the two main price
tables — ❌ blocked. Originally written as "easy, data ready"; a live
data audit on 2026-07-19 proved that false. See G7 for the measured
blocker chain.

### DATA-4 — Data layer reality audit (2026-07-19) — worse than DATA-1 implied

**Impact:** DATA-1 framed the data gap as "4 beef sources need API keys."
A live audit of all 19 sources via `/api/market/sources` + per-scraper
log inspection + DB row counts revealed the gap is **structurally wider**:
the platform's core value (beef prices + AI forecasts) currently runs on
**seed snapshots only**, with zero live beef data flowing.

**The "2 healthy sources" are misleading.** `/api/market/sources` reports
`commodity_prices` and `world_bank` as healthy. Both are real and producing,
but **neither feeds beef**:
- `commodity_prices` writes 3 FX pairs (USD/CNY, AUD/USD, BRL/USD).
- `world_bank` writes 12 non-beef series (energy/metals/grains/softs;
  World Bank API is dead, falls back to FRED monthly CSVs).
- The 5 bridge slugs (`aus_cube_roll_m9` etc.) read CommodityPrice rows
  that came from **seed data**, not any scraper.

**Full source classification (19 sources):**

| Category | Sources | Status |
|---|---|---|
| Directly beef (4) | usda_ams, mla_nlrs, inac, cepea | **ALL non-producing**: usda_ams+mla_nlrs key-gated (USDA_MARS_API_KEY, MLA_API_KEY), inac network-blocked, cepea Cloudflare-blocked |
| Beef-adjacent (7) | usda_psd, abares, secex, china_customs_stats, china_wholesale, cme_futures, argentina | **ALL silent-fail**: API endpoints 404/403, regex patterns stale, geo-blocked |
| Macro context (8) | commodity_prices, world_bank, fred, fao_prices, dce_futures, baltic_dry, shipping_index, weather | 2 healthy (FX + non-beef), 4 key-gated, 2 silent-fail |

**`argentina` was a ghost source.** ~~Listed in `server.ts:180`
DAILY_SOURCES and `marketData.ts:234` sourceLabels, but never registered
in `index.ts`.~~ **FIXED 2026-07-19** — removed from both DAILY_SOURCES
and sourceLabels. Source count dropped 19→18. No functionality lost
(it never produced data). The original concern ("rebuild will break
it") was downgraded on inspection: `runSourcesAndLog` catches per-source
throws, so it logged an error daily rather than crashing — still wrong,
now gone.

**`healthy` classifier under-reports problems.** ~~`scraperManager.ts:117`
sets `emptyAfterRun = inserted===0 && updated===0`. But `commodity_prices`
reports `5 updated` (FX) and `world_bank` reports `32 updated`, so both
count as "healthy" despite contributing zero beef rows.~~ **FIXED
2026-07-19** — sources now carry a `beefRelevance` field
(direct/adjacent/macro) and the data-sources board shows a dedicated
"Beef sources healthy: N/M" StatCard. The "2 healthy" count was
technically honest ("wrote ≥1 row") but user-misleading; the new beef
breakdown makes the reality (0/4 beef sources producing) visible at a
glance.

**chronos exists but is NOT in the user-facing consensus.**
inference-service `/models` returns 6 (5 statistical + chronos), but
backend `tradingSignals.ts:25` `ALL_MODELS` lists only 5 (no chronos).
So `signals/batch` consensus runs 5 models. SITE_STATS.aiModels = 5 is
correct for what the user sees, but the "6th model" is stranded.

**Status:** **OPEN — informational, not directly code-actionable.** This
entry records reality so future planning doesn't re-discover it. The
actionable consequences:
- G7 (prediction column) stays blocked until beef data flows (DATA-1).
- ~~`argentina` ghost source is a latent bug~~ **FIXED 2026-07-19**.
- ~~`healthy` classifier should distinguish "producing beef" vs "producing
  anything"~~ **FIXED 2026-07-19** — sources now carry a `beefRelevance`
  field (direct/adjacent/macro); the data-sources board shows a separate
  "Beef sources healthy: N/M" StatCard so a healthy FX source no longer
  masks the fact that zero beef sources are producing.
- chronos integration into backend consensus is a real enhancement
  opportunity (would make aiModels = 6 honest) — queued.

---

## 统筹 — Sequenced work plan

Ordered by: (1) honesty/trust first, (2) unlock M3 module, (3) M2 IA
restructure, (4) data-fill as keys arrive.

| # | Work | Files | Milestone | Effort | Status |
|---|---|---|---|---|---|
| **G1** | Freshness board: surface `empty` state for 0-row runs (DATA-2) | scraperManager.ts, marketData.ts, settings/data-sources/page.tsx | M1 trust | S | ✅ shipped 2026-07-19 |
| **G2** | ~~MarketNews migration + seed~~ RESCINDED — table+seed already exist (DATA-3 invalid) | — | — | — | ❌ non-issue |
| **G3** | Dashboard: kill fake trend-0 + forced 100% AI active (TRUST-1) | useDashboardStats.ts | M1 trust | S | ✅ shipped 2026-07-19 |
| **G4** | Dashboard 行情总览 restructure (SCOPE-1) | dashboard/page.tsx, useDashboardStats.ts | M2 | M | ✅ shipped 2026-07-19 (dab785a) |
| **G5** | Inline AI prediction in market board — part (a) only (SCOPE-2) | signals.ts (/batch), useMarketForecasts.ts, MarketForecastBoard.tsx | M2 | M | ✅ shipped 2026-07-19 (1378e5a) — SCOPE-2 part (a) |
| **G6** | Wire MLA/USDA-AMS once keys provided (DATA-1) | .env only | M2 data | S | blocked on user credentials |
| **G7** | Prediction column in the two main price tables — SCOPE-2 part (b) | beef/page.tsx (Latest Cut Prices), trading/page.tsx (Prices by Source); mapping already exists in beefPriceBridge.ts | M2 | M | **blocked on DATA-1 data** (see audit below) |

### G7 — live data audit (2026-07-19)

Originally scoped as "add a prediction column, data layer is ready." A
live DB audit proved the data layer is **not** ready. The blocker chain,
each link measured against the production database:

1. **29 / 32 beef slugs have zero CommodityPrice points.** Only
   `beef_carcass_us` (4213 pts), `aus_cube_roll_m9` (180),
   `aus_sirloin_m9` (180) have data. The other 29 — including every CN
   domestic, every BRA/ARG/URY cut — have 0 rows. Root cause: MLA and
   USDA-AMS scrapers are key-gated off (DATA-1); CEPEA/INAC are
   network-blocked. Forecasts need price history, so 29 slugs cannot
   produce a forecast today.

2. **The cutCode → slug mapping already exists** — no new code needed.
   `backend/src/services/beefPriceBridge.ts` exports `SLUG_TO_CUTCODE`
   (4 unambiguous entries) + `ISO3_TO_ISO2`, with a fully documented
   AMBIGUOUS block for the 11 slugs that need a manual disambiguation
   decision. The mapping work the original G7 assumed is done.

3. **The bridge is conservative by design** — it only copies slugs with
   a 1:1 unambiguous cutCode. Of the 4 mapped slugs, only
   `aus_cube_roll_m9` has CommodityPrice data, so the bridge produces
   exactly 1 row (`RIB_EYE_ROLL`, `sourceRef=aus_cube_roll_m9`).

4. **That 1 bridge row is invisible in `/prices/latest`.** The route
   (beef.ts:136) slices by the global max date (2026-04-30, held by
   mla_nlrs/cepea seed rows). The bridge row is dated 2026-04-29, so it
   is filtered out. Net: the frontend price table carries zero
   `sourceRef` values, so there is nothing to join a forecast to.

**Implication:** adding a prediction column today would show a real
forecast on 0 of 80 rows. That is a hollow column — the exact anti-pattern
G1/G3 removed. Doing G7 before DATA-1 would re-introduce fake-feeling UI.

**When DATA-1 unblocks:** the bridge will start producing current-dated
rows (today's CommodityPrice close), which will become the global-max
date and surface in `/prices/latest` with their `sourceRef`. At that
point G7 is a pure frontend join: `priceRow.sourceRef → forecastMap[slug]`.
The pre-built mapping in beefPriceBridge.ts already covers the path. A
separate follow-up (G7-latest) may be needed to stop `/prices/latest`
from hiding newer bridge rows when seed data coexists — but only once
real data is flowing, not for the current transitional state.

`S` ≈ half a day, `M` ≈ 1-2 days. **Next recommended batch: G4 + G5**
(M2 restructure — both open, G5 unblocked, G4 structurally buildable).

---

## 2026-07-19 大重构 (R1-R4) — 项目统一与瘦身

独立于上面的 G-系列, 这次大重构目标是**项目状态统一**: 删冗余测试、修死链、
合并重复、统一约定。详见 [reviews/2026-07-19-r1-r4-refactor.md](2026-07-19-r1-r4-refactor.md)
(若存在) 或 git log。

| 批次 | 内容 | 提交 | 结果 |
|---|---|---|---|
| **R1** | 删 44 冗余测试 + 2 个死代码模块 (useOnlineStatus、useRetryableFetch barrel) | `6c674fc` | 测试 840→796 |
| **R2** | 修死链 (/forecasts 404、假密码重置、孤儿 /anomalies) | `07c8534` | 项目内每个入口真实可达 |
| **R3** | fetcher 模式统一 + Modal/dialog 合并 + error UI 共享 + hook 归位 + NAV 图标 | `bde0d8e` | 单一约定, 无重复 |
| **R4** | 文档统一 (废弃过时 ROADMAP, 更新 INDEX/known-issues, 加 CHANGELOG) | (本批) | PRODUCT-SPEC 单一事实来源 |

**审计纠错记录** (审计有误的部分, 已独立验证后保留):
- `/ai/models`、`/ai/backtest` 不是重复 — 各自连真实后端, 与 `/dashboard/models` 互补, 保留
- `animations.ts` + `PageTransition.tsx` 不是死代码 — `PageContainer` (37 页用) 渲染它, 保留
- `components/ui/index.ts` barrel 不是死代码 — 4 个 marketing 页面用, 保留
- `ErrorBoundaryWrapper` 不是重复 — 必要的 server/client 边界样板, 保留

**明确不在本次重构范围** (留待后续):
- AI 推理引擎重写、Prisma 核心 schema 改动
- SMTP 密码重置 / Stripe 计费实现 (删优先)
- inference 引擎内部单元测试补齐 (用户明确少关注测试)
- MLA/USDA-AMS 激活 (依赖用户 API key, 见 DATA-1)
- beefCutNormalizer.ts (852 行) 等大文件拆分 (LOW, 不影响可运行性)

---

## 2026-07-19 M3 增量 — 资讯/分析完善 (commit 031a109)

M3 三项交付 (PRODUCT-SPEC §M3):

| 项 | 内容 | 状态 |
|---|---|---|
| **M3-A** | news→cut 断链修复 (commoditySlug 错当 cutCode → 全部 404) | ✅ shipped |
| **M3-B** | 产地对比页 `/dashboard/analysis/origin` + `GET /api/beef/by-country` + NAV 入口 | ✅ shipped |
| **M3-C** | news 列表 stats endpoint (替代 pageSize=1000 双拉) + 搜索 300ms debounce | ✅ shipped |

**M3 剩余** (deferred, 低优先):
- ~~news Edit UI~~ ✅ shipped (commit 2f4ad82)
- ~~news 详情页嵌入相关商品价格图~~ ✅ shipped (commit 2f4ad82)
- **M3 资讯模块现已完整** (CRUD + 详情价格图 + stats + debounce + 断链修复)。剩余的只有 DATA-1 数据源激活 (待 API key)。

---

## Out of scope (per PRODUCT-SPEC §九, do not pursue)

- Trade matching / order execution / payments
- Non-beef commodities in the main IA (crude oil, gold, etc. stay in data layer)
- UGC / community
- Native mobile app (responsive web only)
- Paywall / billing (static for now)
