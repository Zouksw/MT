/**
 * Public track record (IMPROVEMENT-PLAN batch 2, 2026-08-23).
 *
 * A prediction product earns trust ONLY through dated, checkable predictions.
 * The platform already logs every prediction and auto-verifies MAPE
 * (prediction_logs, 142k+ rows as of 2026-08-23) — but that evidence sat
 * behind the login wall. This service exposes an UNAUTHENTICATED,
 * privacy-whitelisted slice:
 *
 *   - leaderboard: the same 30-day aggregate getAllModelAccuracy serves
 *     (model-level aggregates only, no per-series detail);
 *   - samples: the most recent VERIFIED predictions, restricted to series
 *     the platform may show anonymously — macro commodities (by slug) and
 *     beef-cut series (virtual "cut:{factory}:{cut}" keys).
 *
 * SECURITY INVARIANT: a prediction on any OTHER commodityId (a user's
 * private dataset/timeseries id) must never appear. The whitelist is
 * positive ("is a known macro commodity OR a cut: key"), not a blocklist —
 * an unknown id fails closed. Tests pin this.
 */

import { prisma } from "@/lib";
import { getAllModelAccuracy } from "./mapeTracking";
import { PredictionStatus as PS } from "./predictionLifecycle";

/** Published sample rows cap — the page is a digest, not a data dump. */
export const RECENT_SAMPLE_LIMIT = 50;
/** Over-fetch before whitelist filtering so filtering can't starve the cap. */
const SAMPLE_FETCH_LIMIT = 400;

export interface TrackRecordSample {
	/** Stable series identity: commodity slug or cut:{factoryId}:{cutCode}. */
	seriesKey: string;
	/** Human-readable series name. */
	seriesLabel: string;
	modelId: string;
	horizon: number;
	/** When the forecast was logged (ISO). */
	predictedAt: string;
	/** End-of-horizon predicted vs actual value (null when JSON unparsable). */
	predicted: number | null;
	actual: number | null;
	/** Verified MAPE (%) for this prediction. */
	mape: number | null;
	verifiedAt: string;
}

export interface PublicTrackRecord {
	windowDays: number;
	generatedAt: string;
	leaderboard: Array<{
		modelId: string;
		medianMape: number | null;
		avgMape: number | null;
		verifiedCount: number;
		predictionCount: number;
		lastVerifiedAt: string | null;
		/** Rolling direction-hit rate [0,1] (round-137 批4) — share of verified
		 * rows whose end-of-horizon direction matched the actual move vs the
		 * pre-window anchor. null when no judged rows (e.g. naive: flat). */
		directionHitRate: number | null;
		directionCount: number;
	}>;
	samples: TrackRecordSample[];
	methodology: {
		verification: string;
		window: string;
		metric: string;
		direction: string;
		consensus: string;
	};
}

/** Last element of a JSON array value, null-safely. */
function lastJsonNumber(value: unknown): number | null {
	if (!Array.isArray(value) || value.length === 0) return null;
	const last = value[value.length - 1];
	return typeof last === "number" && Number.isFinite(last) ? last : null;
}

export async function getPublicTrackRecord(days = 30): Promise<PublicTrackRecord> {
	// Leaderboard reuses the accuracy aggregate (cached, model-level only).
	const accuracy = await getAllModelAccuracy(undefined, days);

	// Whitelist source 1: every registered macro commodity (public by nature).
	const macroCommodities = await prisma.commodity.findMany({
		select: { id: true, slug: true, name: true },
	});
	const macroById = new Map(macroCommodities.map((c) => [c.id, c]));

	const rows = await prisma.predictionLog.findMany({
		where: {
			status: PS.VERIFIED,
			// Same test-artifact exclusion the accuracy page applies.
			NOT: [{ commodityId: { contains: "test", mode: "insensitive" } }],
		},
		orderBy: { verifiedAt: "desc" },
		take: SAMPLE_FETCH_LIMIT,
		select: {
			commodityId: true,
			modelId: true,
			horizon: true,
			predictedAt: true,
			verifiedAt: true,
			mape: true,
			predictedValues: true,
			actualValues: true,
		},
	});

	const samples: TrackRecordSample[] = [];
	for (const row of rows) {
		if (samples.length >= RECENT_SAMPLE_LIMIT) break;

		// POSITIVE whitelist: macro commodity, or a beef-cut virtual key.
		// Anything else (user datasets, unknown ids) fails closed.
		const isCut = row.commodityId.startsWith("cut:");
		const macro = macroById.get(row.commodityId);
		if (!isCut && !macro) continue;

		const cutParts = isCut ? row.commodityId.split(":") : null;
		if (isCut && cutParts?.length !== 3) continue; // malformed cut key — skip

		samples.push({
			seriesKey: isCut ? row.commodityId : (macro?.slug as string),
			seriesLabel: isCut
				? `Beef cut ${cutParts?.[2]} (plant ${cutParts?.[1]})`
				: (macro?.name as string),
			modelId: row.modelId,
			horizon: row.horizon,
			predictedAt: row.predictedAt.toISOString(),
			predicted: lastJsonNumber(row.predictedValues),
			actual: lastJsonNumber(row.actualValues),
			mape: row.mape == null ? null : Number(row.mape),
			verifiedAt: row.verifiedAt?.toISOString() ?? row.predictedAt.toISOString(),
		});
	}

	return {
		windowDays: days,
		generatedAt: new Date().toISOString(),
		leaderboard: accuracy.map((a) => ({
			modelId: a.modelId,
			medianMape: a.medianMape,
			avgMape: a.avgMape,
			verifiedCount: a.verifiedCount,
			predictionCount: a.predictionCount,
			lastVerifiedAt: a.lastVerifiedAt,
			directionHitRate: a.directionHitRate,
			directionCount: a.directionCount,
		})),
		samples,
		methodology: {
			verification:
				"Every forecast is logged when made (predicted_at) and automatically re-scored when actual prices arrive; MAPE is computed against the aligned actuals window.",
			window: `Leaderboard and freshness use a rolling ${days}-day verification window; samples are the most recent verified predictions.`,
			metric:
				"MAPE = mean absolute percentage error between predicted values and actuals over the horizon. Median is the headline stat (robust to outliers); mean is kept for risk context. Scoring uses ONLY predictions whose verification succeeded (status=verified) — rows invalidated or marked stale/unverifiable never enter medianMape/avgMape/verifiedCount, but they DO remain in predictionCount, which counts every logged prediction in the window: the two fields use different denominators by design.",
			direction:
				"Direction hit = the end-of-horizon forecast's up/down move relative to the last pre-forecast price (anchor) matched the actual move. Flat forecasts (the naive baseline repeats the anchor) are excluded from the denominator, not counted as misses — the same semantics as the published beef monthly backtest. Series whose price history mixes undeclared sources have no unambiguous anchor and are excluded from direction (their MAPE is unaffected).",
			consensus:
				"The signal consensus weighs each model by its verified MAPE; models verified strictly worse than the naive baseline are eliminated from the vote.",
		},
	};
}
