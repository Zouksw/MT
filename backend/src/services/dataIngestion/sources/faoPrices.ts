/**
 * FAO Food Price Index Scraper
 *
 * Fetches food price indices from FAOSTAT.
 * API: https://fenixservices.fao.org/faostat/api/v1/en/data/CP
 * Free, no API key required.
 *
 * Covers: Food, Meat, Dairy, Cereals, Oils price indices
 */

import { logger, prisma } from "@/lib";
import { upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const FAO_INDICES: Record<string, { itemCode: string; slug: string }> = {
	food_index: { itemCode: "21012", slug: "fao_food_index" },
	meat_index: { itemCode: "21013", slug: "fao_meat_index" },
	dairy_index: { itemCode: "21014", slug: "fao_dairy_index" },
	cereals_index: { itemCode: "21015", slug: "fao_cereals_index" },
	oils_index: { itemCode: "21017", slug: "fao_oils_index" },
};

async function fetchWithRetry(url: string): Promise<Response | null> {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const res = await fetch(url, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(30000),
			});
			if (res.ok) return res;
			logger.warn(`[FAO] API returned ${res.status} (attempt ${attempt + 1})`);
		} catch (err) {
			logger.warn(
				`[FAO] Fetch failed (attempt ${attempt + 1}): ${err instanceof Error ? err.message : err}`,
			);
		}
		if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
	}
	return null;
}

async function fetchFAOPrices(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	for (const [, config] of Object.entries(FAO_INDICES)) {
		const commodity = await prisma.commodity.findUnique({ where: { slug: config.slug } });
		if (!commodity) continue;

		const url = `https://fenixservices.fao.org/faostat/api/v1/en/data/CP?area_code=351&item_code=${config.itemCode}&element_code=5510&year=2024,2025,2026&show_codes=true&show_unit=true`;
		const res = await fetchWithRetry(url);
		if (!res) continue;

		const data = (await res.json()) as {
			data?: Array<{ Year: string; Value: string; Flag: string }>;
		};
		const rows = data.data ?? [];
		if (rows.length === 0) continue;

		const latest = rows[rows.length - 1];
		const year = parseInt(latest.Year, 10);
		const value = parseFloat(latest.Value);
		if (!value || Number.isNaN(value) || !year) continue;

		// FAO data is annual — use Jan 1 of the year
		const date = new Date(year, 0, 1);

		const r = await upsertPrice({
			commodityId: commodity.id,
			date,
			interval: "yearly",
			source: "fao_faostat",
			open: value,
			high: value * 1.01,
			low: value * 0.99,
			close: value,
			metadata: { itemCode: config.itemCode, year, flag: latest.Flag },
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	logger.info(`[FAO] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const faoPriceScraper: Scraper = { name: "fao_prices", fetch: fetchFAOPrices };
