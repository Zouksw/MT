/**
 * Prediction Lifecycle — the status state machine for prediction_logs.
 *
 * A prediction moves through these statuses:
 *
 *   pending → completed      (logPrediction, after inference returns a result)
 *   completed → verified      (verifyPrediction, when actuals arrive + MAPE computed)
 *   completed → stale         (invalidatePollutedPredictions, pre-fix conflict data)
 *   stale → completed         (restorePostFixConflictPredictions, post-fix reclaim)
 *   completed → unverifiable  (markUnverifiable + markLaggingFrozen, source dead)
 *   unverifiable → completed  (restoreVerifiable, source revived)
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
