/**
 * MAPE Logging & Model Accuracy Tracking
 *
 * Logs every prediction. When actual data arrives, computes MAPE
 * (Mean Absolute Percentage Error) and stores accuracy metrics.
 *
 * MAPE = (1/n) * Σ(|actual - predicted| / |actual|) * 100
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib";
import { getAuthoritativeSource } from "@/services/inference/authoritativeSources";
import { isCutSeriesKey, parseCutSeriesKey } from "./beefCutSeries";
import { STALE_WINDOW_DAYS } from "./beefFreshness";
import type { PredictionStatusValue } from "./predictionLifecycle";
import { canVerify, PredictionStatus as PS } from "./predictionLifecycle";

export interface LogPredictionParams {
	modelId: string;
	commodityId: string;
	horizon: number;
	predictedValues: number[];
	lowerBounds?: number[];
	upperBounds?: number[];
	confidence?: number;
	/** UTC timestamp of the first predicted step (day after the last training
	 * point). Verification aligns actuals to this anchor — see schema note on
	 * PredictionLog.forecastStartAt (round-104). */
	forecastStartAt?: Date;
}

/**
 * Log a prediction for later accuracy verification.
 *
 * Called by predictionCache.runAndCachePrediction AFTER the prediction has
 * been successfully computed and cached, so the status is "completed" (not
 * "pending"). The pending state was a bug — it left all 1066+ rows stuck
 * because no code path ever advanced them. Status lifecycle:
 *   completed  → verified   (verifyPrediction runs when actuals arrive)
 */
export async function logPrediction(params: LogPredictionParams): Promise<string> {
	const log = await prisma.predictionLog.create({
		data: {
			modelId: params.modelId,
			commodityId: params.commodityId,
			horizon: params.horizon,
			predictedValues: params.predictedValues,
			lowerBounds: params.lowerBounds ?? undefined,
			upperBounds: params.upperBounds ?? undefined,
			confidence: params.confidence ?? undefined,
			forecastStartAt: params.forecastStartAt ?? undefined,
			status: PS.COMPLETED,
		},
	});

	return log.id;
}

/**
 * Verify a prediction against actual values and compute MAPE
 */
export async function verifyPrediction(
	logId: string,
	actualValues: number[],
): Promise<{ mape: number } | null> {
	const log = await prisma.predictionLog.findUnique({ where: { id: logId } });
	if (!log) return null;

	// Transition guard (round-93): only completed/verified rows may receive a
	// verification write. Without this, an overlapping markUnverifiable/
	// invalidatePolluted cycle (which runs on a staggered timer) could flip a
	// row completed→unverifiable AFTER this batch was read but BEFORE we reach
	// it — and this function would resurrect it to verified, defeating the
	// exclusion. See predictionLifecycle.ts canVerify.
	if (!canVerify(log.status as PredictionStatusValue | null)) return null;

	const predicted = log.predictedValues as number[];
	if (!Array.isArray(predicted) || predicted.length === 0) return null;

	// Compute MAPE over the overlapping range
	const n = Math.min(predicted.length, actualValues.length);
	if (n === 0) return null;

	let sumAbsPctError = 0;
	let validCount = 0;

	for (let i = 0; i < n; i++) {
		const actual = actualValues[i];
		const pred = predicted[i];
		if (actual !== 0 && Number.isFinite(actual) && Number.isFinite(pred)) {
			sumAbsPctError += Math.abs((actual - pred) / actual);
			validCount++;
		}
	}

	if (validCount === 0) return null;

	const mape = (sumAbsPctError / validCount) * 100;

	// Atomic transition: updateMany with a status predicate in the WHERE so the
	// check-then-write is race-free. If a concurrent mark pass flipped this row
	// to stale/unverifiable between the findUnique above and now, this update
	// matches 0 rows — the row stays excluded as intended. (update, not
	// updateMany, can't express a compound where on a unique key + status.)
	const result = await prisma.predictionLog.updateMany({
		where: { id: logId, status: { in: [PS.COMPLETED, PS.VERIFIED] } },
		data: {
			actualValues: actualValues,
			mape: Math.round(mape * 10000) / 10000,
			status: PS.VERIFIED,
			verifiedAt: new Date(),
		},
	});

	if (result.count === 0) return null;

	return { mape: Math.round(mape * 100) / 100 };
}

/**
 * Invalidate predictions that were trained on polluted (multi-source unit-
 * conflicting) data and therefore cannot be meaningfully verified.
 *
 * Context (docs/KNOWN-ISSUES.md R2 + round-41): brl_usd / corn_cme /
 * natural_gas_cme were each written by two sources with conflicting units /
 * direction. Before round-41's authoritative-source fix, predictions for
 * these commodities trained on a Frankenstein series (e.g. brl_usd trained on
 * exchange_rate_api ≈0.2 then verified against fred ≈5.1 → bogus ~96% MAPE).
 *
 * Those pre-fix predictions are unrecoverable: PredictionLog has no `source`
 * column, so we can't re-derive which source trained each row. Verifying them
 * anyway would inject ~96% MAPE noise into the accuracy averages that the
 * /ai/accuracy page displays. The honest action is to mark them `stale` so
 * they're excluded from accuracy math (readers filter `status: "verified"`),
 * and let the post-fix predictions populate accuracy going forward.
 *
 * `fixedAt` is the timestamp of the round-41 fix (the moment training started
 * reading the authoritative source). Rows predictedAt < fixedAt for the three
 * conflict commodities are marked stale. Idempotent — only touches
 * status='completed' rows, and the update's where-clause is re-checked.
 *
 * @returns number of predictions marked stale
 */
