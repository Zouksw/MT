/**
 * FAO Food Price Index Scraper
 *
 * Fetches food price indices from FAOSTAT (UN Food and Agriculture Organization).
 * API: https://fenixservices.fao.org/faostat/api/v1/en/data/CP
 * Free, no API key required.
 *
 * Covers: Food Price Index, Meat Price Index, Dairy, Cereals, Oils
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

// FAO commodity price indices mapped to our slugs
const FAO_INDICES: Record<
	string,
	{ itemCode: string; elementCode: string; slug: string }
> = {
	food_index: {
		itemCode: "21012",
		elementCode: "5510",
		slug: "fao_food_index",
	},
	meat_index: {
		itemCode: "21013",
		elementCode: "5510",
		slug: "fao_meat_index",
	},
	dairy_index: {
		itemCode: "21014",
		elementCode: "5510",
		slug: "fao_dairy_index",
	},
	cereals_index: {
		itemCode: "21015",
		elementCode: "5510",
		slug: "fao_cereals_index",
	},
	oils_index: {
		itemCode: "21017",
		elementCode: "5510",
		slug: "fao_oils_index",
	},
};

interface FAOResponse {
	data: Array<{
		Year: string;
		Value: string;
		Item: string;
		Flag: string;
	}>;
}

async function fetchFAOIndex(
	itemCode: string,
	elementCode: string,
): Promise<FAOResponse["data"]> {
	const url = `https://fenixservices.fao.org/faostat/api/v1/en/data/CP?area_code=351&item_code=${itemCode}&element_code=${elementCode}&year=2024,2025,2026&show_codes=true&show_unit=true`;

	try {
		const res = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(15000),
		});

		if (!res.ok) {
			logger.warn(`[FAO] Index ${itemCode} returned ${res.status}`);
			return [];
		}

		const data = (await res.json()) as FAOResponse;
		return data.data ?? [];
	} catch (err) {
		logger.warn(
			`[FAO] Fetch ${itemCode} failed: ${err instanceof Error ? err.message : err}`,
		);
		return [];
	}
}

async function updateFAOPrices(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	for (const [, config] of Object.entries(FAO_INDICES)) {
		const commodity = await prisma.commodity.findUnique({
			where: { slug: config.slug },
		});
		if (!commodity) continue;

		const rows = await fetchFAOIndex(config.itemCode, config.elementCode);
		if (rows.length === 0) continue;

		// Use the most recent row (last in array, sorted by year)
		const latest = rows[rows.length - 1];
		const year = parseInt(latest.Year, 10);
		const value = parseFloat(latest.Value);

		if (!value || Number.isNaN(value) || !year) continue;

		// FAO data is annual, use Jan 1 of the year
		const date = new Date(year, 0, 1);

		const existing = await prisma.commodityPrice.findUnique({
			where: {
				commodityId_interval_date_source: {
					commodityId: commodity.id,
					interval: "daily",
					date,
					source: "fao_faostat",
				},
			},
		});

		const priceData = {
			open: value,
			high: value * 1.01,
			low: value * 0.99,
			close: value,
			volume: null,
			source: "fao_faostat",
			metadata: {
				itemCode: config.itemCode,
				year,
				flag: latest.Flag,
			} as unknown as Prisma.InputJsonValue,
		};

		if (existing) {
			await prisma.commodityPrice.update({
				where: { id: existing.id },
				data: priceData,
			});
			updated++;
		} else {
			await prisma.commodityPrice.create({
				data: {
					commodityId: commodity.id,
					date,
					interval: "daily",
					...priceData,
				},
			});
			inserted++;
		}
	}

	return { inserted, updated };
}

export const faoPriceScraper: Scraper = {
	name: "fao_prices",
	fetch: updateFAOPrices,
};
