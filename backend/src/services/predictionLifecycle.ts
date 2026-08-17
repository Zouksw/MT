/**
 * Prediction Lifecycle — the status state machine for prediction_logs.
 *
 * A prediction moves through these statuses:
 *
 *   pending → completed      (logPrediction, after inference returns a result)
 *   completed → verified      (verifyPrediction, when actuals arrive + MAPE computed)
 *   completed → stale         (invalidatePollutedPredictions, pre-fix conflict data)
 *   stale → completed         (restorePostFixConflictPredictions, post-fix reclaim)
 *   completed → unverifiable  (markUnverifiable + markLaggingFrozen, source dead;
 *                              expireWindowElapsed, heartbeat-zombie source whose
 *                              verification window elapsed without enough actuals)
 *   unverifiable → completed  (restoreVerifiable, window backfilled with actuals)
 *
 * This module owns the status vocabulary so that the ~25 scattered string
 * literals ("completed"/"verified"/etc.) across mapeTracking, predictionCache,
 * backtesting, and modelQuality have one source of truth. Future deepening
 * (transition guards, scheduler) builds on this leaf.
 *
 * (round-91 architecture: this is a cycle-breaking leaf — predictionCache,
 * mapeTracking, and tradingSignals all need the status constants but import
 * each other cyclically. A leaf with no dependencies breaks the cycle without
 * dynamic imports.)
 */

/** The lifecycle status of a prediction log row. */
export const PredictionStatus = {
	/** Just logged — inference returned a result, awaiting maturity. */
	COMPLETED: "completed",
	/** Actuals arrived, MAPE computed — the terminal success state. */
	VERIFIED: "verified",
	/** Pre-fix polluted data (conflict-source rows) — excluded from accuracy. */
	STALE: "stale",
	/** Source is dead (no post-prediction actuals will ever arrive). */
	UNVERIFIABLE: "unverifiable",
	/** Initial state before inference completes (transient). */
	PENDING: "pending",
} as const;

export type PredictionStatusValue = (typeof PredictionStatus)[keyof typeof PredictionStatus];

/**
 * All statuses that represent a "finished" prediction (not pending).
 * Used by accuracy/backtest queries that exclude in-flight rows.
 */
export const TERMINAL_STATUSES: readonly PredictionStatusValue[] = [
	PredictionStatus.COMPLETED,
	PredictionStatus.VERIFIED,
	PredictionStatus.STALE,
	PredictionStatus.UNVERIFIABLE,
] as const;

/**
 * The set of statuses eligible for accuracy reporting (MAPE verified).
 * Only VERIFIED rows have a real MAPE — others are either pending, polluted,
 * or permanently unverifiable.
 */
export const ACCURACY_ELIGIBLE_STATUSES: readonly PredictionStatusValue[] = [
	PredictionStatus.VERIFIED,
] as const;

/**
 * Transition rules — which statuses may move TO which. This is the guard the
 * state-machine mutators consult BEFORE writing, so an overlapping timer cycle
 * can't resurrect a row a sibling pass just excluded.
 *
 *   completed → verified          (verifyPrediction — the happy path)
 *   completed → stale             (invalidatePollutedPredictions)
 *   completed → unverifiable      (markUnverifiable / markLaggingFrozen)
 *   stale → completed             (restorePostFixConflictPredictions)
 *   unverifiable → completed      (restoreVerifiablePredictions)
 *
 * A row already in a terminal exclusion status (stale/unverifiable) must NOT
 * be flipped to verified by a concurrent verifyDuePredictions cycle that read
 * the batch before the mark pass ran. `canVerify` encodes that: only
 * completed/verified rows are eligible to receive a verification write.
 */

/** Statuses from which a →verified transition is allowed. */
const VERIFYABLE_FROM: ReadonlySet<PredictionStatusValue> = new Set([
	PredictionStatus.COMPLETED,
	PredictionStatus.VERIFIED, // idempotent re-verify
]);

/** May this row receive a verification (status→verified) write? */
export function canVerify(status: PredictionStatusValue | null | undefined): boolean {
	return !!status && VERIFYABLE_FROM.has(status);
}
