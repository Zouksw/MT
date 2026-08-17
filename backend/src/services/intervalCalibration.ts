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
 *    per-model×commodity pools are too thin today).
 *  - Time-series residuals are only approximately exchangeable (regimes
 *    shift); the guarantee is approximate in practice, which is still far
 *    stronger than an uncalibrated normal-approx.
 *  - Below MIN_CALIBRATION_ROWS verified rows the model keeps its native
 *    interval (no calibration on thin evidence).
 *
 * Leaf service: imports only prisma + logger, so any caller (predictionCache,
 * routes) can use it without cycle risk.
 */

import { logger, prisma } from "@/lib";

const LOOKBACK_DAYS = 60;
/** Target miscoverage α — calibrated intervals aim for ≥ 90% coverage. */
const MISCOVERAGE_ALPHA = 0.1;
/** Below this many residuals, keep the model's native interval. */
const MIN_CALIBRATION_ROWS = 30;
/** In-memory TTL — the aggregate query is cheap but runs per prediction. */
const CACHE_TTL_MS = 60_000;

let cache: { value: Map<string, number>; expiresAt: number } | null = null;

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
	if (cache && cache.expiresAt > Date.now()) return cache.value;

	const since = new Date(Date.now() - days * 86400000);
	const rows = await prisma.predictionLog.findMany({
		where: { status: "verified", verifiedAt: { gte: since } },
		select: { modelId: true, predictedValues: true, actualValues: true },
	});

	const residualsByModel = new Map<string, number[]>();
	for (const row of rows) {
		const pred = row.predictedValues as number[] | null;
		const act = row.actualValues as number[] | null;
		if (!Array.isArray(pred) || !Array.isArray(act)) continue;
		const n = Math.min(pred.length, act.length);
		if (n === 0) continue;
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
		if (residuals.length < MIN_CALIBRATION_ROWS) continue;
		residuals.sort((a, b) => a - b);
		// Split-conformal order statistic with finite-sample correction.
		const level = Math.ceil((residuals.length + 1) * (1 - MISCOVERAGE_ALPHA));
		const q = residuals[Math.min(level, residuals.length) - 1];
		if (Number.isFinite(q) && q > 0) multipliers.set(modelId, q);
	}

	cache = { value: multipliers, expiresAt: Date.now() + CACHE_TTL_MS };
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
