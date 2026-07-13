/**
 * Site statistics — single source of truth for marketing/UI numbers.
 *
 * Previously the model count was simultaneously 6 (about), 7 (GettingStarted,
 * auth, pricing), and 8 (Hero metrics, Features, SocialProof) across the
 * codebase — a credibility-damaging contradiction. This constant is the ONE
 * place these numbers live; every page imports from here.
 *
 * Numbers reflect the real backend state as of 2026-07-13:
 *  - 5 statistical models (ARIMA, Holt-Winters, Exp. Smoothing, STL, Naive)
 *  - 74 beef cut taxonomies defined (BeefCutTaxonomy count)
 *  - 21 factories tracked
 *  - 7+ data sources (USDA, CEPEA, MLA, INAC, ABARES, World Bank, FRED)
 *  - 5 import source countries (US, BR, AUS, URY, ARG)
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