export async function invalidatePollutedPredictions(fixedAt: Date): Promise<number> {
	const conflictSlugs = ["brl_usd", "corn_cme", "natural_gas_cme"];
	const commodities = await prisma.commodity.findMany({
		where: { slug: { in: conflictSlugs } },
		select: { id: true, slug: true },
	});
	if (commodities.length === 0) return 0;

	// Touch BOTH 'completed' (pending verification) AND 'verified' rows. The
	// verified ones carry the bogus ~96% MAPE computed against the wrong source
	// (e.g. brl_usd verified against fred ≈5.1 after training on
	// exchange_rate_api ≈0.2) and would poison accuracy averages if left.
	// getModelAccuracy / getAllModelAccuracy filter status='verified', so
	// re-marking them 'stale' is what actually excludes them from the averages.
	const result = await prisma.predictionLog.updateMany({
		where: {
			commodityId: { in: commodities.map((c) => c.id) },
			status: { in: [PS.COMPLETED, PS.VERIFIED] },
			predictedAt: { lt: fixedAt },
		},
		data: { status: PS.STALE },
	});
	return result.count;
}

/**
 * Restore post-fix conflict-commodity predictions that were incorrectly marked
 * `stale` back to `completed`, so the verification loop can process them.
 *
 * Context: `invalidatePollutedPredictions` is the only writer of `status='stale'`
 * in the codebase, and its boundary is `predictedAt < fixedAt` — strictly the
 * polluted pre-fix rows. But a historical run (before the boundary was pinned
 * down, or with a mis-resolved timestamp) left ~531 post-fix chronos predictions
 * for the 3 conflict commodities stuck at `stale` even though they trained on
 * the authoritative-source-filtered series and are legitimate. Once `stale`,
 * `verifyDuePredictions` (which only reads `status='completed'`) never reclaims
 * them, so brl_usd / corn_cme / natural_gas_cme accuracy never populates.
 *
 * This is the symmetric inverse of invalidatePollutedPredictions: it touches
 * ONLY `predictedAt >= fixedAt` rows on the conflict slugs, restoring them to
 * `completed` so they re-enter the verification queue. Idempotent — a second
 * run finds nothing (the rows are already `completed`).
 *
 * @returns number of predictions restored to `completed`
 */
export async function restorePostFixConflictPredictions(fixedAt: Date): Promise<number> {
	const conflictSlugs = ["brl_usd", "corn_cme", "natural_gas_cme"];
	const commodities = await prisma.commodity.findMany({
		where: { slug: { in: conflictSlugs } },
		select: { id: true, slug: true },
	});
	if (commodities.length === 0) return 0;

	const result = await prisma.predictionLog.updateMany({
		where: {
			commodityId: { in: commodities.map((c) => c.id) },
			status: PS.STALE,
			// Inverse boundary: only post-fix rows. The pre-fix ones stay stale
			// (they really were trained on conflicting-source data and are
			// unrecoverable — see invalidatePollutedPredictions docs).
			predictedAt: { gte: fixedAt },
		},
		data: { status: PS.COMPLETED },
	});
	return result.count;
}

/**
 * Mark completed predictions whose forecast horizon has elapsed AND whose
 * commodity has received NO new daily prices after the prediction was made
 * — i.e. permanently unverifiable (the data source is frozen/dead).
 *
 * Why this exists: verifyDuePredictions reads `status:"completed"` OLDEST-
 * first take 5000 every 6h. Frozen-commodity predictions (e.g. wheat_cn,
 * latest price 2026-04-29) always fail the no-actuals skip — and the skip
 * is a bare `continue` with no DB write, so the row stays `completed`
 * forever and is re-read every run. ~92k such rows accumulated, each
 * batch wasting its 5000-row window re-skip- ping dead rows instead of
 * processing real due candidates (chronos, post-08-06).
 *
 * Marking these rows `unverifiable` (a 4th status value; the status column
 * is free TEXT, no migration needed) excludes them from verifyDuePredic-
 * tions' `status:"completed"` filter automatically — zero loop change.
 *
 * Distinct from `stale`: stale = polluted/conflicting-source pre-fix data,
 * coupled to restorePostFixConflictPredictions' state machine. `unverifiable`
 * = data-source-frozen; never re-attempted unless the source resumes (in
 * which case NEW predictions on the now-fresh commodity verify normally;
 * these old rows stay unverifiable as honest historical record).
 *
 * Detection has two passes (round-66):
 *
 *   Pass A (Steps 1-3, "due"): find commodity-IDs (non-cut) with at least
 *   one due completed prediction (predictedAt <= cutoff), then per
 *   commodity check if its latest daily price is older than the OLDEST due
 *   prediction. If so, every due completed prediction for that commodity
 *   has no actuals and never will → mark all of them unverifiable.
 *
 *   Pass B (Step 4, "within-cutoff lagging"): the due-cutoff in Pass A
 *   misses recent predictions (predictedAt > cutoff) whose source is
 *   ALREADY frozen — they'll never reach the due cutoff yet will never get
 *   actuals either. After the round-62 P1 prediction gate stopped NEW
 *   frozen-source predictions from being generated, these are pre-gate
 *   stragglers that keep accumulating in `completed` and get re-scanned
 *   every 6h. Step 4 catches them: predictedAt > cutoff, latest price ≤
 *   predictedAt, AND latest price < now-STALE_WINDOW_DAYS (source dead
 *   ≥7d — the platform-wide recency standard, not a weekend/1d lag).
 *
 * Idempotent: only touches status:"completed" rows. A second run finds
 * none (they're now "unverifiable") and returns 0.
 *
 * @returns number of predictions marked unverifiable this run
 */
