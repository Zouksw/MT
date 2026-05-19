/**
 * USDA FAS PSD (Production, Supply, and Distribution) Data
 *
 * Global agricultural supply and demand data from USDA Foreign Agricultural Service.
 * Covers: grains, oilseeds, meats, cotton, sugar by country
 * Data stored as MarketFactors (type: 'supply_demand') for fundamental analysis.
 */

import { logger } from "@/lib";
import { upsertFactor } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

// PSD commodity codes mapped to our system
const PSD_COMMODITIES: Record<string, { commodityName: string; factors: string[] }> = {
	"0410000": {
		commodityName: "Wheat",
		factors: ["production", "total_consumption", "exports", "imports", "ending_stocks"],
	},
	"0420000": {
		commodityName: "Rice",
		factors: ["production", "total_consumption", "exports", "imports", "ending_stocks"],
	},
	"0440000": {
		commodityName: "Corn",
		factors: ["production", "total_consumption", "exports", "imports", "ending_stocks"],
	},
	"0450000": {
		commodityName: "Barley",
		factors: ["production", "total_consumption", "exports", "imports", "ending_stocks"],
	},
	"0460000": {
		commodityName: "Sorghum",
		factors: ["production", "total_consumption", "exports", "imports", "ending_stocks"],
	},
	"0230000": {
		commodityName: "Beef",
		factors: ["production", "total_consumption", "exports", "imports"],
	},
	"0240000": {
		commodityName: "Pork",
		factors: ["production", "total_consumption", "exports", "imports"],
	},
	"0350000": {
		commodityName: "Chicken",
		factors: ["production", "total_consumption", "exports", "imports"],
	},
	"0813400": {
		commodityName: "Soybeans",
		factors: ["production", "total_consumption", "exports", "imports", "ending_stocks"],
	},
	"0813700": {
		commodityName: "Soybean Meal",
		factors: ["production", "total_consumption", "exports", "imports"],
	},
	"0813600": {
		commodityName: "Soybean Oil",
		factors: ["production", "total_consumption", "exports", "imports"],
	},
	"2220000": {
		commodityName: "Cotton",
		factors: ["production", "total_consumption", "exports", "imports", "ending_stocks"],
	},
};

// Key countries/regions to track
const KEY_COUNTRIES = [
	"World",
	"United States",
	"China",
	"Brazil",
	"Argentina",
	"Australia",
	"European Union",
	"India",
	"Canada",
	"Russia",
];

interface PSDRecord {
	commodityCode: string;
	countryCode: string;
	countryName: string;
	marketYear: string;
	attribute: string;
	value: number;
	unit: string;
}

async function fetchPSDData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	for (const [commodityCode, config] of Object.entries(PSD_COMMODITIES)) {
		try {
			const url = `https://apps.fas.usda.gov/psdonline/api/data/commodity/${commodityCode}?format=json`;
			const res = await fetch(url, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(20000),
			});

			if (!res.ok) {
				logger.warn(`[USDA_PSD] Commodity ${commodityCode} returned ${res.status}`);
				continue;
			}

			const records = (await res.json()) as PSDRecord[];
			if (!Array.isArray(records) || records.length === 0) continue;

			// Filter to key countries and latest market year
			const latestYear = records.reduce((max, r) => (r.marketYear > max ? r.marketYear : max), "");

			const filtered = records.filter(
				(r) =>
					r.marketYear === latestYear &&
					KEY_COUNTRIES.some((c) => r.countryName?.includes(c)) &&
					config.factors.includes(r.attribute),
			);

			for (const record of filtered) {
				if (!record.value || Number.isNaN(record.value)) continue;

				const date = new Date(`${record.marketYear.substring(0, 4)}-01-01T00:00:00Z`);
				if (Number.isNaN(date.getTime())) continue;

				const region = record.countryName || "World";

				const result = await upsertFactor({
					type: "supply_demand",
					region,
					date,
					value: record.value,
					unit: record.unit || "1000 MT",
					source: "usda_psd",
					metadata: {
						commodity: config.commodityName,
						commodityCode,
						attribute: record.attribute,
						marketYear: record.marketYear,
						country: record.countryName,
						countryCode: record.countryCode,
					},
				});
				inserted += result.inserted;
				updated += result.updated;
			}
		} catch (err) {
			logger.warn(
				`[USDA_PSD] ${commodityCode} failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	logger.info(`[USDA_PSD] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const usdaPsdScraper: Scraper = {
	name: "usda_psd",
	fetch: fetchPSDData,
};
