/**
 * BeefCutPrice time-series extraction — the dual-backend prediction path.
 *
 * ARCHITECTURE (see docs/PROJECT-STATE-AND-VISION §3.1)
 * The prediction engine (tradingSignals.generateForecast + predictionCache)
 * was originally coupled to CommodityPrice via commodityId. Beef cut prices
 * live in a SEPARATE table (BeefCutPrice, keyed by factoryId+cutCode), so the
 * engine could never forecast a cut — only macro commodities (FX, carcass
 * aggregates). This module bridges that gap WITHOUT rewriting the consensus
 * pipeline: it extracts a BeefCutPrice series into the same {values,
 * timestamps} shape getCommodityPriceValues returns, so the rest of the
 * pipeline (predict → cache → ensemble → MAPE) is reused verbatim.
 *
 * VIRTUAL KEY CONVENTION
 * To reuse predictionCache (which keys on a single `timeseries` string), a
 * cut series is addressed by the virtual key `cut:{factoryId}:{cutCode}`.
 * predictionCache.runAndCachePrediction detects the `cut:` prefix and routes
 * to getBeefCutSeries instead of getCommodityPriceValues. This keeps cache
 * namespaces disjoint (a cut forecast never collides with a commodity
 * forecast) and requires zero changes to the cache/ensemble/MAPE code.
 *
 * DATA-HONESTY GATING
 * Bridge-proxy rows (source LIKE 'bridge:%') are EXCLUDED from the training
 * series by default — a cut forecast must not be trained on carcass-aggregate
 * proxies mislabeled as cut prices. Callers that explicitly want to include
 * proxies can pass includeBridge=true, but the default is the honest path.
 */

import { prisma } from "@/lib";

export interface BeefCutSeriesOptions {
	factoryId: string;
	cutCode: string;
	/** Max number of trailing daily points to fetch (default 200). */
	limit?: number;
	/** Include bridge:commodity:* proxy rows. Default false (honest path). */
	includeBridge?: boolean;
}

/**
 * Build the virtual cache/pipeline key for a (factoryId, cutCode) series.
 * Stable: the same inputs always produce the same key.
 */
export function cutSeriesKey(factoryId: string, cutCode: string): string {
	return `cut:${factoryId}:${cutCode}`;
}

/** True iff `key` is a virtual cut-series key (vs a real commodityId). */
export function isCutSeriesKey(key: string): boolean {
	return key.startsWith("cut:");
}

/**
 * Extract a BeefCutPrice daily series for one (factoryId, cutCode) into the
 * {values, timestamps} shape the inference pipeline expects.
 *
 * Chronological order (oldest first), matching getCommodityPriceValues.
 * Throws on <2 points (the inference engine's minimum for fitting any model).
 */
export async function getBeefCutSeries(
	opts: BeefCutSeriesOptions,
): Promise<{ values: number[]; timestamps: number[] }> {
	const { factoryId, cutCode, limit = 200, includeBridge = false } = opts;

	const where = {
		factoryId,
		cutCode,
		...(includeBridge ? {} : { source: { not: { startsWith: "bridge:" } } }),
	};

	const rows = await prisma.beefCutPrice.findMany({
		where,
		orderBy: { date: "desc" },
		select: { price: true, date: true, source: true },
		take: limit,
	});

	// Chronological order (oldest first) for the forecasting models.
	rows.reverse();

	if (rows.length < 2) {
		throw new Error(
			`Insufficient beef cut data for ${cutCode}/factory ${factoryId}: ${rows.length} points` +
				(includeBridge ? "" : " (bridge proxies excluded)"),
		);
	}

	return {
		// price is Decimal(18,4) — coerce to number at the read boundary for
		// the inference pipeline (which takes number[]). Sub-$0.0001 precision
		// is preserved well within JS double range.
		values: rows.map((r) => Number(r.price)),
		timestamps: rows.map((r) => r.date.getTime()),
	};
}

/**
 * Resolve a virtual cut-series key back to its {factoryId, cutCode}.
 * Returns null if the key is not a cut key.
 */
export function parseCutSeriesKey(key: string): { factoryId: string; cutCode: string } | null {
	if (!isCutSeriesKey(key)) return null;
	// Format: cut:{factoryId}:{cutCode}. cutCode itself never contains ':'.
	// "cut:X:Y" → ["cut", "X", "Y"] = 3 parts.
	const parts = key.split(":");
	if (parts.length !== 3) return null;
	const [, factoryId, cutCode] = parts;
	if (!factoryId || !cutCode) return null;
	return { factoryId, cutCode };
}
