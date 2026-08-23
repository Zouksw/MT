/**
 * Model Registry — the single source of truth for inference model ids.
 *
 * This is a leaf module (no service-layer imports) so that both
 * predictionCache and tradingSignals can import from it without creating
 * a circular dependency (predictionCache ↔ tradingSignals previously
 * cycled through getAllModels).
 *
 * Two concerns live here:
 *
 * 1. Curated tiers (static, semantic):
 *    - ALL_MODELS: the consensus pool (3 Chronos T5 sizes + 4 statistical
 *      baselines — quality-weighted vote, worse-than-naive eliminated).
 *    - BASELINE_MODELS: the statistical family, for the /ai accuracy
 *      page's primary-vs-baseline split (members also vote in ALL_MODELS).
 *
 * 2. Runtime acceptance list (synced): which model ids on-demand /predict
 *    requests may call. inference-service GET /models is authoritative;
 *    a static seed only bootstraps/fallbacks (backend may boot ~90s before
 *    inference is warm). Before round-115 this list was a hand-copied
 *    duplicate in routes/inference.ts that had already drifted from the
 *    inference service (7 curated vs 9 callable ids).
 */

// PRIMARY consensus pool (round-122 batch 3): 3 Chronos T5 sizes + the 4
// statistical baselines. Until 2026-08-23 this was chronos-only — which
// silently defeated the elimination bar: all three chronos variants verify
// worse than naive in the current 30d window, so resolveModelWeights zeroed
// every voter and fell back to EQUAL weights (the "documented edge" was the
// production default). With the baselines in the pool the quality machinery
// actually bites — chronos keeps its vote only where its verified MAPE earns
// one, and the baselines carry the vote where they verify better (the
// current window). The vote stays quality-weighted (30d median MAPE,
// round-115); worse-than-naive models are eliminated (round-110).
// stl_forecaster stays excluded (B3: no fresh evidence, 3-10x worse
// history); sarimax stays excluded (zero verified history, never scheduled).
export const ALL_MODELS = [
	"chronos_tiny",
	"chronos_mini",
	"chronos_base",
	"naive_forecaster",
	"arima",
	"holtwinters",
	"exponential_smoothing",
] as const;

// BASELINE models — the statistical family. Since round-122 batch 3 these
// are ALSO part of the consensus pool (see ALL_MODELS); this constant keeps
// its second role: the primary-vs-baseline split on the /ai accuracy page.
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

// ─── Runtime acceptance list (round-115) ──────────────────────────────────

// Seed = the 9 ids inference-service currently exposes (3 Chronos variants +
// 6 statistical). Reconciled hourly by the model-registry-sync job in
// server.ts; kept here so validation survives a cold/unreachable inference
// service (rejecting every model id would be worse than a stale list).
const SEED_MODELS = [
	"chronos_tiny",
	"chronos_mini",
	"chronos_base",
	"arima",
	"sarimax",
	"holtwinters",
	"exponential_smoothing",
	"naive_forecaster",
	"stl_forecaster",
] as const;

let syncedModels: readonly string[] = SEED_MODELS;

export interface ModelSyncResult {
	valid: string[];
	added: string[];
	removed: string[];
	/** Curated ensemble/baseline ids missing upstream — their schedules would fail. */
	curatedMissing: string[];
}

/**
 * Replace the acceptance list with the ids reported by inference-service.
 * Pure state swap + diff (no I/O) so drift semantics are unit-testable;
 * the caller owns fetching and logging. An empty remoteIds would empty the
 * list — the client refuses empty responses for exactly that reason.
 */
export function syncModelsFromRemote(remoteIds: string[]): ModelSyncResult {
	const remote = [...new Set(remoteIds)].sort();
	const added = remote.filter((id) => !syncedModels.includes(id));
	const removed = syncedModels.filter((id) => !remote.includes(id));
	const curated = [...ALL_MODELS, ...BASELINE_MODELS];
	const curatedMissing = curated.filter((id) => !remote.includes(id));
	syncedModels = remote;
	return { valid: [...syncedModels], added, removed, curatedMissing };
}

/** Current acceptance list for on-demand /predict model ids. */
export function getValidModels(): string[] {
	return [...syncedModels];
}

export function isValidModel(id: string): boolean {
	return syncedModels.includes(id);
}

/** Test-only: restore the seed between cases. */
export function resetModelRegistryForTests(): void {
	syncedModels = SEED_MODELS;
}
