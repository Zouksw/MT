/**
 * Calibrated 90% interval for the beef monthly consensus
 * (IMPROVEMENT-PLAN v3.3.0 batch 0b, landed round-164).
 *
 * The consensus card previously showed only the model-disagreement spread
 * (min/max across voting models). That spread is not a coverage statement —
 * it collapses to a point whenever the voting pool narrows (today the global
 * elimination line leaves naive + exponential_smoothing, both flat) — and
 * the page footnote promised a calibrated band "once the first rolling
 * verifications mature". Two things have since matured:
 *
 *   ① the rolling backtest was re-run with per-origin end-of-horizon dumps
 *      (36/34 origins × 7 models, deterministic replay — only holtwinters
 *      moved, by its round-153 de-seasonalization), giving the empirical
 *      consensus-residual quantiles below;
 *   ② the first live beef-family verifications landed 2026-09-12
 *      (beef_retail_us ×7 models, MAPE 0.16–0.55%) — comfortably inside
 *      this band, i.e. the band is not optimistically narrow (V5 gate
 *      "不达标维持现标注" passed).
 *
 * Evidence: docs/backtests/beef-monthly-consensus-calibration-2026-09.md
 * (residual = (actual − median-of-7-models) / median × 100 per origin;
 * p5/p95 via R-7 linear interpolation).
 *
 * Caliber note: the quantiles come from the EQUAL-WEIGHT median of the pool
 * (the equal-weight shape of the production weighted median). The
 * production consensus is quality-weighted; the two coincide whenever
 * weights are equal and both center the same robust statistic. Re-derive
 * these constants if the pool or the weighting policy changes materially.
 */

/** Series the calibration evidence covers — the IMF monthly benchmark. */
export const CALIBRATED_SLUG = "beef_carcass_us";

/** Provenance doc for the constants (repo-relative). */
export const CALIBRATION_SOURCE = "docs/backtests/beef-monthly-consensus-calibration-2026-09.md";

/** Consensus-residual quantiles per horizon, in PERCENT of the consensus
 * prediction. Keys are horizon steps (months on this monthly series). */
const RESIDUAL_QUANTILES: Readonly<Record<number, { p5: number; p95: number; n: number }>> = {
	1: { p5: -2.7573, p95: 5.3999, n: 36 },
	3: { p5: -2.8886, p95: 13.0688, n: 34 },
};

export interface BeefCalibratedInterval {
	/** Band lower bound, same unit/currency as the consensus price. */
	lower: number;
	/** Band upper bound. */
	upper: number;
	/** Nominal coverage — the empirical share of backtest origins inside
	 * [p5, p95] is 90% by construction. */
	level: 0.9;
	/** Residual quantiles (percent) kept for auditability. */
	residualP5Pct: number;
	residualP95Pct: number;
	/** Backtest sample size behind the quantiles. */
	sampleSize: number;
	/** Repo-relative evidence doc. */
	source: string;
}

/**
 * Calibrated 90% band around a consensus prediction. Returns null whenever
 * ANY gate fails (wrong series, non-monthly cadence, unsupported horizon,
 * non-finite price) — callers keep their existing honest labeling, never a
 * fabricated band.
 */
export function calibratedBeefInterval(
	slug: string | undefined,
	seriesInterval: "daily" | "monthly" | undefined,
	horizon: number,
	consensusPrice: number,
): BeefCalibratedInterval | null {
	if (slug !== CALIBRATED_SLUG) return null;
	if (seriesInterval !== "monthly") return null;
	const q = RESIDUAL_QUANTILES[horizon];
	if (!q) return null;
	if (!Number.isFinite(consensusPrice) || consensusPrice <= 0) return null;

	return {
		lower: Math.round(consensusPrice * (1 + q.p5 / 100) * 100) / 100,
		upper: Math.round(consensusPrice * (1 + q.p95 / 100) * 100) / 100,
		level: 0.9,
		residualP5Pct: q.p5,
		residualP95Pct: q.p95,
		sampleSize: q.n,
		source: CALIBRATION_SOURCE,
	};
}
