---
title: "MT API Reference"
version: "2.0.0"
last_updated: "2026-08-23"
status: "stable"
maintainer: "MT Team"
tags:
  - "api"
  - "rest"
  - "reference"
target_audience: "Developers, Integration Engineers"
next_review: "2026-11-23"
---

# MT API Reference

REST API documentation for the MT beef-price platform.

> **round-120 rewrite**: the previous version (1.3.0, 2026-03-28) predated the
> PRODUCT-SPEC era — it documented ~9 endpoints that never existed (`/api/ai/*`,
> `/api/forecasts*`, `/api/cache/*`, `/api/datasets/:id/export`), used the wrong
> `/api/apikeys` prefix, and omitted ~95 real endpoints. This version was
> regenerated from the actual route files (`backend/src/routes/*.ts`, mounts in
> `backend/src/app.ts`): **20 routers, 142 endpoints**, all verified against code.

---

## Quick Info

| Property | Value |
|----------|-------|
| Base URL (dev) | `http://localhost:8000` |
| Data Format | JSON |
| Encoding | UTF-8 |
| Interactive Docs (Swagger) | `http://localhost:8000/api/docs` |
| OpenAPI JSON | `http://localhost:8000/api/docs/json` |

---

## Authentication

Except where noted, all `/api/*` endpoints require authentication:

- **JWT**: `Authorization: Bearer <token>` — issued by login/register; also set
  as an HttpOnly cookie.
- **API Key**: `x-api-key: <key>` — for programmatic access. Keys inherit the
  creating user's role, are stored hashed (shown once at creation), and track
  `usageCount`/`lastUsedAt`. Manage at **Settings → API Keys** or via
  `/api/api-keys`.

Roles: `ADMIN` > `EDITOR` > `VIEWER` (registration defaults to VIEWER).
Ownership-scoped resources return **404 for both "missing" and "not owned"** —
existence is never disclosed cross-user; ADMIN bypasses ownership checks.

> **AI tier gating is dormant** (round-119): the `aiAccess` middleware only
> enforces role tiers when `AI_TIER_ENFORCED=true` (default off). Until paid
> tiers launch, every registered user can call the AI endpoints below.

---

## Health（运维探针，不在 /api 前缀下）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health (uptime, env) |
| `/health/ready` | GET | Readiness fan-out: DB + Redis + inference (degraded states reported) |
| `/health/live` | GET | Liveness probe |

## Auth — `/api/auth`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account (defaults to role VIEWER) |
| `/api/auth/login` | POST | Login; returns JWT + sets HttpOnly cookie session |
| `/api/auth/logout` | POST | Revoke session + blacklist token |
| `/api/auth/refresh` | POST | Rotate refresh token (API-only; frontend has no refresh flow) |
| `/api/auth/verify` | GET | Verify current session |
| `/api/auth/me` | GET | Current user profile |
| `/api/auth/me` | PUT | Update profile |
| `/api/auth/change-password` | POST | Change password |

## Time Series — `/api/timeseries`（自助数据平台）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/timeseries` | GET | List own series (paginate; filter `?datasetId=&search=`) |
| `/api/timeseries` | POST | Create series under an owned dataset |
| `/api/timeseries/:id` | GET | Series detail + datapoint/anomaly counts |
| `/api/timeseries/:id` | PATCH | Update series (fields, slug rename, move to owned dataset) — restored round-120 |
| `/api/timeseries/:id` | DELETE | Delete series (cascades datapoints/anomalies) |
| `/api/timeseries/:id/data` | GET | Query datapoints (`?limit=`) |
| `/api/timeseries/:id/data` | POST | Insert datapoint (`{ value, timestamp? }` — missing value is 400) |

## Datasets — `/api/datasets`（自助数据平台）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/datasets` | GET | List own datasets |
| `/api/datasets` | POST | Create dataset (`name`, `slug`, `storageFormat`) |
| `/api/datasets/:id` | GET | Dataset detail with embedded timeseries |
| `/api/datasets/:id` | PATCH | Update dataset (API-only — no frontend page) |
| `/api/datasets/:id` | DELETE | Delete dataset (owner only) |
| `/api/datasets/:id/import` | POST | Import CSV/JSON (`format` + body; ≤50 value columns, round-119) |

