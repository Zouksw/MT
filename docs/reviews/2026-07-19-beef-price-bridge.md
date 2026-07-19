# Beef Price Bridge — CommodityPrice → BeefCutPrice

**Date:** 2026-07-19
**Skill:** investigate (root cause) + scaffold (the bridge)
**Status:** Shipped (5 STRONG slug→cutCode mappings bridged every 6h; startup run at +45s)

## The problem

The `/beef` page (the core product surface per PRODUCT-SPEC M1) read only
`BeefCutPrice`, and that table was stuck on a 2026-04-30 seed snapshot —
2,400 rows across 16 cuts, none appended by any scraper since seeding. Every
freshness-windowed endpoint (`/api/beef/prices` default 30d, `/prices/latest`
single-date, `/weekly-kill` 4w, `/cold-storage` 3mo) returned empty or stale.

Meanwhile `CommodityPrice` was live: ~65k rows, refreshed daily by working
scrapers (cme_futures, fred, world_bank, commodity_prices), latest 2026-07-18.

## Root cause (verified — corrects the 2026-07-13 investigation)

The 2026-07-13 doc said "only 3 of 32 beef_cuts have data" and "MLA/CEPEA
return 0 because API keys are empty." Both were partially wrong:

- It's **16 of 74** BeefCutTaxonomy cuts with seed data, not 3 of 32.
- **CEPEA needs no API key** — it's a public HTML scrape. It runs every cycle
  but returns `{0,0}` because its regex no longer matches the live page. Even
  if it worked, it writes to `CommodityPrice` (slug `boi_gordo_br`), which the
  /beef UI never reads.
- **Only MLA needs a key** (correctly gated). USDA-AMS is also key-gated.
  INAC is not key-gated but silently fails its scrape.

The real architecture mismatch: **only 3 scrapers write `BeefCutPrice`**
(INAC, MLA, USDA-AMS), and all 3 are dormant. `CommodityPrice` is fresh but
disconnected — no code bridges it to `BeefCutPrice`. The two schemas have no
FK and no mapping code.

## The fix — a periodic bridge

`backend/src/services/beefPriceBridge.ts` copies the latest daily
`CommodityPrice.close` for each mapped beef slug into `BeefCutPrice`. Wired in
`server.ts`: a startup run at +45s (so the /beef page is alive within a minute
of deploy) plus a 6-hour `setInterval`. Idempotent (upsert on the existing
`[factoryId, cutCode, date, source]` unique key).

### The factory join rule

`Factory.code === ISO3_TO_ISO2(Commodity.originCountry) + "-" + Commodity.factoryCode`

The ISO-3→ISO-2 country prefix is load-bearing: it disambiguates the `379`
collision (`BR-SIF379` vs `UY-379`). A bare `endsWith(factoryCode)` would join
Uruguayan commodities to a Brazilian factory. The map: AUS→AU, BRA→BR, ARG→AR,
URY→UY, USA→US, CN→CN.

### The source convention

Bridged rows carry `source = "bridge:commodity:<slug>"`. This keeps them
distinct from real scraper output (`mla_nlrs`, `usda_ams_xb405`, etc.) so a
consumer can always tell "this came from CommodityPrice" apart from "this came
from a primary cut-price source". If a real MLA/USDA scraper is wired later,
its rows use a different source string and never collide with bridge rows.

## Scope decision — conservative (STRONG mappings only)

Per the user decision (2026-07-19): bridge only slugs with an UNAMBIGUOUS 1:1
mapping to a `BeefCutTaxonomy.cutCode`. The current set is 5 entries:

| slug | cutCode | justification |
|---|---|---|
| `aus_brisket_m7` | `BRISKET_NAVEL` | nameCn 牛腩 |
| `bra_brisket` | `BRISKET_NAVEL` | nameCn 牛腩 |
| `arg_brisket` | `BRISKET_NAVEL` | nameCn 牛腩 |
| `aus_cube_roll_m9` | `RIB_EYE_ROLL` | alias "cube roll" + nameCn 眼肉 both agree |
| `bra_topside` | `TOPSIDE` | subcategory + nameCn 小米龙 both agree |

### Deliberately deferred