export async function markUnverifiablePredictions(): Promise<number> {
	const MAX_HORIZON_DAYS = 10;
	const cutoff = new Date(Date.now() - MAX_HORIZON_DAYS * 86400000);
	const now = Date.now();
	let markedTotal = 0;

	// Step 1: find commodity-IDs with due completed predictions (non-cut).
	// Due = predictedAt <= cutoff AND predictedAt + horizon <= now. The SQL
	// cutoff is the max-horizon superset; the per-row horizon check below
	// refines it. We only need per-commodity aggregates.
	// Round-104: this was an unbounded findMany of EVERY due row (up to
	// ~26k at 18 commodities × 3 models × 30min cadence × 10 days) loaded
	// into Node only to collapse into per-commodity min/max. groupBy does
	// the collapse SQL-side and returns one row per commodity.
	const dueGroups = await prisma.predictionLog.groupBy({
		by: ["commodityId"],
		where: {
			status: PS.COMPLETED,
			predictedAt: { lte: cutoff },
			// Exclude cut-series keys — their actuals live in BeefCutPrice, not
			// CommodityPrice; a separate verification path handles them and
			// they should not be swept into the commodity-frozen bucket.
			NOT: { commodityId: { startsWith: "cut:" } },
		},
		_min: { predictedAt: true },
		_max: { horizon: true },
	});

	if (dueGroups.length === 0) {
		// No due (≤ cutoff) candidates — skip Pass A entirely and go
		// straight to Pass B (within-cutoff lagging-source scan).
		return markLaggingFrozenPredictions(cutoff, now);
	}

	// hasDueRow sound approximation: earliest predictedAt + the group's MAX
	// horizon <= now implies earliest + ANY row's own horizon <= now, so the
	// approximation can never claim due when no row is (only the converse —
	// a missed due row is rechecked next cycle).
	const byCommodity = new Map<string, { earliestPredictedAt: Date; hasDueRow: boolean }>();
	for (const g of dueGroups) {
		const earliest = g._min.predictedAt as Date;
		const maxHorizon = g._max.horizon ?? 0;
		byCommodity.set(g.commodityId, {
			earliestPredictedAt: earliest,
			hasDueRow: earliest.getTime() + maxHorizon * 86400000 <= now,
		});
	}

	// Step 2: for each candidate commodity, check if its latest daily price
	// is older than the earliest due prediction. If so, no actuals exist
	// for ANY due prediction on that commodity → frozen → mark unverifiable.
	const frozenCommodityIds: string[] = [];
	for (const [commodityId, info] of byCommodity) {
		if (!info.hasDueRow) continue; // no row has actually matured yet
		const latestPrice = await prisma.commodityPrice.findFirst({
			where: { commodityId, interval: "daily" },
			orderBy: { date: "desc" },
			select: { date: true },
		});
		// No price at all, or latest price is before the earliest due
		// prediction → no actuals can ever exist for the due window.
		if (!latestPrice || latestPrice.date <= info.earliestPredictedAt) {
			frozenCommodityIds.push(commodityId);
		}
	}

	if (frozenCommodityIds.length > 0) {
		// Step 3: mark all due completed predictions for frozen commodities
		// as unverifiable in one batched updateMany (predictedAt <= cutoff).
		const result = await prisma.predictionLog.updateMany({
			where: {
				status: PS.COMPLETED,
				commodityId: { in: frozenCommodityIds },
				predictedAt: { lte: cutoff },
				NOT: { commodityId: { startsWith: "cut:" } },
			},
			data: { status: PS.UNVERIFIABLE },
		});
		markedTotal += result.count;
	}

	// Pass B (round-66): within-cutoff lagging-source predictions that the
	// due cutoff in Pass A structurally skips. Returns its own count; add it.
	markedTotal += await markLaggingFrozenPredictions(cutoff, now);
	return markedTotal;
}

/**
 * Pass B helper for {@link markUnverifiablePredictions} (round-66).
 *
 * Catches `completed` predictions whose predictedAt is WITHIN the due
 * cutoff (> cutoff — so Pass A never sees them) but whose commodity's data
 * source is already frozen: the latest daily price is ≤ the prediction AND
 * older than now-STALE_WINDOW_DAYS. These never reach the due cutoff yet
 * never get actuals; without this pass they linger in `completed` and are
 * re-scanned every 6h by verifyDuePredictions.
 *
 * Mirrors Pass A's batch shape (enumerate candidate commodityIds → per-
 * commodity findFirst latest price → batched updateMany) but with the
 * within-cutoff candidate set and the source-dead recency guard.
 *
 * @param cutoff - the due cutoff (predictedAt <= cutoff is Pass A's set)
 * @param nowMs - Date.now() at the start of the run
 * @returns number of within-cutoff predictions marked unverifiable this call
 */
