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
 * Leaf service: imports only prisma + logger, so any caller (predictionCache,
 * routes) can use it without cycle risk.
 */

import { logger, prisma } from "@/lib";

const LOOKBACK_DAYS = 60;
/** Target miscoverage α — calibrated intervals aim for ≥ 90% coverage. */
const MISCOVERAGE_ALPHA = 0.1;
/** Below this many verified prediction rows, keep the model's native interval. */
const MIN_CALIBRATION_ROWS = 30;
/** In-memory TTL — the aggregate query is cheap but runs per prediction. */
const CACHE_TTL_MS = 60_000;

let cache: { key: number; value: Map<string, number>; expiresAt: number } | null = null;
// Stampede guard (round-114): when the TTL lapses, concurrent callers (3-model
// background refresh + per-request route calls overlap in production) share
// one rebuild instead of each firing the aggregate.
let inFlight: { key: number; promise: Promise<Map<string, number>> } | null = null;

/** Test hook — drop the in-memory multiplier cache between test cases. */
export function resetCalibrationCacheForTests(): void {
	cache = null;
	inFlight = null;
}

/**
 * Per-model conformal multipliers from verified history (SQL-side, round-114).
 *
 * The JS version (round-110..113) pulled every verified row's value arrays
 * into Node (~26k rows) just to reduce them to ≤9 scalars. The aggregate now
 * runs entirely in PostgreSQL, mirroring the JS semantics exactly:
 *  - evidence bar counts verified ROWS with non-empty arrays, not per-step
 *    residuals (round-113 A1-3 — residuals within one prediction correlate);
 *  - pairs match by array position up to the shorter array; only numeric
 *    pairs with a non-zero actual contribute a residual;
 *  - `commodity_id NOT ILIKE '%test%'` mirrors mapeTracking's
 *    EXCLUDE_TEST_ARTIFACTS (round-113 A1-1) — keep both definitions in sync;
 *  - q = ⌈(n+1)(1−α)⌉-th order statistic, clamped to n (finite-sample
 *    correction). Numeric casts stay in `numeric` (exact ordering); the
 *    ±1e300 bounds keep a poisoned entry from overflowing the cast.
 */
async function computeMultipliers(days: number): Promise<Map<string, number>> {
	const since = new Date(Date.now() - days * 86400000);

	const rows: { model_id: string; q: unknown; n_rows: number }[] = await prisma.$queryRaw`
		WITH base AS (
			SELECT pl.model_id, pl.predicted_values AS pv, pl.actual_values AS av
			FROM prediction_logs pl
			WHERE pl.status = 'verified'
				AND pl.verified_at >= ${since}
				AND pl.commodity_id NOT ILIKE '%test%'
		),
		rowbar AS (
			SELECT b.model_id, count(*)::int AS n_rows
			FROM base b
			WHERE jsonb_typeof(b.pv) = 'array'
				AND jsonb_typeof(b.av) = 'array'
				AND jsonb_array_length(b.pv) > 0
				AND jsonb_array_length(b.av) > 0
			GROUP BY b.model_id
		),
		pairs AS (
			SELECT model_id, abs(x.a - x.p) / abs(x.a) AS r
			FROM (
				SELECT b.model_id,
					(a.v #>> '{}')::numeric AS a,
					(p.v #>> '{}')::numeric AS p
				FROM base b
				CROSS JOIN LATERAL jsonb_array_elements(b.av) WITH ORDINALITY AS a(v, ord)
				CROSS JOIN LATERAL jsonb_array_elements(b.pv) WITH ORDINALITY AS p(v, ord)
				WHERE jsonb_typeof(b.av) = 'array'
					AND jsonb_typeof(b.pv) = 'array'
					AND a.ord = p.ord
					AND jsonb_typeof(a.v) = 'number'
					AND jsonb_typeof(p.v) = 'number'
			) x
			WHERE x.a <> 0
				AND x.a BETWEEN -1e300 AND 1e300
				AND x.p BETWEEN -1e300 AND 1e300
		),
		ranked AS (
			SELECT model_id, r,
				row_number() OVER (PARTITION BY model_id ORDER BY r) AS rk,
				count(*) OVER (PARTITION BY model_id) AS n
			FROM pairs
		)
		SELECT rb.model_id, g.q, rb.n_rows
		FROM rowbar rb
		JOIN LATERAL (
			SELECT rk.r AS q
			FROM ranked rk
			WHERE rk.model_id = rb.model_id
				AND rk.rk = least(ceil((rk.n + 1) * ${1 - MISCOVERAGE_ALPHA})::int, rk.n::int)
			LIMIT 1
		) g ON true
		WHERE rb.n_rows >= ${MIN_CALIBRATION_ROWS}
	`;

	const multipliers = new Map<string, number>();
	let totalRows = 0;
	for (const row of rows) {
		totalRows += row.n_rows;
		const q = Number(row.q);
		// q ≥ 1 would flip the multiplicative bounds negative — degrade to
		// "no multiplier" instead (round-113 review finding A1-2).
		if (Number.isFinite(q) && q > 0 && q < 1) multipliers.set(row.model_id, q);
	}
	logger.info(
		`[CONFORMAL] Calibrated intervals for ${multipliers.size} models ` +
			`(${totalRows} verified rows, α=${MISCOVERAGE_ALPHA}, ${days}d lookback)`,
	);
	return multipliers;
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
	if (inFlight && inFlight.key === days) return inFlight.promise;
	const promise = computeMultipliers(days)
		.then((multipliers) => {
			cache = { key: days, value: multipliers, expiresAt: Date.now() + CACHE_TTL_MS };
			return multipliers;
		})
		.finally(() => {
			// Clear the shared slot once settled so a failure isn't pinned for the
			// TTL window (successes are served from `cache` afterwards anyway).
			if (inFlight?.promise === promise) inFlight = null;
		});
	inFlight = { key: days, promise };
	return promise;
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
