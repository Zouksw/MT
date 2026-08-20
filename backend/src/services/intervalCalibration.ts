/**
 * Split-conformal interval calibration (round-110, PREDICTION-STRATEGY §3.5).
 *
 * Model-native intervals (Chronos quantiles, statistical normal-approx) have
 * no coverage guarantee — they are routinely too narrow or too wide for the
 * actual error distribution. Trading decisions need intervals whose coverage
 * is backed by evidence, not by a distributional assumption.
 *
 * Method: per model, collect NORMALIZED absolute residuals r = |a − p| / |a|
 * from verified prediction_logs over a lookback window, and take the
 * split-conformal quantile q = ⌈(n+1)(1−α)⌉/n-th order statistic. Replacing
 * the native interval with ŷ·(1 ± q) gives a finite-sample coverage guarantee
 * (P(a ∈ [ŷ(1−q), ŷ(1+q)]) ≥ 1−α) under exchangeability of residuals.
 *
 * Honest limitations, by design:
 *  - Residuals are pooled across commodities per model (scale-free via the
 *    normalization, but a volatile series and a stable one share one q —
 *    per-model×commodity pools are too thin today). Residuals within one
 *    prediction share a training window and are correlated — the effective
 *    sample is smaller than the residual count.
 *  - Time-series residuals are only approximately exchangeable (regimes
 *    shift); the guarantee is approximate in practice, which is still far
 *    stronger than an uncalibrated normal-approx.
 *  - Below MIN_CALIBRATION_ROWS verified prediction ROWS (round-113: rows,
 *    not per-step residuals — three horizon-10 rows must not pass a "30
 *    rows" bar) the model keeps its native interval.
 *  - q ≥ 1 is rejected outright (round-113): the multiplicative form
 *    ŷ·(1±q) yields a NEGATIVE lower bound there. Unreachable with healthy
 *    pools (live max q ≈ 0.29, 2026-08-21) but a contaminated pool must
 *    degrade to "no multiplier", not to flipped bounds.
 *
 * Leaf service: imports only prisma + logger (+ the test-artifact filter
 * from mapeTracking), so any caller (predictionCache, routes) can use it
 * without cycle risk.
 */

import { logger, prisma } from "@/lib";
import { EXCLUDE_TEST_ARTIFACTS } from "./mapeTracking";

const LOOKBACK_DAYS = 60;
/** Target miscoverage α — calibrated intervals aim for ≥ 90% coverage. */
const MISCOVERAGE_ALPHA = 0.1;
/** Below this many verified prediction rows, keep the model's native interval. */
const MIN_CALIBRATION_ROWS = 30;
/** In-memory TTL — the aggregate query is cheap but runs per prediction. */
const CACHE_TTL_MS = 60_000;

let cache: { key: number; value: Map<string, number>; expiresAt: number } | null = null;

/** Test hook — drop the in-memory multiplier cache between test cases. */
export function resetCalibrationCacheForTests(): void {
	cache = null;
}

/**
 * Per-model conformal multipliers q from verified history.
 *
 * @returns Map<modelId, q> where the calibrated interval is ŷ·(1 ± q).
 * Models without enough calibration evidence are absent from the map.
 */
export async function getIntervalMultipliers(days = LOOKBACK_DAYS): Promise<Map<string, number>> {
	// Cache is keyed by `days` (round-113): a single slot would serve 7-day
	// multipliers to a 60-day request within the TTL window.
	if (cache && cache.key === days && cache.expiresAt > Date.now()) return cache.value;

	const since = new Date(Date.now() - days * 86400000);
	const rows = await prisma.predictionLog.findMany({
		// Same "verified evidence" definition as mapeTracking's accuracy
		// aggregation — leaked test fixtures with real modelIds must not
		// contribute synthetic residuals (round-113 review finding A1-1).
		where: { status: "verified", verifiedAt: { gte: since }, ...EXCLUDE_TEST_ARTIFACTS },
		select: { modelId: true, predictedValues: true, actualValues: true },
	});

	const residualsByModel = new Map<string, number[]>();
	const rowsByModel = new Map<string, number>();
	for (const row of rows) {
		const pred = row.predictedValues as number[] | null;
		const act = row.actualValues as number[] | null;
		if (!Array.isArray(pred) || !Array.isArray(act)) continue;
		const n = Math.min(pred.length, act.length);
		if (n === 0) continue;
		rowsByModel.set(row.modelId, (rowsByModel.get(row.modelId) ?? 0) + 1);
		let list = residualsByModel.get(row.modelId);
		for (let i = 0; i < n; i++) {
			const a = act[i];
			const p = pred[i];
			if (Number.isFinite(a) && Number.isFinite(p) && a !== 0) {
				if (!list) {
					list = [];
					residualsByModel.set(row.modelId, list);
				}
				list.push(Math.abs(a - p) / Math.abs(a));
			}
		}
	}

	const multipliers = new Map<string, number>();
	for (const [modelId, residuals] of residualsByModel) {
		// Evidence bar counts verified ROWS, not per-step residuals —
		// residuals within one prediction are correlated and must not
		// inflate the effective sample (round-113 review finding A1-3).
		if ((rowsByModel.get(modelId) ?? 0) < MIN_CALIBRATION_ROWS) continue;
		residuals.sort((a, b) => a - b);
		// Split-conformal order statistic with finite-sample correction.
		const level = Math.ceil((residuals.length + 1) * (1 - MISCOVERAGE_ALPHA));
		const q = residuals[Math.min(level, residuals.length) - 1];
		// q ≥ 1 would flip the multiplicative bounds negative — degrade to
		// "no multiplier" instead (round-113 review finding A1-2).
		if (Number.isFinite(q) && q > 0 && q < 1) multipliers.set(modelId, q);
	}

	cache = { key: days, value: multipliers, expiresAt: Date.now() + CACHE_TTL_MS };
	logger.info(
		`[CONFORMAL] Calibrated intervals for ${multipliers.size} models ` +
			`(${rows.length} verified predictions, α=${MISCOVERAGE_ALPHA}, ${days}d lookback)`,
	);
	return multipliers;
}

/**
 * Replace a forecast's interval with the conformal-calibrated one.
 *
 * Multiplicative form requires strictly positive forecast values (otherwise
 * the bounds flip) — non-positive series keep the native interval.
 *
 * @returns {} when no calibration applies, so callers fall through to native.
 */
export function applyConformalInterval(
	values: number[],
	q?: number,
): { lowerBound?: number[]; upperBound?: number[] } {
	if (q == null || !Array.isArray(values) || values.length === 0) return {};
	if (values.some((v) => !Number.isFinite(v) || v <= 0)) return {};
	return {
		lowerBound: values.map((v) => v * (1 - q)),
		upperBound: values.map((v) => v * (1 + q)),
	};
}
