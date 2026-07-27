import { prisma } from "@/lib";
import { getAuthoritativeSource } from "@/services/inference/authoritativeSources";

export interface TimeSeriesData {
	values: number[];
	timestamps: number[];
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

	const prices = await prisma.commodityPrice.findMany({
		where: {
			commodityId,
			interval,
			...(authoritativeSource ? { source: authoritativeSource } : {}),
		},
		orderBy: { date: "desc" },
		select: { close: true, date: true },
		take: limit,
	});

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
	};
}