async function markLaggingFrozenPredictions(cutoff: Date, nowMs: number): Promise<number> {
	// Candidate commodities: those with a completed prediction NEWER than
	// the due cutoff (Pass A's complement). The horizon check is irrelevant
	// here — we care only that the source is already dead, so even a 1-day-
	// old prediction on a 95-day-dead commodity should be drained.
	// Pick the NEWEST completed prediction per commodity. distinct collapses
	// to one row per commodityId; orderBy predictedAt desc makes that row the
	// latest. Without the orderBy, Postgres returned an arbitrary row per
	// commodity, making the freeze test (latestPrice.date <= row.predictedAt)
	// nondeterministic at the boundary — a borderline-dead source could be
	// marked unverifiable or left completed depending on row ordering.
	const laggingCommodities = await prisma.predictionLog.findMany({
		where: {
			status: PS.COMPLETED,
			predictedAt: { gt: cutoff },
			NOT: { commodityId: { startsWith: "cut:" } },
		},
		select: { commodityId: true, predictedAt: true },
		distinct: ["commodityId"],
		orderBy: [{ commodityId: "asc" }, { predictedAt: "desc" }],
	});

	if (laggingCommodities.length === 0) return 0;

	const sourceDeadCutoff = new Date(nowMs - STALE_WINDOW_DAYS * 86400000);
	const frozenCommodityIds: string[] = [];

	// Per-commodity: frozen iff latest price is ≤ the prediction (no post-
	// prediction actuals can exist) AND the latest price itself is older
	// than the platform-wide stale window (source confirmed dead, not a
	// 1-2 day lag).
	for (const row of laggingCommodities) {
		const latestPrice = await prisma.commodityPrice.findFirst({
			where: { commodityId: row.commodityId, interval: "daily" },
			orderBy: { date: "desc" },
			select: { date: true },
		});
		if (!latestPrice) {
			frozenCommodityIds.push(row.commodityId); // no price at all
			continue;
		}
		if (latestPrice.date <= row.predictedAt && latestPrice.date < sourceDeadCutoff) {
			frozenCommodityIds.push(row.commodityId);
		}
	}

	if (frozenCommodityIds.length === 0) return 0;

	// Mark all within-cutoff completed predictions for these frozen
	// commodities unverifiable (predictedAt > cutoff — disjoint from Pass A).
	const result = await prisma.predictionLog.updateMany({
		where: {
			status: PS.COMPLETED,
			commodityId: { in: frozenCommodityIds },
			predictedAt: { gt: cutoff },
			NOT: { commodityId: { startsWith: "cut:" } },
		},
		data: { status: PS.UNVERIFIABLE },
	});

	return result.count;
}

/**
 * Expire completed predictions whose verification window has fully elapsed
 * without reaching the actuals bar — the zombie-source drain.
 *
 * Why this pass exists (observed live, 2026-08-17): a commodity whose source
 * is functionally dead but emits rare "heartbeat" rows (live_cattle_cme: 3
 * cme rows across 3 months, latest 2026-08-13) defeats BOTH existing guards:
 *   - verifyDuePredictions skips it (its 10-day window never holds ≥3
 *     actuals) but leaves it `completed` — so it is re-read every cycle;
 *   - markUnverifiablePredictions can't freeze it (its test requires
 *     latestPrice <= predictedAt; the heartbeat is newer).
 * Five such commodities parked ~27k rows inside the oldest-first `take: 5000`
 * candidate window, so every 6h verification run processed 5000 guaranteed
 * skips and starved every real candidate — chronos predictions on genuinely
 * fresh sources (usd_cny / aud_usd / brl_usd / beef_carcass_us) have not
 * verified since 2026-08-04 despite mature horizons and rich actuals.
 *
 * Invariant: a past window can only gain actuals via late backfill (the FRED
 * lag pattern). Once window-end + STALE_WINDOW_DAYS grace has passed with
 * fewer actuals than the verifier's bar (min(horizon, 3)), the row can never
 * verify → mark it `unverifiable`. The NOT EXISTS guard counts actuals the
 * way the verifier does (from anchor-day midnight, source-unfiltered —
 * stricter source filters only ever shrink that count, so unfiltered ≥ bar
 * is a safe "don't expire" direction).
 *
 * Complements (does not replace) markUnverifiablePredictions: that pass
 * catches sources dead since before the prediction; this pass catches
 * sources that emit heartbeats after it. Idempotent — only touches
 * `completed` rows, and re-checks the predicate in the UPDATE's WHERE.
 *
 * Cut-series keys are excluded (their actuals live in BeefCutPrice, a
 * separate verification path).
 *
 * @returns number of predictions expired to `unverifiable` this run
 */
export async function expireWindowElapsedPredictions(): Promise<number> {
	// Grace = the platform-wide stale window: sources that lag (FRED once
	// published 2-day-late rows) get one recency-standard's worth of time to
	// backfill a past window before it is declared permanently unverifiable.
	const result = await prisma.$executeRaw`
		UPDATE prediction_logs AS pl
		SET status = 'unverifiable'
		WHERE pl.status = 'completed'
			AND pl.commodity_id NOT LIKE 'cut:%'
			-- Same candidate pre-filter as verifyDuePredictions (MAX_HORIZON_DAYS).
			AND pl.predicted_at <= NOW() - INTERVAL '10 days'
			-- Window long elapsed: anchor + horizon + grace is still in the past.
			AND (
				COALESCE(pl.forecast_start_at, pl.predicted_at)
				+ make_interval(days => pl.horizon::int)
				+ make_interval(days => ${STALE_WINDOW_DAYS}::int)
			) < NOW()
			-- Guard: the window can never reach the verifier's actuals bar.
			AND NOT EXISTS (
				SELECT cp.commodity_id
				FROM commodity_prices AS cp
				WHERE cp.commodity_id = pl.commodity_id
					AND cp.interval = 'daily'
					AND cp.date >= date_trunc('day', COALESCE(pl.forecast_start_at, pl.predicted_at))
					AND cp.date < COALESCE(pl.forecast_start_at, pl.predicted_at)
						+ make_interval(days => pl.horizon::int + 1)
				GROUP BY cp.commodity_id
				HAVING COUNT(*) >= LEAST(pl.horizon, 3)
			)
	`;
	return result;
}

