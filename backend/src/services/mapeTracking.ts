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

export interface LogPredictionParams {
	modelId: string;
	commodityId: string;
	horizon: number;
	predictedValues: number[];
	lowerBounds?: number[];
	upperBounds?: number[];
	confidence?: number;
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
			status: "completed",
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

	await prisma.predictionLog.update({
		where: { id: logId },
		data: {
			actualValues: actualValues,
			mape: Math.round(mape * 10000) / 10000,
			status: "verified",
			verifiedAt: new Date(),
		},
	});

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
			status: { in: ["completed", "verified"] },
			predictedAt: { lt: fixedAt },
		},
		data: { status: "stale" },
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
			status: "stale",
			// Inverse boundary: only post-fix rows. The pre-fix ones stay stale
			// (they really were trained on conflicting-source data and are
			// unrecoverable — see invalidatePollutedPredictions docs).
			predictedAt: { gte: fixedAt },
		},
		data: { status: "completed" },
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
 * Detection (batch, NOT per-row — 92k rows × query would be 184k round-
 * trips): find commodity-IDs (non-cut) that have at least one due
 * completed prediction, then for each check if its latest daily price is
 * older than the OLDEST due prediction for that commodity. If so, every
 * due completed prediction for that commodity has no actuals and never
 * will → mark all of them unverifiable in one updateMany.
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

	// Step 1: find commodity-IDs with due completed predictions (non-cut).
	// Due = predictedAt <= cutoff AND predictedAt + horizon <= now. The SQL
	// cutoff is the max-horizon superset; the per-row horizon check below
	// refines it. We only need distinct commodityIds here.
	const dueCommodities = await prisma.predictionLog.findMany({
		where: {
			status: "completed",
			predictedAt: { lte: cutoff },
			// Exclude cut-series keys — their actuals live in BeefCutPrice, not
			// CommodityPrice; a separate verification path handles them and
			// they should not be swept into the commodity-frozen bucket.
			NOT: { commodityId: { startsWith: "cut:" } },
		},
		select: { commodityId: true, predictedAt: true, horizon: true },
	});

	if (dueCommodities.length === 0) return 0;

	// Group by commodityId, tracking the earliest due predictedAt per
	// commodity (the bar any post-prediction actual must clear) and whether
	// at least one row is truly due (predictedAt + horizon <= now).
	const byCommodity = new Map<string, { earliestPredictedAt: Date; hasDueRow: boolean }>();
	for (const row of dueCommodities) {
		const horizonMs = row.horizon * 86400000;
		const isDue = row.predictedAt.getTime() + horizonMs <= now;
		const existing = byCommodity.get(row.commodityId);
		if (!existing) {
			byCommodity.set(row.commodityId, {
				earliestPredictedAt: row.predictedAt,
				hasDueRow: isDue,
			});
		} else {
			if (row.predictedAt < existing.earliestPredictedAt) {
				existing.earliestPredictedAt = row.predictedAt;
			}
			if (isDue) existing.hasDueRow = true;
		}
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

	if (frozenCommodityIds.length === 0) return 0;

	// Step 3: mark all due completed predictions for frozen commodities as
	// unverifiable in one batched updateMany.
	const result = await prisma.predictionLog.updateMany({
		where: {
			status: "completed",
			commodityId: { in: frozenCommodityIds },
			predictedAt: { lte: cutoff },
			NOT: { commodityId: { startsWith: "cut:" } },
		},
		data: { status: "unverifiable" },
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
			status: "completed",
			predictedAt: { lte: cutoff },
		},
		select: { id: true, commodityId: true, horizon: true, predictedAt: true },
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

	for (const log of due) {
		try {
			// Per-row horizon check: predictedAt + horizon days must have elapsed
			const horizonMs = log.horizon * 86400000;
			if (log.predictedAt.getTime() + horizonMs > now) {
				skippedHorizon++;
				continue;
			}

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
				const cutActuals = await prisma.beefCutPrice.findMany({
					where: {
						factoryId: parsed.factoryId,
						cutCode: parsed.cutCode,
						date: { gt: log.predictedAt },
					},
					orderBy: { date: "asc" },
					take: log.horizon,
					select: { price: true },
				});
				if (cutActuals.length < Math.min(log.horizon, 3)) {
					skippedNoActuals++;
					noActualsByCommodity.set(
						log.commodityId,
						(noActualsByCommodity.get(log.commodityId) ?? 0) + 1,
					);
					continue;
				}
				actualValues = cutActuals.map((p) => Number(p.price));
			} else {
				// Multi-source guard (docs/KNOWN-ISSUES.md R2): filter actuals by
				// the same authoritative source the training data used, so the
				// MAPE numerator compares like with like. Without this, a brl_usd
				// prediction trained on fred (≈5.0) gets "verified" against
				// exchange_rate_api rows (≈0.2) → bogus ~96% MAPE.
				let authoritativeSource: string | null = null;
				try {
					const commodity = await prisma.commodity.findUnique({
						where: { id: log.commodityId },
						select: { slug: true },
					});
					authoritativeSource = getAuthoritativeSource(commodity?.slug);
				} catch {
					// If the commodity lookup fails, fall back to unfiltered
					// (legacy behaviour) rather than abort verification.
				}
				const actualPrices = await prisma.commodityPrice.findMany({
					where: {
						commodityId: log.commodityId,
						interval: "daily",
						date: { gt: log.predictedAt },
						...(authoritativeSource ? { source: authoritativeSource } : {}),
					},
					orderBy: { date: "asc" },
					take: log.horizon,
					select: { close: true },
				});
				if (actualPrices.length < Math.min(log.horizon, 3)) {
					skippedNoActuals++;
					noActualsByCommodity.set(
						log.commodityId,
						(noActualsByCommodity.get(log.commodityId) ?? 0) + 1,
					);
					continue;
				}
				actualValues = actualPrices.map((p) => Number(p.close));
			}
			const result = await verifyPrediction(log.id, actualValues);
			if (result) verified++;
		} catch {
			// Individual verification failures must not abort the batch
		}
	}

	// imported lazily to avoid circular import at module load
	const { logger } = await import("@/lib");
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
 */
const EXCLUDE_TEST_ARTIFACTS = {
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

	const where: Prisma.PredictionLogWhereInput = {
		modelId,
		status: "verified",
		verifiedAt: { gte: since },
		...EXCLUDE_TEST_ARTIFACTS,
	};
	if (commodityId) where.commodityId = commodityId;

	const verified = await prisma.predictionLog.findMany({
		where,
		select: { mape: true, verifiedAt: true },
		orderBy: { verifiedAt: "desc" },
	});

	const totalCount = await prisma.predictionLog.count({
		where: {
			modelId,
			...EXCLUDE_TEST_ARTIFACTS,
			...(commodityId ? { commodityId } : {}),
			predictedAt: { gte: since },
		},
	});

	const computeAvg = (logs: typeof verified) => {
		if (logs.length === 0) return null;
		const sum = logs.reduce((s, l) => s + (l.mape?.toNumber() ?? 0), 0);
		return Math.round((sum / logs.length) * 100) / 100;
	};

	const last7d = new Date(Date.now() - 7 * 86400000);
	const last7dLogs = verified.filter((l) => l.verifiedAt && l.verifiedAt >= last7d);

	// Most-recent verification timestamp — `verified` is ordered desc, so the
	// first row is the latest. Surfaced as a freshness signal so the accuracy
	// comparison page can show when a model's MAPE was last backed by real data
	// (a frozen historical baseline vs an actively-verified primary model).
	const lastVerifiedAt =
		verified.length > 0 ? (verified[0].verifiedAt?.toISOString() ?? null) : null;

	return {
		modelId,
		avgMape: computeAvg(verified),
		predictionCount: totalCount,
		verifiedCount: verified.length,
		last7dMape: computeAvg(last7dLogs),
		last30dMape: computeAvg(verified),
		lastVerifiedAt,
	};
}

/**
 * Get accuracy for all models (for comparison view)
 */
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
