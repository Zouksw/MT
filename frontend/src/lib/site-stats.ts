/**
 * Site statistics — single source of truth for marketing/UI numbers.
 *
 * Previously the model count was simultaneously 6 (about), 7 (GettingStarted,
 * auth, pricing), and 8 (Hero metrics, Features, SocialProof) across the
 * codebase — a credibility-damaging contradiction. This constant is the ONE
 * place these numbers live; every page imports from here.
 *
 * Numbers reflect the real backend state as of 2026-09-19 (round-169 re-audit):
 *  - 9 forecast model ids in the engine (6 statistical + 3 Chronos T5
 *    variants). The CONSENSUS POOL (round-122 batch 3) is 7 of them —
 *    3 Chronos + 4 statistical baselines (naive/arima/holtwinters/
 *    exponential_smoothing; stl excluded per B3, sarimax never verified).
 *    The vote is quality-weighted by verified 30-day median MAPE, and models
 *    verified strictly worse than the naive baseline are eliminated from
 *    the vote entirely (modelQuality.ts, round-110/115).
 *  - 75 beef cut taxonomies (BeefCutTaxonomy DB count; BEEF_CHEEK was added
 *    in round-144 after the old 74 was written down).
 *  - 23 tracked plants = 21 seed establishments + 2 Roujiaosuo title-attributed
 *    plants (BR-SIF2543 — now GACC-registry-verified as MARFRIG GLOBAL FOODS,
 *    NZ-30 — registry has no ME30, honestly still unverified; round-168/170).
 *    The virtual RJS-SPOT listing pool is deliberately NOT counted as a
 *    factory. The 578 numeric-code registry entries (of 1346 scanned) are a
 *    REFERENCE table (FactoryRegistryEntry), not factories.
 *  - 29 registered scrapers (AGENTS §三, 2026-09-20 round-171: +fao_index,
 *    +oecd_outlook, +hmrc_ots) + the CSV beef import channel (/api/beef/
 *    import). Of these, 9 produced PRICE/FACTOR rows in the last 14 days
 *    (live psql GROUP BY source, 2026-09-20): cme, fred, exchange_rate_api,
 *    drewry, usda_import_beef, roujiaosuo_spot (price tables) +
 *    fao_index (2640 index rows) + oecd_outlook (1467 balance-sheet rows
 *    incl. 10-year projections) + hmrc_ots (UK official lane) — gacc_registry
 *    produces no price rows; it maintains the 1346-entry GACC registry
 *    reference table (weekly). The rest are gated on API keys / network
 *    egress (KNOWN-ISSUES D1). The marketing number counts built
 *    integrations, the same way the /settings/data-sources board counts them.
 *  - 6 import source countries (AR, AU, BR, NZ, US, UY — NZ joined via the
 *    round-168 plant attribution).
 *  - 2 live news RSS feeds (Beef Central, USDA Federal Register) since
 *    2026-08-22 (M3).
 */

export const SITE_STATS = {
	/** Forecast model ids in the engine (statistical + Chronos; see header). */
	aiModels: 9,
	/** Beef cut taxonomies defined in BeefCutTaxonomy. */
	beefCuts: 75,
	/** Tracked plants (seed + attributed; virtual listing pool excluded). */
	factories: 23,
	/** Data source integrations shipped (see header comment for producing split). */
	dataSources: 29,
	/** Import source countries. */
	sourceCountries: 6,
} as const;