/**
 * Restore `unverifiable` predictions whose verification window has since been
 * backfilled with actuals — the symmetric inverse of the expiry/freeze passes.
 *
 * Window-aware (round-110): the revive test is "the earliest stranded row's
 * window now holds enough actuals", NOT "any price newer than the prediction
 * exists". The old test revived heartbeat zombies on every run — after
 * expireWindowElapsedPredictions drains them to `unverifiable`, a
 * latest-price-based test would flip them back to `completed` in the same
 * cycle (ping-pong on ~27k rows every 6h). Actuals inside the past window
 * mean genuine backfill (the FRED lag case); a newer price outside the
 * window means nothing for verification.
 *
 * Per-commodity granularity: if the earliest stranded row's window gained
 * actuals, the commodity is revived as a whole and the verifier processes
 * each row individually. Rows among them whose own windows are still empty
 * are skipped by the verifier and re-expired by the next sweep — one
 * bounded transient, not a loop.
 *
 * @returns number of predictions restored to `completed`
 */
export async function restoreVerifiablePredictions(): Promise<number> {
	// Earliest-anchor stranded row per commodity (DISTINCT ON picks the first
	// row per commodity_id under the ORDER BY).
	const earliest = await prisma.$queryRaw<
		Array<{ commodity_id: string; anchor: Date; horizon: number }>
	>`
		SELECT DISTINCT ON (commodity_id)
			commodity_id,
			COALESCE(forecast_start_at, predicted_at) AS anchor,
			horizon
		FROM prediction_logs
		WHERE status = 'unverifiable'
			AND commodity_id NOT LIKE 'cut:%'
		ORDER BY commodity_id, COALESCE(forecast_start_at, predicted_at) ASC
	`;

	if (earliest.length === 0) return 0;

	const revivedCommodityIds: string[] = [];
	for (const row of earliest) {
		// Mirror the verifier's window: actuals from anchor-day midnight up to
		// anchor + horizon (+1 for the take(horizon+1) fetch), bar min(horizon,3).
		const anchor = new Date(row.anchor);
		const anchorDay = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
		const windowEnd = new Date(anchor.getTime() + (row.horizon + 1) * 86400000);
		const actualCount = await prisma.commodityPrice.count({
			where: {
				commodityId: row.commodity_id,
				interval: "daily",
				date: { gte: new Date(anchorDay), lt: windowEnd },
			},
		});
		if (actualCount >= Math.min(row.horizon, 3)) {
			revivedCommodityIds.push(row.commodity_id);
		}
	}

	if (revivedCommodityIds.length === 0) return 0;

	const result = await prisma.predictionLog.updateMany({
		where: {
			status: PS.UNVERIFIABLE,
			commodityId: { in: revivedCommodityIds },
			NOT: { commodityId: { startsWith: "cut:" } },
		},
		data: { status: PS.COMPLETED },
	});

	return result.count;
}

/**
 * Auto-verify completed predictions whose forecast horizon has elapsed.
 *
 * For each completed prediction_log older than its horizon, fetch the actual
 * daily close prices for the prediction's commodity over the forecast period
 * and compute MAPE via verifyPrediction. This closes the loop:
 *   completed → verified  so backtest/accuracy endpoints have real MAPE data.
 *
 * Designed to run on a schedule (called from server.ts). Idempotent — only
 * touches status='completed' rows whose predictedAt + horizon has passed.
 *
 * Root-cause note (2026-07-13): the old version used a hardcoded 7-day cutoff
 * for the SQL pre-filter AND `take: 500 orderBy: predictedAt DESC`. With
 * predictions generated every 30 min (horizon=10), fresh predictions are always
 * <10d old → never eligible → beef_carcass_us showed 365 completed / 0 verified
 * indefinitely. Meanwhile the 3270-row backlog (frozen-data commodities) was
 * starved by the 500-cap DESC sort. Fixed by: (1) using the true max horizon as
 * the SQL cutoff so the pre-filter matches the per-row check, (2) raising the
 * batch + processing OLDEST-first so backlog drains, (3) logging which
 * commodities are stuck on no-actuals so operators can see data gaps.
 *
 * @returns number of predictions verified this run
 */
