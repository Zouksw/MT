/**
 * Site statistics — single source of truth for marketing/UI numbers.
 *
 * Previously the model count was simultaneously 6 (about), 7 (GettingStarted,
 * auth, pricing), and 8 (Hero metrics, Features, SocialProof) across the
 * codebase — a credibility-damaging contradiction. This constant is the ONE
 * place these numbers live; every page imports from here.
 *
 * Numbers reflect the real backend state as of 2026-07-27:
 *  - 3 Chronos T5 foundation-model variants in the user-facing consensus
 *    (chronos_tiny / chronos_mini / chronos_base) — a multi-size ensemble.
 *    The 5 statistical models (ARIMA etc.) are retained as baselines for the
 *    /ai accuracy-comparison page but are NOT part of the main vote.
 *  - 74 beef cut taxonomies defined (BeefCutTaxonomy count).
 *  - 21 factories tracked.
 *  - 7 data sources CONFIGURED, but only 2 currently produce data
 *    (commodity_prices = FX rates, world_bank = non-beef commodities).
 *    Zero beef-producing sources are live — all beef price data is seed
 *    snapshot. See known-issues DATA-1 / DATA-4 for the full picture.
 *  - 5 import source countries (US, BR, AUS, URY, ARG).
 */

export const SITE_STATS = {
	/** Number of AI prediction models in the consensus ensemble (chronos variants). */
	aiModels: 3,
	/** Beef cut taxonomies defined in BeefCutTaxonomy. */
	beefCuts: 74,
	/** Factories with beef price data. */
	factories: 21,
	/** Configured data sources. */
	dataSources: 7,
	/** Import source countries. */
	sourceCountries: 5,
} as const;