## AI / Inference — `/api/inference`（on-demand）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inference/status` | GET | Inference service health summary (API-only) |
| `/api/inference/predict` | POST | Run one model on a commodity (`{ commodityId, horizon, algorithm?, confidenceLevel? }`) |
| `/api/inference/predict/batch` | POST | Batch variant (serial per-item; API-only) |
| `/api/inference/predict/visualize` | POST | Predict + chart payload (used by `/ai/predict` page) |
| `/api/inference/anomalies` | POST | Detect anomalies on a series (API-only) |
| `/api/inference/anomalies/visualize` | POST | Anomalies + chart payload (used by `/ai/anomalies` page) |
| `/api/inference/models` | GET | Callable model ids with honest availability flags |
| `/api/inference/models/:id` | GET | Single model status (API-only) |
| `/api/inference/models/train` | POST | **410 Gone** — training was removed (pretrained-only, PRODUCT-SPEC §九) |

## Forecasting Models (legacy registry) — `/api/models`

User-trained-model registry kept for the datasets/timeseries workspace; the
AI pages use `/api/signals/models` + `/api/inference` instead. **Entire group
has no frontend consumer** (API-only).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | List models (owner- or ADMIN-scoped since round-119) |
| `/api/models/:id` | GET | Model detail (trainer or ADMIN) |
| `/api/models/train` | POST | **410 Gone** tombstone |
| `/api/models/:modelId/predict` | POST | Run a registry model (writes ownership-checked forecast) |
| `/api/models/:modelId/forecasts` | GET | Model's forecasts (trainer or ADMIN) |
| `/api/models/:id` | PATCH | Update (rename / isActive toggle — owner or ADMIN) |
| `/api/models/:id` | DELETE | Delete model |
| `/api/models/:modelId/forecasts` | DELETE | Delete forecasts |

## Trading Signals & Analytics — `/api/signals`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signals/models` | GET | Active model list (chronos ensemble) |
| `/api/signals/models/accuracy` | GET | All-model MAPE accuracy (verified pool, sample-size gated) |
| `/api/signals/models/:modelId/accuracy` | GET | Per-model detailed accuracy (API-only) |
| `/api/signals/models/:modelId/backtest` | GET | Backtest over verified predictions (`?days=7/30/90`) |
| `/api/signals/models/:modelId/predictions` | GET | Verified prediction log rows |
| `/api/signals/correlation` | GET | Pairwise correlation (API-only) |
| `/api/signals/correlation/matrix` | GET | Full correlation matrix (used by analysis page) |
| `/api/signals/commodities` | GET | Commodities eligible for correlation (API-only) |
| `/api/signals/batch` | POST | Batch consensus signals (legacy path; superseded by beef forecasts) |
| `/api/signals/:commodityId` | GET | Multi-model consensus signal for a commodity |
| `/api/signals/:commodityId/predictions` | GET | Cached per-model predictions for a commodity |

## Analytics — `/api/analytics`（API-only，无前端消费）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/seasonality/:commoditySlug` | GET | Seasonal price statistics (authoritative source only) |
| `/api/analytics/correlation` | GET | Two-series correlation |

## Anomalies — `/api/anomalies`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/anomalies` | GET | List anomalies (`?commodityId=`, `?severity=`, `?timeseriesId=`) — owner-scoped since round-119 |
| `/api/anomalies/:id` | GET | Anomaly detail (owner or ADMIN) |
| `/api/anomalies/detect` | POST | Run detection on an owned timeseries (rate-limited) |
| `/api/anomalies/:id` | PATCH | Update status (owner or ADMIN) |
| `/api/anomalies/:id` | DELETE | Delete anomaly (owner or ADMIN) |
| `/api/anomalies/stats/timeseries/:timeseriesId` | GET | Per-series anomaly stats (owner) |
| `/api/anomalies/bulk-resolve` | POST | Bulk-resolve anomalies (owner) |