export async function verifyDuePredictions(): Promise<number> {
	// imported lazily to avoid circular import at module load (same pattern
	// as the post-loop info log below). Hoisted to the top so the per-row
	// catch blocks below can warn on individual failures (round-86 fix:
	// silent degradation must be observable, matching inference.ts:230).
	const { logger } = await import("@/lib");
	// SQL pre-filter: older than the longest horizon we use (10 days). The
	// per-row check below still applies the exact horizon. This is a superset
	// filter — it may include rows whose horizon hasn't elapsed, but those are
	// skipped in-loop. Using the max horizon (not a hardcoded 7d) ensures we
	// don't miss horizon=10 rows that became eligible at day 10.
	const MAX_HORIZON_DAYS = 10;
	const cutoff = new Date(Date.now() - MAX_HORIZON_DAYS * 86400000);
	const now = Date.now();
	const due = await prisma.predictionLog.findMany({
		where: {
			status: PS.COMPLETED,
			predictedAt: { lte: cutoff },
		},
		select: {
			id: true,
			commodityId: true,
			horizon: true,
			predictedAt: true,
			forecastStartAt: true,
		},
		// OLDEST first so the backlog drains. DESC kept re-sampling the same
		// near-cutoff rows every run, starving older verifiable candidates.
		// Batch raised 2000 → 5000 (round-46): with a 106k-row backlog the
		// daily 2000-batch would take ~53 days to drain; 5000 + the 6h cadence
		// in server.ts cuts that to under a week. Each row is one indexed
		// lookup + one small actuals query, so 5000 is still cheap.
		orderBy: { predictedAt: "asc" },
		take: 5000,
	});

	let verified = 0;
	let skippedNoActuals = 0;
	let skippedHorizon = 0;
	// Track which commodities are stuck on no-actuals (data gap signal).
	const noActualsByCommodity = new Map<string, number>();

	// Round-87: pre-fetch commodity slugs for all non-cut due rows in ONE
	// query, instead of a findUnique per row inside the loop (up to 5000
	// redundant lookups — predictions repeat per commodity every 30min, so a
	// 5000-row batch typically spans only a handful of distinct commodityIds).
	// The authoritative source is then resolved from the map in-loop.
	const nonCutCommodityIds = [
		...new Set(due.filter((d) => !isCutSeriesKey(d.commodityId)).map((d) => d.commodityId)),
	];
	const slugByCommodityId = new Map<string, string | null>();
	if (nonCutCommodityIds.length > 0) {
		const commodities = await prisma.commodity.findMany({
			where: { id: { in: nonCutCommodityIds } },
			select: { id: true, slug: true },
		});
		for (const c of commodities) slugByCommodityId.set(c.id, c.slug);
	}

	for (const log of due) {
		try {
			// Per-row horizon check: predictedAt + horizon days must have elapsed
			const horizonMs = log.horizon * 86400000;
			if (log.predictedAt.getTime() + horizonMs > now) {
				skippedHorizon++;
				continue;
			}

			// Actuals-window anchor: the forecast's own timeline start when
			// recorded (round-104), falling back to predictedAt for legacy rows.
			// predictedAt is the LOG time; when the source lags, the training
			// series ends days before the log, so forecast day-1 is ALSO days
			// before the log — anchoring actuals at predictedAt paired them
			// with the wrong forecast steps and systematically inflated MAPE.
			const anchor = log.forecastStartAt ?? log.predictedAt;
			const anchorDay = Date.UTC(
				anchor.getUTCFullYear(),
				anchor.getUTCMonth(),
				anchor.getUTCDate(),
			);
			// Actuals carry mixed intraday times (00:00, 16:00, …); fetch from
			// half a day before the anchor day, then drop leading rows whose
			// UTC day precedes it so index-pairing starts at forecast day-1.
			const fetchFrom = new Date(anchorDay - 12 * 3600 * 1000);
			const alignToAnchorDay = <T extends { date: Date }>(rows: T[]): T[] =>
				rows.filter((r) => r.date.getTime() >= anchorDay);

			// Fetch actuals AFTER the prediction was made, up to horizon.
			// Dual-backend: cut-series predictions are logged with a virtual
			// commodityId `cut:{factoryId}:{cutCode}` and their actuals live in
			// BeefCutPrice (NOT CommodityPrice). Without this branch every cut
			// prediction hits 0 actuals → chronos MAPE is never computed, so the
			// /ai/accuracy page stays empty for the entire cut-forecast path
			// (PRODUCT-SPEC §三 MAPE 验证). Commodity predictions read
			// CommodityPrice as before.
			let actualValues: number[];
			if (isCutSeriesKey(log.commodityId)) {
				const parsed = parseCutSeriesKey(log.commodityId);
				if (!parsed) {
					// Malformed key — can't resolve actuals; skip honestly.
					skippedNoActuals++;
					continue;
				}
				// Source filter mirrors the training side (getBeefCutSeries defaults
				// to includeBridge=false). Without this, a cut forecast trained on
				// real scraper rows gets "verified" against bridge:commodity:* proxy
				// rows (a carcass aggregate copied in by beefPriceBridge) — the cut
				// analog of the brl_usd authoritative-source bug (docs/KNOWN-ISSUES R2).
				const cutActuals = await prisma.beefCutPrice.findMany({
					where: {
						factoryId: parsed.factoryId,
						cutCode: parsed.cutCode,
						date: { gte: fetchFrom },
						source: { not: { startsWith: "bridge:" } },
					},
					orderBy: { date: "asc" },
					take: log.horizon + 1,
					select: { price: true, date: true },
				});
				const aligned = alignToAnchorDay(cutActuals).slice(0, log.horizon);
				if (aligned.length < Math.min(log.horizon, 3)) {
					skippedNoActuals++;
					noActualsByCommodity.set(
						log.commodityId,
						(noActualsByCommodity.get(log.commodityId) ?? 0) + 1,
					);
					continue;
				}
				actualValues = aligned.map((p) => Number(p.price));
			} else {
				// Multi-source guard (docs/KNOWN-ISSUES.md R2): filter actuals by
				// the same authoritative source the training data used, so the
				// MAPE numerator compares like with like. Without this, a brl_usd
				// prediction trained on fred (≈5.0) gets "verified" against
				// exchange_rate_api rows (≈0.2) → bogus ~96% MAPE.
				// Round-87: slug is now read from the pre-fetched map (one query
				// before the loop) instead of a findUnique per row.
				const slug = slugByCommodityId.get(log.commodityId);
				const authoritativeSource = getAuthoritativeSource(slug);
				const actualPrices = await prisma.commodityPrice.findMany({
					where: {
						commodityId: log.commodityId,
						interval: "daily",
						date: { gte: fetchFrom },
						...(authoritativeSource ? { source: authoritativeSource } : {}),
					},
					orderBy: { date: "asc" },
					take: log.horizon + 1,
					select: { close: true, date: true },
				});
				const aligned = alignToAnchorDay(actualPrices).slice(0, log.horizon);
				if (aligned.length < Math.min(log.horizon, 3)) {
					skippedNoActuals++;
					noActualsByCommodity.set(
						log.commodityId,
						(noActualsByCommodity.get(log.commodityId) ?? 0) + 1,
					);
					continue;
				}
				actualValues = aligned.map((p) => Number(p.close));
			}
			const result = await verifyPrediction(log.id, actualValues);
			if (result) verified++;
		} catch (error) {
			// Individual verification failures must not abort the batch, but
			// must be logged so a persistent row-level bug is visible (the
			// aggregate "Verified N of M" log can't distinguish "no actuals"
			// from "verifyPrediction threw"). Matches inference.ts:230 pattern.
			logger.warn("[MAPE] verifyPrediction failed for log", {
				logId: log.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// logger hoisted to the top of this function (see comment above)
	const stuckCommodities = [...noActualsByCommodity.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([id, count]) => `${id.slice(0, 8)}:${count}`)
		.join(", ");
	logger.info(
		`[MAPE] Verified ${verified} of ${due.length} due predictions (${skippedNoActuals} no actuals, ${skippedHorizon} horizon not elapsed)` +
			(stuckCommodities ? ` | stuck-no-actuals: ${stuckCommodities}` : ""),
	);

	return verified;
}

/**
 * Prisma where-fragment that excludes non-real (test-artifact) commodityIds
 * from accuracy aggregation.
 *
 * The mapeTracking integration tests run against the live database and have
 * leaked rows into production `prediction_logs` (see KNOWN-ISSUES): synthetic
 * cut-series keys like `cut:...:TESTCUT_MAPE-...` and `test-model-*` model
 * rows. Without this filter, `getModelAccuracy("chronos_tiny")` picks up a
 * TESTCUT row and reports `verifiedCount:1, mape:4.63` — making chronos look
 * verified when no production commodity prediction has actually matured.
 *
 * Real commodityIds are either a UUID (a Commodity PK) or a cut-series key
 * `cut:{factoryId}:{cutCode}` derived from a real factory + taxonomy. Neither
 * contains the literal token `TEST`, which every test fixture embeds in its
 * cutCode / modelId. Filtering on `NOT contains "TEST"` is therefore both
 * precise (zero real data matches) and exhaustive (all known fixtures match).
 *
 * Returned as a spread-safe `{}`-shaped fragment so callers merge it into
 * their existing `where` without restructuring.
 *
 * Exported (round-113) so intervalCalibration applies the SAME definition of
 * "verified evidence" — a leaked fixture row with a real modelId would
 * otherwise contribute synthetic residuals to that model's conformal q.
 */
export const EXCLUDE_TEST_ARTIFACTS = {
	// Case-insensitive: leaked fixtures use both "TESTCUT_..." (cut-series
	// verification test) and "test-commodity-..." (logPrediction tests). Prisma
	// only allows `mode: "insensitive"` on a top-level filter, so this uses the
	// `NOT` array form rather than `commodityId: { not: { contains } }`.
	NOT: [{ commodityId: { contains: "test", mode: "insensitive" } }],
} as const satisfies Prisma.PredictionLogWhereInput;

/**
 * Get model accuracy (average MAPE) over a time window
 */
export async function getModelAccuracy(
	modelId: string,
	commodityId?: string,
	days: number = 30,
): Promise<{
	modelId: string;
	avgMape: number | null;
	predictionCount: number;
	verifiedCount: number;
	last7dMape: number | null;
	last30dMape: number | null;
	lastVerifiedAt: string | null;
}> {
	const since = new Date(Date.now() - days * 86400000);

	const verifiedWhere = (since: Date): Prisma.PredictionLogWhereInput => ({
		modelId,
		status: PS.VERIFIED,
		verifiedAt: { gte: since },
		...EXCLUDE_TEST_ARTIFACTS,
		...(commodityId ? { commodityId } : {}),
	});

	// Denominator (round-104): predictions MADE in the window (predictedAt ≥
	// since, any terminal/active status) — the honest base for a verification
	// ratio. The previous "denominator" re-ran the numerator's own query
	// (status=VERIFIED + verifiedAt ≥ since), so predictionCount ===
	// verifiedCount structurally and the ratio was always 100%. Young
	// predictions that haven't matured now legitimately lower the ratio.
	const predictionCount = await prisma.predictionLog.count({
		where: {
			modelId,
			predictedAt: { gte: since },
			status: { in: [PS.COMPLETED, PS.VERIFIED, PS.STALE, PS.UNVERIFIABLE] },
			...EXCLUDE_TEST_ARTIFACTS,
			...(commodityId ? { commodityId } : {}),
		},
	});

	// SQL-side aggregation (round-104): the previous implementation pulled
	// every verified row in the window into Node to average in JS — unbounded
	// memory/time on a 100k+ row table, re-fetched per model (×9) on every
	// accuracy page load.
	const last7d = new Date(Date.now() - 7 * 86400000);
	const last30d = new Date(Date.now() - 30 * 86400000);
	const round2 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100);

	const [mainAgg, last7dAgg, last30dAgg, lastVerifiedRow] = await Promise.all([
		prisma.predictionLog.aggregate({
			where: verifiedWhere(since),
			_avg: { mape: true },
			_count: { _all: true },
		}),
		prisma.predictionLog.aggregate({
			where: verifiedWhere(last7d),
			_avg: { mape: true },
		}),
		prisma.predictionLog.aggregate({
			where: verifiedWhere(last30d),
			_avg: { mape: true },
		}),
		prisma.predictionLog.findFirst({
			where: verifiedWhere(new Date(0)),
			select: { verifiedAt: true },
			orderBy: { verifiedAt: "desc" },
		}),
	]);

	// Most-recent verification timestamp — surfaced as a freshness signal so
	// the accuracy comparison page can show when a model's MAPE was last
	// backed by real data (a frozen historical baseline vs an actively-
	// verified primary model).
	const lastVerifiedAt = lastVerifiedRow?.verifiedAt?.toISOString() ?? null;

	return {
		modelId,
		avgMape: round2(mainAgg._avg.mape?.toNumber()),
		predictionCount,
		verifiedCount: mainAgg._count._all,
		last7dMape: round2(last7dAgg._avg.mape?.toNumber()),
		last30dMape: round2(last30dAgg._avg.mape?.toNumber()),
		lastVerifiedAt,
	};
}

/**
 * Get accuracy for all models (for comparison view)
 *
 * Round-87: when called with commodityId=undefined (the "all models" case),
 * the result is identical across commodities. resolveModelWeights calls this
 * per-forecast inside /signals/batch (up to 50 commodities), so without
 * memoization that's 50 × 9 models × 2 queries = ~900 redundant queries per
 * batch. A short-lived (60s) in-memory cache collapses these to 1 fetch per
 * TTL window — far shorter than the route-level 600s cache, but enough to
 * dedupe within a single batch request.
 */
const ALL_MODEL_ACCURACY_TTL_MS = 60_000;
let allModelAccuracyCache: {
	key: string;
	value: Awaited<ReturnType<typeof computeAllModelAccuracy>>;
	expiresAt: number;
} | null = null;

async function computeAllModelAccuracy(commodityId: string | undefined, days: number) {
	// Primary chronos ensemble + baselines for the accuracy-comparison page.
	// Importing here (not at module top) avoids a circular dependency:
	// tradingSignals imports predictionCache which imports mapeTracking.
	const { getAllModels, BASELINE_MODELS } = await import("./tradingSignals");
	const primary = new Set(getAllModels());
	// Order matters: primary (chronos) first, then baselines — matches the
	// MODEL_NAME_MAP grouping and the primary-vs-baseline visual split on the
	// accuracy page.
	const models = [...getAllModels(), ...BASELINE_MODELS];

	const results = await Promise.all(
		models.map(async (modelId) => {
			const accuracy = await getModelAccuracy(modelId, commodityId, days);
			return {
				modelId,
				avgMape: accuracy.avgMape,
				predictionCount: accuracy.predictionCount,
				verifiedCount: accuracy.verifiedCount,
				// Forwarded from getModelAccuracy — previously dropped at this
				// boundary, so the comparison page had no way to show trend or
				// freshness. last7d/30d feed the trend chart; lastVerifiedAt
				// feeds a "how stale is this MAPE?" badge.
				last7dMape: accuracy.last7dMape,
				last30dMape: accuracy.last30dMape,
				lastVerifiedAt: accuracy.lastVerifiedAt,
				// Primary (chronos ensemble) vs statistical baseline. Drives the
				// role badge + the honesty banner on the comparison page.
				isPrimary: primary.has(modelId),
			};
		}),
	);

	return results;
}

export async function getAllModelAccuracy(
	commodityId?: string,
	days: number = 30,
): Promise<
	Array<{
		modelId: string;
		avgMape: number | null;
		predictionCount: number;
		verifiedCount: number;
		last7dMape: number | null;
		last30dMape: number | null;
		lastVerifiedAt: string | null;
		isPrimary: boolean;
	}>
> {
	// Only cache the "all commodities" case (commodityId=undefined) — per-
	// commodity results are cheap (one model, not 9) and would need per-key
	// cache entries that grow unbounded.
	const cacheKey = `${commodityId ?? "all"}:${days}`;
	if (commodityId === undefined) {
		if (
			allModelAccuracyCache &&
			allModelAccuracyCache.key === cacheKey &&
			allModelAccuracyCache.expiresAt > Date.now()
		) {
			return allModelAccuracyCache.value;
		}
	}

	const value = await computeAllModelAccuracy(commodityId, days);

	if (commodityId === undefined) {
		allModelAccuracyCache = {
			key: cacheKey,
			value,
			expiresAt: Date.now() + ALL_MODEL_ACCURACY_TTL_MS,
		};
	}

	return value;
}
