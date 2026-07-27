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
		orderBy: { predictedAt: "asc" },
		take: 2000,
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
				const actualPrices = await prisma.commodityPrice.findMany({
					where: {
						commodityId: log.commodityId,
						interval: "daily",
						date: { gt: log.predictedAt },
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

	return {
		modelId,
		avgMape: computeAvg(verified),
		predictionCount: totalCount,
		verifiedCount: verified.length,
		last7dMape: computeAvg(last7dLogs),
		last30dMape: computeAvg(verified),
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
	}>
> {
	// Primary chronos ensemble + baselines for the accuracy-comparison page.
	// Importing here (not at module top) avoids a circular dependency:
	// tradingSignals imports predictionCache which imports mapeTracking.
	const { getAllModels, BASELINE_MODELS } = await import("./tradingSignals");
	const models = [...getAllModels(), ...BASELINE_MODELS];

	const results = await Promise.all(
		models.map(async (modelId) => {
			const accuracy = await getModelAccuracy(modelId, commodityId, days);
			return {
				modelId,
				avgMape: accuracy.avgMape,
				predictionCount: accuracy.predictionCount,
				verifiedCount: accuracy.verifiedCount,
			};
		}),
	);

	return results;
}
