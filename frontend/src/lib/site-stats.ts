/**
 * Site statistics — single source of truth for marketing/UI numbers.
 *
 * Previously the model count was simultaneously 6 (about), 7 (GettingStarted,
 * auth, pricing), and 8 (Hero metrics, Features, SocialProof) across the
 * codebase — a credibility-damaging contradiction. This constant is the ONE
 * place these numbers live; every page imports from here.
 *
 * Numbers reflect the real backend state as of 2026-08-23:
 *  - 9 forecast model ids in the engine (6 statistical + 3 Chronos T5
 *    variants). The CONSENSUS POOL (round-122 batch 3) is 7 of them —
 *    3 Chronos + 4 statistical baselines (naive/arima/holtwinters/
 *    exponential_smoothing; stl excluded per B3, sarimax never verified).
 *    The vote is quality-weighted by verified 30-day median MAPE, and models
 *    verified strictly worse than the naive baseline are eliminated from
 *    the vote entirely (modelQuality.ts, round-110/115). Until round-122
 *    the pool was chronos-only, which made that elimination silently no-op
 *    (all 3 chronos eliminated -> equal-weight fallback); with baselines in
 *    the pool the quality machinery actually bites. Marketing says
 *    "9-model engine, quality-weighted, MAPE-verified" — never "3 Chronos
 *    models form the consensus".
 *  - 74 beef cut taxonomies defined (BeefCutTaxonomy count).
 *  - 21 factories tracked.
 *  - 19 data source integrations shipped (17 registered in the tiered
 *    schedule + CSV manual import; inac dormant since 08-15). Of these, 3
 *    currently produce rows (commodity_prices = FX, cme_futures,
 *    world_bank) — the rest are gated on API keys / network egress
 *    (KNOWN-ISSUES D1). The marketing number counts built integrations,
 *    the same way the /settings/data-sources board counts them.
 *  - 5 import source countries (US, BR, AUS, URY, ARG).
 *  - 2 live news RSS feeds (Beef Central, USDA Federal Register) since
 *    2026-08-22 (M3).
 */

export const SITE_STATS = {
	/** Forecast model ids in the engine (statistical + Chronos; see header). */
	aiModels: 9,
	/** Beef cut taxonomies defined in BeefCutTaxonomy. */
	beefCuts: 74,
	/** Factories with beef price data. */
	factories: 21,
	/** Data source integrations shipped (see header comment for producing split). */
	dataSources: 19,
	/** Import source countries. */
	sourceCountries: 5,
} as const;