## Beef Domain — `/api/beef`（核心行情）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/beef/factories` | GET | Factory list |
| `/api/beef/factories/:code` | GET | Factory detail (API-only) |
| `/api/beef/cuts` | GET | Cut taxonomy (74 cuts) |
| `/api/beef/cuts/by-primal` | GET | Cuts grouped by primal (API-only) |
| `/api/beef/cuts/:cutCode` | GET | Cut detail |
| `/api/beef/prices` | GET | Paginated price rows (API-only) |
| `/api/beef/prices/latest` | GET | Latest price per cut + 3-layer freshness + origin trend |
| `/api/beef/by-country` | GET | Import-origin aggregates (used by origin analysis page) |
| `/api/beef/prices/history/:cutCode` | GET | Price history (`?days=`) |
| `/api/beef/weekly-kill` | GET | Weekly slaughter volumes |
| `/api/beef/cold-storage` | GET | Cold-storage inventory |
| `/api/beef/spreads` | GET | Cut-price spreads (API-only) |
| `/api/beef/forecasts` | GET | Batch 7-day consensus forecasts for all forecastable cuts |
| `/api/beef/forecasts/:cutCode` | GET | Single-cut consensus forecast |
| `/api/beef/import/template` | GET | CSV import template (D1 manual backfill path) |
| `/api/beef/import` | POST | Admin CSV import (invalidates stale prediction caches) |

## Market Data — `/api/market`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/market/commodities` | GET | Commodity list with authoritative latest price |
| `/api/market/commodities/:slug/latest` | GET | Latest price (API-only hook exists, unused) |
| `/api/market/commodities/:slug/price` | GET | Price history (`?interval=daily/weekly/monthly&limit=`) |
| `/api/market/commodities/:slug/price-multi` | GET | Multi-source comparison (newest-window semantics) |
| `/api/market/commodities/:slug/fundamentals` | GET | Related market factors (last 30d, relevant regions) |
| `/api/market/factors/exchange-rates` | GET | Latest FX rates (API-only) |
| `/api/market/sources` | GET | Data-source health board (status enum only — raw error strings removed round-119) |
| `/api/market/commodities/:slug/sources` | GET | Per-commodity contributing sources |
| `/api/market/sources/:sourceId/refresh` | POST | Trigger one scraper (from data-sources board) |
| `/api/market/sources/refresh-all` | POST | Trigger all scrapers |
| `/api/market/sources/freshness` | GET | 7-day per-source freshness + empty-source flags |
| `/api/market/commodities/freshness` | GET | Per-commodity freshness |
| `/api/market/sources/:sourceId/history` | GET | Ingestion run log |

## Market News — `/api/news`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/news` | GET | Published articles (paginate, filter) |
| `/api/news/stats` | GET | Article counts by category/source |
| `/api/news/:id` | GET | Article detail |
| `/api/news` | POST | Create (EDITOR/ADMIN only) |
| `/api/news/:id` | PATCH | Update (EDITOR/ADMIN, own draft rules) |
| `/api/news/:id` | DELETE | Delete (EDITOR/ADMIN) |

## Alerts — `/api/alerts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/alerts` | GET | Alert list (`?page=&limit=`, `?severity=`, `?unread=`) |
| `/api/alerts/stats` | GET | Counts by severity/status |
| `/api/alerts/rules` | GET | Own alert rules |
| `/api/alerts/rules` | POST | Create rule (timeseries must exist and be owned — round-119) |
| `/api/alerts/rules/:id` | PATCH | Update / enable / disable |
| `/api/alerts/rules/:id` | DELETE | Delete rule |
| `/api/alerts/:id/read` | PATCH | Mark read |
| `/api/alerts/read-all` | PATCH | Mark all read |
| `/api/alerts/:id` | DELETE | Delete alert |
| `/api/alerts/:id` | GET | Alert detail |

## Billing — `/api/billing`（静态套餐展示，无支付）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/billing/plans` | GET | Static plan tiers (informational; copy synced to open-phase reality round-119/120) |
| `/api/billing/subscription` | GET | Current plan + limits |
| `/api/billing/cancel` | POST | Cancel subscription (API-only; 400 without a paid sub) |

## API Keys — `/api/api-keys`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/api-keys` | POST | Create key (raw key returned once) |
| `/api/api-keys` | GET | List keys (masked) |
| `/api/api-keys/:id` | GET | Key detail |
| `/api/api-keys/:id` | PATCH | Rename / enable / disable |
| `/api/api-keys/:id/revoke` | DELETE | Revoke (API-only — UI uses DELETE /:id) |
| `/api/api-keys/:id` | DELETE | Delete key |
| `/api/api-keys/:id/expiration` | PATCH | Set expiry (API-only) |

