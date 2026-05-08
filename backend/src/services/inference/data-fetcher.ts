import { prisma } from "@/lib";

export interface TimeSeriesData {
	values: number[];
	timestamps: number[];
}

export async function getCommodityPriceValues(
	commodityId: string,
	limit = 200,
	interval = "daily",
): Promise<TimeSeriesData> {
	const prices = await prisma.commodityPrice.findMany({
		where: { commodityId, interval },
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
