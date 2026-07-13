# Multi-Skill Re-Evaluation — Project State & Development Plan

**Date:** 2026-07-13
**Skills applied:** ops-check, gen-tests, design-review, investigate (data/automation)
**Method:** 3 parallel Explore agents + ops diagnostic sweep + standalone-fix regression caught & fixed

---

## Ops Status (ops-check)

```
OPS STATUS — 2026-07-13
═══════════════════════════════════════
Mode: PM2
frontend:  [UP :3000]   restarts: 0   /landing: 200   CSS assets: 200
backend:   [UP :8000]   restarts: 5   /api/beef/cuts: 200
inference: [UP :10810]                /health: 200
postgres:  [UP :5432]
redis:     [UP :6379]   PONG
disk:      26G/40G (68%)   mem: 3.4G/14G used (10G avail)
═══════════════════════════════════════
```

**Regression caught & fixed this session:** C4 cleanup added `output:'standalone'` to
next.config (intended to fix Dockerfile), but this broke the PM2 deployment — `next start`
refuses to run with standalone output, and the standalone server.js couldn't locate
`_next/static` (CSS/JS returned 404). Reverted: both PM2 and Dockerfile now use `next start`.
**Lesson:** config changes that affect the build mode must be smoke-tested against the
running PM2 process + a static-asset fetch, not just `next build` exit code.

---

## Dimension 1 — Test Coverage (gen-tests)

**Current:** backend 431 tests (36 files), frontend 307 tests (23 files), inference **0 tests**.

### P0 gaps (money/auth/ownership — untested = exploitable)
| Gap | File | Risk |
|---|---|---|
| **Paywall enforcement** | `usageService.ts:46` `checkLimit()` | Free users could bypass plan limits (free=5, pro=50 watchlist items). Pure function, trivial to test. |
| **Market-news ownership** | `marketNewsService.ts:79` `getManagedNews()` | Author-or-admin check only tested with admin token. No two-non-admin-user test proving editor B can't edit editor A's post. |
| **Inference validation** | `inference-service/routers/predict.py` | Zero tests in the whole Python service. Pydantic validation + endpoint contracts untested. |
| **Auth core** | `authService.ts` (353 lines) | Password reset, session issuance — only lockout+blacklist tested. |

### P1 gaps (important logic)
- `alertNotifications.ts` `checkSignalChange()` — side-effectful (DB+WebSocket+email), untested
- `datasetService.ts` write-path ownership (only getDataset IDOR tested)
- `anomalyService.ts` detection algorithms — z-score/rule-based math untested

### Quality issues in existing tests
- `billing.test.ts:73-87` — cancel test uses tautological `if (success) {...} else { expect 400 }` — passes regardless
- `correlationAnalysis.test.ts` — every test `if (!serverAvailable) return;` → silently skips entirely
- Many route tests `if (!dbAvailable) return;` — CI without Postgres runs zero assertions

---

## Dimension 2 — Frontend Design (design-review)

### CRITICAL (fake/fabricated — trust damage)
- **C1: Leadership Team** (`about/page.tsx:241-346`) — 3 invented executives (Marcus Chen/Elena Vasquez/David Okonkwo) with picsum photos + fabricated bios claiming ETH Zurich, Bloomberg, "top-5 trading firm". **Still present, flagged but never removed.**
- **C2: Hero "Live" label** (`Hero.tsx:220-223`) — dashboard mockup shows pulsing green "Live" dot on hardcoded static prices. Same class of fake claim M1/M2 fixed elsewhere.
- **C3: Model-count contradiction** — simultaneously 6 (about/Hero headline), 7 (GettingStarted/auth/pricing), 8 (Hero metrics/Features/SocialProof). No single source of truth.
- **C4: Timeseries "Storage" stat** (`timeseries/page.tsx:256`) — always renders "-".

### HIGH (inconsistency)
- **H1: Stale gold rgba survives** — M2 unified hex to #8B6914 but the tint/accent gold is still old `rgba(184,134,11,…)` (#B8860B) in 28+ places (tokens.css gold-tint, all styles/*.css tints/rings, Hero sparkline). Two golds on screen at once.
- **H2: Color semantic drift** — blue/amber/purple/emerald used outside allowed roles across beef/factories/forecasts/settings/trading/dashboard pages (documented 15+ sites).
- **H3: StatCard variant misuse** — directional colors (success/warning) on neutral counts (beef slaughter, cold storage, anomaly counts).
- **H4: 3 card dialects** — app pages (rounded-lg+shadow-sm), marketing (rounded-2xl+ring), AI pages (custom rgba box-shadow). 35 hand-rolled card divs.
- **H5: 2 duplicate local StatCard** (`datasets/page.tsx:18`, `timeseries/page.tsx:18`) ignoring shared ui/StatCard.
- **H6: 3 duplicate marketing nav** — about/pricing/landing each hand-build their own top bar.

### MEDIUM
- **M1: 91 toFixed calls remain** in 28 files — user-visible on trading/beef price displays (PriceForecastPanel 3xl headline, trading tables, beef avg/distribution). Buried in chart tooltips/CSV export (fine).
- **M2: Breadcrumb language mixing** — "资讯" (Chinese) alongside "Market News" (English) in nav/breadcrumbs.

---

## Dimension 3 — Data Quality & Automation (investigate)

### Live data coverage — sparse and lopsided
| Metric | Value |
|---|---|
| beef_cuts commodities | 32 |
| beef_cuts WITH price data | **3 (9.4%)** — only beef_carcass_us, aus_cube_roll_m9, aus_sirloin_m9 |
| Active commodities with zero prices | **71/111 (64%)** — subscribed to predictor but can never predict |
| BeefCutPrice rows | 2,400, but **frozen at 2026-04-30** (~10 weeks stale, one-shot seed) |
| BeefCutTaxonomy cuts with prices | 16/74 (22%) |

