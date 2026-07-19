# Known Issues — Open Blockers & Gaps

**Date:** 2026-07-19 (living document — update when an issue is resolved)
**Purpose:** Single index of issues that are *blocking or undermining*
PRODUCT-SPEC goals but are **not actionable in code right now** (need a
decision, a credential, an external dependency, or a scope sign-off).
Use this so we stop re-discovering the same gaps every round.

For work that *is* actionable and queued, see the统筹 section at the bottom.

**2026-07-19 status update:** DATA-2 and TRUST-1 **CLOSED** (G1/G3 shipped).
DATA-3 **RESCINDED** (was a phantom — the table+seed already existed; the
exploration agent's "missing" finding was wrong, verified live). Only
DATA-1 and the SCOPE items remain open.

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
`GET /api/signals/:slug` — but `useMarketForecasts` calls the lighter
`/inference/predict/batch` which lacks those fields.

**Status:** **Actionable — queued (G5).** Two parts: (a) enrich the
forecast hook to surface confidence/modelCount, (b) add a prediction
column to the two main price tables.

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
| **G5** | Inline AI prediction in market board (SCOPE-2) | signals.ts (/batch), useMarketForecasts.ts, MarketForecastBoard.tsx | M2 | M | ✅ shipped 2026-07-19 (1378e5a) |
| **G6** | Wire MLA/USDA-AMS once keys provided (DATA-1) | .env only | M2 data | S | blocked on user credentials |

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
- news Edit UI (PATCH `/api/news/:id` 端点存在但前端无 edit 页/按钮)
- news 详情页嵌入相关商品价格图 (现仅文字链接到 /beef)
- 这些不影响 M3 sign-off 的核心可用性, 留作后续打磨

---

## Out of scope (per PRODUCT-SPEC §九, do not pursue)

- Trade matching / order execution / payments
- Non-beef commodities in the main IA (crude oil, gold, etc. stay in data layer)
- UGC / community
- Native mobile app (responsive web only)
- Paywall / billing (static for now)
