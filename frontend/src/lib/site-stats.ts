/**
 * Site statistics — single source of truth for marketing/UI numbers.
 *
 * Previously the model count was simultaneously 6 (about), 7 (GettingStarted,
 * auth, pricing), and 8 (Hero metrics, Features, SocialProof) across the
 * codebase — a credibility-damaging contradiction. This constant is the ONE
 * place these numbers live; every page imports from here.
 *
 * Numbers reflect the real backend state as of 2026-07-19:
 *  - 5 statistical models in the user-facing consensus (backend ALL_MODELS:
 *    ARIMA, Holt-Winters, Exp. Smoothing, STL, Naive). NOTE: inference-service
 *    also exposes chronos (/models returns 6), but chronos is NOT wired into
 *    the backend signals/batch consensus the user sees — so the honest
 *    user-facing count is 5, not 6. See known-issues DATA-4.
 *  - 74 beef cut taxonomies defined (BeefCutTaxonomy count).
 *  - 21 factories tracked.
 *  - 7 data sources CONFIGURED, but only 2 currently produce data
 *    (commodity_prices = FX rates, world_bank = non-beef commodities).
 *    Zero beef-producing sources are live — all beef price data is seed
 *    snapshot. See known-issues DATA-1 / DATA-4 for the full picture.
 *  - 5 import source countries (US, BR, AUS, URY, ARG).
 */

export const SITE_STATS = {
	/** Number of AI prediction models (matches backend ALL_MODELS). */
	aiModels: 5,
	/** Beef cut taxonomies defined in BeefCutTaxonomy. */
	beefCuts: 74,
	/** Factories with beef price data. */
	factories: 21,
	/** Configured data sources. */
	dataSources: 7,
	/** Import source countries. */
	sourceCountries: 5,
} as const;

/**
 * Labels for the AI models (for display where the raw IDs aren't user-friendly).
 */
export const AI_MODEL_LABELS: Record<string, string> = {
	arima: "ARIMA",
	holtwinters: "Holt-Winters",
	exponential_smoothing: "Exp. Smoothing",
	stl_forecaster: "STL",
	naive_forecaster: "Naive",
} as const;
