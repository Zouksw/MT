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