## Metrics — `/api/metrics`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metrics` | GET | Server performance snapshot |
| `/api/metrics/endpoints` | GET | Per-endpoint breakdown (API-only) |
| `/api/metrics/web-vitals` | POST | Frontend vitals beacon |
| `/api/metrics/web-vitals` | GET | Vitals summary (`?period=`) |
| `/api/metrics/web-vitals/history` | GET | Vitals time series |
| `/api/metrics/api-latency` | GET | API latency stats |
| `/api/metrics/summary` | GET | Dashboard rollup (API-only) |

## Security Audit — `/api/security`（API-only，前端从未上报）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/security/audit` | POST | Ingest a client audit event (no frontend sender wired) |
| `/api/security/audit` | GET | Query audit log (ADMIN) |
| `/api/security/audit/stats` | GET | Audit stats (ADMIN) |

## Portfolios — `/api/portfolios`（关注分组，API-only）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolios` | GET | List own portfolios |
| `/api/portfolios` | POST | Create portfolio |
| `/api/portfolios/:id` | GET | Portfolio detail |
| `/api/portfolios/:id/members` | POST | Add member commodity |
| `/api/portfolios/:id/members/:memberId` | PATCH | Update member |
| `/api/portfolios/:id/members/:memberId` | DELETE | Remove member |
| `/api/portfolios/:id` | DELETE | Delete portfolio |

## Watchlists — `/api/watchlists`（关注列表，API-only）

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/watchlists` | GET | List own watchlists |
| `/api/watchlists` | POST | Create watchlist |
| `/api/watchlists/:id` | PATCH | Update |
| `/api/watchlists/:id` | DELETE | Delete |
| `/api/watchlists/:id/items` | POST | Add commodity |
| `/api/watchlists/:id/items/:commodityId` | DELETE | Remove commodity |
| `/api/watchlists/:id/quotes` | GET | Latest quotes for watched commodities |

## Docs — `/api/docs`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/docs` | GET | Swagger UI |
| `/api/docs/json` | GET | OpenAPI spec JSON |

---

## Request/Response Examples

### Create Time Series

```bash
POST /api/timeseries
Content-Type: application/json
Authorization: Bearer <token>

{
  "datasetId": "3f1c…-uuid",
  "name": "brisket_price",
  "slug": "brisket-price",
  "unit": "USD/kg",
  "description": "Imported brisket price observations"
}

# Response: { "success": true, "data": { "id": "…", … } }
```

### Insert a Data Point

```bash
POST /api/timeseries/<id>/data
Authorization: Bearer <token>

{ "value": 7.42, "timestamp": "2026-08-23T00:00:00Z" }

# Response: 201 { "success": true, "data": { "valueJson": "7.42", … } }
# A body without `value` is a 400 — no fabricated 0 data points.
```

### Run a Prediction

```bash
POST /api/inference/predict
Authorization: Bearer <token>

{
  "commodityId": "brl_usd",
  "horizon": 10,
  "algorithm": "chronos_tiny",
  "confidenceLevel": 0.95
}

# Response: { "success": true, "data": { "timestamps": […], "values": […],
#   "lowerBound": […], "upperBound": […] } }
# Non-finite model output is refused with 503 (round-119 guard).
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 / 201 | Success / Created |
| 400 | Bad Request — invalid input (zod-validated) |
| 401 | Unauthorized — invalid/missing token or API key |
| 403 | Forbidden — role/permission (e.g. news authoring requires EDITOR) |
| 404 | Not Found — or "not yours" (ownership convention) |
| 409 | Conflict — e.g. email already registered |
| 410 | Gone — removed capability (model training tombstones) |
| 422 / 503 | Upstream inference rejection / saturation or non-finite output |
| 429 | Rate limit exceeded |

Error body shape:

```json
{ "success": false, "error": { "message": "…" } }
```

---

## Rate Limiting & Pagination

- Global + per-route limiters (AI detection has a dedicated `aiRateLimiter`).
- List endpoints paginate: `?page=1&limit=20` → `{ data, pagination: { page, limit, total, totalPages } }`.

---

## Known Gaps（round-120 审计登记）

- Session management endpoints do **not** exist (the /settings/sessions
  placeholder page was removed round-124 rather than kept waiting on them).
- No `/api/billing/checkout` — billing is informational only by design.
- ~~`/api/market/import` + `/preview`~~ removed round-124 (double-orphan:
  no frontend consumer, no route test); `/api/inference/predict/batch`
  remains the only untested API-only endpoint.

---

**Last Updated**: 2026-08-23 · **API Version**: 2.0.0（round-120 全量重写）
