import { prisma } from "@/lib";
import { getAuthoritativeSource } from "@/services/inference/authoritativeSources";

export interface TimeSeriesData {
	values: number[];
	timestamps: number[];
	/** Cadence of the RETURNED series: "monthly" when the round-127 fallback
	 * (or an explicit monthly request) supplied the rows, else "daily".
	 * Prediction writers stamp this onto prediction_logs.interval so the
	 * verification lifecycle can branch per-row cadence (ADR-0001 ③). */
	interval: "daily" | "monthly";
}

export async function getCommodityPriceValues(
	commodityId: string,
	limit = 200,
	interval = "daily",
): Promise<TimeSeriesData> {
	// Multi-source unit-conflict guard (docs/KNOWN-ISSUES.md R2): some slugs
	// (brl_usd, corn_cme, natural_gas_cme) are written by two scrapers with
	// conflicting units/scale/direction. Reading by commodityId alone silently
	// mixes them — and `ORDER BY date DESC LIMIT N` then returns whichever
	// source happened to write most recently, producing a Frankenstein series.
	// If the slug has a declared authoritative source, filter to it so training
	// and MAPE actuals read the same, correctly-unitted series.
	const commodity = await prisma.commodity.findUnique({
		where: { id: commodityId },
		select: { slug: true },
	});
	const authoritativeSource = getAuthoritativeSource(commodity?.slug);

	const queryByInterval = async (iv: string) =>
		prisma.commodityPrice.findMany({
			where: {
				commodityId,
				interval: iv,
				...(authoritativeSource ? { source: authoritativeSource } : {}),
			},
			orderBy: { date: "desc" },
			select: { close: true, date: true },
			take: limit,
		});

	let seriesInterval: "daily" | "monthly" = interval === "monthly" ? "monthly" : "daily";
	let prices = await queryByInterval(interval);
	// Monthly fallback (round-127): the IMF beef benchmark (beef_carcass_us)
	// stores monthly rows — the daily default returned 0 points and every
	// predict call for it 500'd with "Insufficient price data".
	if (prices.length < 2 && interval === "daily") {
		prices = await queryByInterval("monthly");
		seriesInterval = "monthly";
	}

	// Return in chronological order (oldest first) for prediction models
	prices.reverse();

	if (prices.length < 2) {
		throw new Error(
			`Insufficient price data for commodity ${commodityId}: ${prices.length} points`,
		);
	}

	return {
		values: prices.map((p) => Number(p.close)),
		timestamps: prices.map((p) => p.date.getTime()),
		interval: seriesInterval,
	};
}