**AMBIGUOUS (11 slugs)** — multiple cutCodes fit; needs an explicit manual pick:
`aus_sirloin_m9` (STRIPLOIN vs SIRLOIN), `aus_shin_m5` (FORESHANK vs HEEL_MUSCLE),
`aus_thick_flank_m7` (KNUCKLE vs TOPSIDE), `aus_oyster_blade_m7` (BLADE vs
HANGING_TENDER), `aus_rump_m5` (RUMP vs CHUCK_TENDER), `bra_shin`, `bra_round`,
`arg_shin`, `arg_forequarter`, `ury_thick_flank`, `ury_shin`.

**NO cutCode (2 slugs)** — trade form, not a cut: `bra_frozen_boneless`,
`ury_boneless`.

**NO Factory (12 slugs)** — domestic-CN + US cutout have `factoryCode = null`:
`brisket_cn`, `shin_cn`, `sirloin_cn`, `fatty_brisket_cn`, `thick_flank_cn`,
`oyster_blade_cn`, `ribeye_cn`, `tenderloin_cn`, `beef_tripe_cn`,
`beef_tendon_cn`, `boxed_beef_choice`, `beef_cutout_us`. Bridging these would
require creating synthetic CN factories — deferred as a data-model stretch.

## How to extend

1. Pick a deferred slug and resolve its ambiguity (decide which cutCode).
2. Add one entry to `SLUG_TO_CUTCODE` in `beefPriceBridge.ts` with a comment
   citing the normalizer line that justifies the choice.
3. The bridge picks it up automatically on the next 6h cycle. No migration,
   no config.

If the deferred slug has no Factory (domestic-CN), you must ALSO either create
a Factory row or extend the bridge to support a synthetic CN factory — that's a
larger decision, not a one-line add.

## What this does NOT do

- Does not fix the dormant scrapers (INAC silent failure, MLA/USDA key gating).
  When a real scraper writes BeefCutPrice with its own `source`, bridge rows
  and scraper rows coexist; the scraper's are primary-source.
- Does not cover the 9 ambiguous cuts or domestic-CN beef — the /beef page
  gains 5 fresh cuts (brisket ×3, cube_roll, topside), not all 74. Real
  coverage expansion needs the manual mapping decisions above.
- Does not change CommodityPrice — it's read-only here.

## Verification

- Backend tsc clean; vitest 526/527 (1 pre-existing skip; +14 bridge tests).
- Bridge tests mutation-verified on the `bridge:` source prefix (flipping it
  to `mla_nlrs:` fails the prefix test).
- Live smoke (after `pnpm build` + `pm2 restart mt-backend`): the +45s startup
  hook fired — `🥩 Beef price bridge: 1 copied, 4 skipped` — and produced one
  real BeefCutPrice row: `RIB_EYE_ROLL / source=bridge:commodity:aus_cube_roll_m9 / 2026-04-29`.
- The 4 "skipped" are correct: of the 5 mapped slugs, only `aus_cube_roll_m9`
  has any `CommodityPrice` data. The other 4 (`aus_brisket_m7`, `bra_brisket`,
  `arg_brisket`, `bra_topside`) have ZERO CommodityPrice rows — see the next
  section.

## Important finding — CommodityPrice beef coverage is also a gap

The investigation said "CommodityPrice is fresh: ~65k rows, latest 2026-07-18".
That's true in aggregate but misleading for beef: the fresh rows are all
NON-beef commodities (CME futures, FRED, world_bank, generic commodity_prices).
For the 5 mapped beef slugs:

| slug | CommodityPrice rows | latest |
|---|---|---|
| aus_cube_roll_m9 | 180 | 2026-04-29 |
| aus_brisket_m7 | 0 | — |
| bra_brisket | 0 | — |
| arg_brisket | 0 | — |
| bra_topside | 0 | — |

So the bridge is correctly wired and idempotent, but it can only copy what
exists. Activating MORE beef price data requires EITHER (a) the dormant
BeefCutPrice scrapers (MLA/USDA-AMS key-gated, INAC failing) to wake up, OR
(b) the working commodity scrapers (cepea, fao_prices, etc.) to start writing
CommodityPrice for beef slugs — which they currently don't, because cepea
writes only `boi_gordo_br` and the others don't cover these cuts.

The bridge is still the right architecture: once any path starts populating
CommodityPrice for beef slugs, the bridge will propagate it into BeefCutPrice
on the next 6h cycle with no code change. The bridge turned a "no path exists"
problem into a "data must exist upstream" problem — which is the correct
separation of concerns.
