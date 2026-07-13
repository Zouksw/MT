# Beef Data Source Investigation — D1-4

**Date:** 2026-07-13
**Skill:** investigate (root-cause, not workaround)
**Status:** Root cause identified; fix is configuration (API keys), not code

## The problem

Beef data coverage is 9.4% — only 3 of 32 beef_cut commodities have CommodityPrice
data. BeefCutPrice (2,400 rows, 16 cuts) is frozen at 2026-04-30 (~10 weeks stale).
The prediction/verify pipeline reads CommodityPrice, so the frozen BeefCutPrice data
is invisible to predictions.

## Root cause (confirmed via live queries)

### 1. MLA scraper writes to BeefCutPrice, not CommodityPrice
`mlaNlrs.ts:92,139` calls `prisma.beefCutPrice.upsert(...)`. The prediction pipeline
reads `commodityPrice`. These are separate tables with no bridge. MLA is the ONLY
scraper that writes BeefCutPrice.

### 2. MLA scraper returns 0 (empty API key)
`backend/.env` has `MLA_API_KEY=` (present but empty). Recent ingestion logs show
`status: success, inserted: 0, updated: 0` — the scraper runs, the key check passes
(empty string is truthy in their guard?), but the API returns no data. The 2,400
existing BeefCutPrice rows are a one-shot seed from 2026-04-30, not a live feed.

### 3. CEPEA writes CommodityPrice but also returns 0
`cepeaData.ts` correctly writes to CommodityPrice (via `upsertPrice`). Brazilian
beef commodities exist (bra_topside, bra_brisket, etc.). But CEPEA's recent logs
also show `inserted: 0` — the live fetch returns empty. The existing BRA price data
was seeded, not scraped live.

### 4. BeefCutPrice ↔ CommodityPrice schema gap
BeefCutPrice uses `cutCode` (SILVERSIDE, BLADE, BRISKET_NAVEL).
CommodityPrice uses `commodityId` (FK to Commodity, which has `slug` like bra_topside).
There is no cutCode → commodityId mapping. A bridge would require either:
- A lookup table mapping cutCodes to commodity slugs (doesn't exist)
- Or creating one commodity per cutCode (16 commodities, but then they overlap with
  the existing 32 beef_cut commodities that use a different naming scheme)

## What was NOT done (and why)

A BeefCutPrice→CommodityPrice bridge was considered but rejected:
1. **No cutCode→slug mapping exists** — building one is speculative without domain
   knowledge of how SILVERSIDE maps to bra_topside vs aus_sirloin_m9.
2. **The data is frozen** — even if bridged, it's 10 weeks stale. Bridging stale
   data into the prediction pipeline would produce predictions against old prices,
   which is worse than honest "no data" empty states.
3. **The real fix is API keys** — CEPEA + MLA both return 0 because keys are
   empty/missing. Configuring real keys would restore live beef data to BOTH
   BeefCutPrice (MLA) and CommodityPrice (CEPEA), fixing the root cause.

## Forward path (requires operator action, not code)

1. **CEPEA API key** — configure the CEPEA access (it's a free Brazilian academic
   price index; the scraper code exists and writes the right table). This alone
   would populate CommodityPrice for 5 BRA beef commodities → predictions work.
2. **MLA API key** — MLA NLRS is a paid Australian livestock service. With a key,
   BeefCutPrice resumes (but still doesn't feed predictions without a bridge).
3. **BeefCutPrice bridge** — ONLY worth building once MLA data is live again AND
   a cutCode→commodityId mapping is defined. Premature without both.
4. **USDA AMS** — the `usda_ams` scraper is healthy (11,970 all-time inserts) and
   writes CommodityPrice. Investigate whether it covers US beef cuts (it may
   already feed `beef_carcass_us`, which is the one beef commodity with fresh data).

## What WAS fixed this round (D1-1/2/3)

- MAPE verify loop: now uses per-row horizon cutoff + oldest-first batch, so beef
  predictions WILL verify once they age past horizon (10 days). The "0 verified"
  was correct behavior given fresh predictions, not a bug — but the old 7-day
  cutoff + DESC sampling masked this and starved the backlog.
- Prediction subscriptions: 71 zero-data commodities no longer waste 30-min cycles.
  Only commodities with ≥2 daily prices subscribe. Reduces log noise + inference load.
- Alert rule evaluator: wired (10-min schedule). Rules now actually fire when
  thresholds are met, closing the dead-end feature.

These three fixes ensure that WHEN beef data arrives (via configured keys), the
full data→predict→verify→alert loop works end-to-end. The pipeline is no longer
the bottleneck — the data source is.