### Prediction health — generates hot, verifies cold
| Metric | Value |
|---|---|
| Total PredictionLog | 47,003 (46,895 completed, 108 verified) |
| Predictions in last 48h | 10,369 — **scheduler is actively running** ✅ |
| Beef commodities verified | **0 of 3** — verify loop broken for all beef ❌ |
| Verifiable candidates | 581, but only 24 verified in 48h (batch sampling issue) |

**Root cause of broken verify:** `mapeTracking.ts:118` uses `cutoff = now - 7d`, but beef
predictions are too recent OR have zero post-prediction actuals (frozen data). The daily
`take: 500` ordered by `predictedAt DESC` keeps re-sampling the same near-cutoff rows.

### Alert rules — confirmed dead-end
- `createAlertRule` works (writes to alert_rules table)
- `evaluate`/`trigger`/`getActive` were **deleted as dead code** — nothing evaluates rules
- DB state: 0 rules, 0 alerts, 0 anomalies. `lastTriggeredAt` can never be set.
- `alertNotifications.checkSignalChange()` has **zero non-test callers**.

### Scraper health
- **7 sources healthy** (mla_nlrs, cepea, china_wholesale, usda_ams, cme_futures, inac, commodity_prices)
- **12 sources dormant** (return 0 inserted, log "success" masking failure)
- **2 hard-failing**: weather (empty OPENWEATHER_API_KEY), fred (missing FRED_API_KEY)
- **No beef-cut scraper feeds CommodityPrice** — BeefCutPrice is a separate frozen table

---

## Prioritized Development Plan

Based on the three dimensions, the gaps cluster into **4 phases**. Ordered by
trust-impact × feasibility.

### Phase D1 — Data Integrity (highest leverage, the product's core value)
The platform's reason to exist is beef price data + AI prediction. Right now beef data
is 9.4% coverage, frozen 10 weeks ago, and the verify loop is broken for all beef.

1. **Fix the MAPE verify loop for beef** (`mapeTracking.ts`) — the cutoff/batch logic
   prevents beef predictions from ever reaching `verified`. Adjust the `take:500 DESC`
   sampling + lower the cutoff for commodities with sparse data. [investigate skill]
2. **Filter prediction subscriptions to predictable commodities** (`predictionCache.ts:241`)
   — stop subscribing 71 zero-data commodities to the 30-min scheduler (wasted work,
   pollutes PredictionLog). [quick fix]
3. **Bridge BeefCutPrice → CommodityPrice** OR build a beef-cut scraper — the 32 beef
   commodities need a live feed, not a frozen seed. Investigate whether CEPEA/MLA can
   feed CommodityPrice for beef_cuts. [investigate + dataIngestion]
4. **Wire the alert-rule evaluator** — schema+channels+persistence all exist; only the
   scheduled evaluator + condition-matcher is missing. Closes the dead-end feature.
   [the automation gap from the agent evaluation]

### Phase D2 — Trust & Design Honesty (fast, high-impact)
The about page still shows fabricated executives; the model count contradicts itself.

1. **Delete Leadership Team** (`about/page.tsx:241-346`) — remove 3 invented executives
   + picsum photos. Replace with a factual "About the data" methodology block.
2. **Create a `SITE_STATS` constant** — single source of truth for model count (5),
   cut count (74), source count, factory count. Propagate everywhere (kills the 6/7/8
   contradiction). Reference from DB or a config, not hardcoded per-page.
3. **Fix Hero "Live" label** (`Hero.tsx:220`) — remove the pulsing "Live" dot or label
   the panel "Illustrative".
4. **Complete the stale-gold rgba sweep** — `rgba(184,134,11` → `rgba(139,105,20` across
   tokens.css + all styles/*.css + Hero/Features JSX. (M2's hex sweep missed the tints.)

### Phase D3 — Test Coverage (de-risk the above)
Add tests for the gaps that matter BEFORE refactoring:

1. **`usageService.checkLimit()`** — pure paywall logic, highest ROI test in the repo.
2. **`marketNewsService` two-user ownership** — model on watchlistService.test.ts pattern.
3. **Inference pytest scaffold** — `conftest.py` + predict validation tests (first tests
   in the Python service, establishes the convention per gen-tests skill).
4. **Fix the 2 tautological/skipping tests** (billing cancel, correlationAnalysis).

### Phase D4 — Design System Consolidation (polish)
1. **Consolidate card dialects** — one Card primitive, one radius per tier.
2. **Remove 2 duplicate local StatCard** — migrate datasets/timeseries to shared ui/StatCard.
3. **Color semantic sweep** — blue/amber/purple → primary/info per the documented mapping.
4. **Extract shared MarketingNav** — replace 3 hand-built navs.
5. **Migrate user-visible toFixed** — PriceForecastPanel, trading, beef pages → lib/format.

---

## What I explicitly do NOT recommend (from the agent evaluation)
- **LLM agents / multi-agent orchestration** — the platform is a data+prediction tool, not
  a conversational assistant. The inference service correctly serves pretrained models only.
- **BullMQ/task queue** — current in-process setInterval handles 111 commodities × 30min
  fine. A queue is future-scale, not present-need.
- **Chronos/deep-learning retraining** — the inference service design doc explicitly calls
  online-training an anti-pattern. Pretrained/statistical models are the right choice.

---

## Ops hygiene note
- Disk at 68% (26G/40G) — monitor; the `logs/` + `.logs/` duplicate dirs + empty `.biome/`
  `.next/` (root) dirs are cleanup candidates but not urgent.
- The `Failed to find Server Action "x"` errors in frontend log are stale (from old builds);
  no recurrence after the latest rebuild.
