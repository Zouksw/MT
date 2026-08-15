/**
 * Model Registry — the single source of truth for inference model ids.
 *
 * This is a leaf module (no service-layer imports) so that both
 * predictionCache and tradingSignals can import from it without creating
 * a circular dependency (predictionCache ↔ tradingSignals previously
 * cycled through getAllModels).
 *
 * Two tiers:
 * - ALL_MODELS: the primary consensus ensemble (3 Chronos T5 sizes —
 *   capacity diversity for the weighted vote).
 * - BASELINE_MODELS: classical statistical baselines reported on the
 *   /ai accuracy page for comparison, NOT part of the consensus vote.
 */

// PRIMARY consensus ensemble = 3 Chronos T5 sizes (capacity diversity).
// The multi-size ensemble votes via the weighted consensus pipeline:
// chronos_base (most accurate) weighs more when its MAPE is lower.
export const ALL_MODELS = ["chronos_tiny", "chronos_mini", "chronos_base"] as const;

// BASELINE models — NOT part of the main consensus, but reported on the /ai
// accuracy page so users can see chronos vs classical-method performance.
// naive_forecaster is the standard "dumb baseline" any real model must beat.
// stl_forecaster removed 2026-08-15 (B3): its verified pool froze 2026-07-26
// when stat models left background scheduling, the post-fix forecaster has
// zero new evidence, and its historical avg/median MAPE (10.87% / 5.73%) is
// 3×–10× worse than every other baseline — advertising it on the accuracy
// page overstated the offering. The model stays implemented in
// inference-service (on-demand /predict still accepts the id); re-add here
// only if it returns to scheduled evaluation with fresh evidence.
export const BASELINE_MODELS = [
	"naive_forecaster",
	"arima",
	"holtwinters",
	"exponential_smoothing",
] as const;

/**
 * Returns a copy of the primary consensus model ids.
 * (Defensive copy so callers can't mutate the frozen constant.)
 */
export function getAllModels(): string[] {
	return [...ALL_MODELS];
}
