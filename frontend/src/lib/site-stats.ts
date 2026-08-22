/**
 * Site statistics — single source of truth for marketing/UI numbers.
 *
 * Previously the model count was simultaneously 6 (about), 7 (GettingStarted,
 * auth, pricing), and 8 (Hero metrics, Features, SocialProof) across the
 * codebase — a credibility-damaging contradiction. This constant is the ONE
 * place these numbers live; every page imports from here.
 *
 * Numbers reflect the real backend state as of 2026-08-22:
 *  - 3 Chronos T5 foundation-model variants in the user-facing consensus
 *    (chronos_tiny / chronos_mini / chronos_base) — a multi-size ensemble.
 *    The 6 statistical models (ARIMA etc.) are retained as baselines for the
 *    /ai accuracy-comparison page but are NOT part of the main vote.
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
	/** Number of AI prediction models in the consensus ensemble (chronos variants). */
	aiModels: 3,
	/** Beef cut taxonomies defined in BeefCutTaxonomy. */
	beefCuts: 74,
	/** Factories with beef price data. */
	factories: 21,
	/** Data source integrations shipped (see header comment for producing split). */
	dataSources: 19,
	/** Import source countries. */
	sourceCountries: 5,
} as const;
