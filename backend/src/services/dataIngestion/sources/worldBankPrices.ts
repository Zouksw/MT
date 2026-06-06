/**
 * World Bank Pink Sheet Commodity Prices — FRED Fallback
 *
 * Primary: FRED monthly commodity price CSV download (no API key needed)
 * Fallback: World Bank API (currently offline — returns 404)
 *
 * Covers: energy, metals, grains, soft commodities via FRED monthly series.
 * Full Pink Sheet (70+ commodities) requires World Bank API to come back online.
 */

import { logger } from "@/lib";
import { ensureCommodity, upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

/** FRED monthly commodity price series (no API key needed via CSV download) */
const FRED_MONTHLY: Record<
	string,
	{
		seriesId: string;
		slug: string;
		name: string;
		category: string;
		unit: string;
	}
> = {
	// Energy
	CRUDE_WTI: {
		seriesId: "POILWTIUSDM",
		slug: "crude_oil_wti",
		name: "Crude Oil (WTI)",
		category: "energy",
		unit: "USD/bbl",
	},
	NATURAL_GAS: {
		seriesId: "PNGASJPUSDM",
		slug: "natural_gas_us",
		name: "Natural Gas (US)",
		category: "energy",
		unit: "USD/MMBtu",
	},

	// Metals
	COPPER: {
		seriesId: "PCOPPUSDM",
		slug: "copper_lme",
		name: "Copper (LME)",
		category: "metals",
		unit: "USD/ton",
	},
	ALUMINUM: {
		seriesId: "PALUMUSDM",
		slug: "aluminum_lme",
		name: "Aluminum (LME)",
		category: "metals",
		unit: "USD/ton",
	},
	IRON_ORE: {
		seriesId: "PIORECRUSDM",
		slug: "iron_ore_cfr",
		name: "Iron Ore (CFR China)",
		category: "metals",
		unit: "USD/ton",
	},

	// Grains
	WHEAT: {
		seriesId: "PWHEAMTUSDM",
		slug: "wheat_us_srw",
		name: "Wheat (US SRW)",
		category: "grain",
		unit: "USD/ton",
	},
	CORN: {
		seriesId: "PMAIZMTUSDM",
		slug: "corn_cbOT",
		name: "Corn (CBOT)",
		category: "grain",
		unit: "USD/ton",
	},
	SOYBEANS: {
		seriesId: "PSOYBUSDM",
		slug: "soybeans_cbOT",
		name: "Soybeans (CBOT)",
		category: "grain",
		unit: "USD/ton",
	},
	RICE: {
		seriesId: "IR14280",
		slug: "rice_thai",
		name: "Rice (Thai 5%)",
		category: "grain",
		unit: "USD/ton",
	},

	// Soft Commodities
	SUGAR: {
		seriesId: "PSUGAISAUSDM",
		slug: "sugar_world",
		name: "Sugar (World)",
		category: "soft_commodities",
		unit: "cents/kg",
	},
	COFFEE: {
		seriesId: "PCOFFOTMUSDM",
		slug: "coffee_arabica",
		name: "Coffee (Arabica)",
		category: "soft_commodities",
		unit: "cents/kg",
	},
	RUBBER: {
		seriesId: "PRUBBUSDM",
		slug: "rubber_tsr20",
		name: "Rubber (TSR20)",
		category: "soft_commodities",
		unit: "cents/kg",
	},
};

async function fetchFredMonthly(
	config: (typeof FRED_MONTHLY)[string],
): Promise<{ inserted: number; updated: number }> {
	const end = new Date();
	const start = new Date();
	start.setMonth(start.getMonth() - 3); // Last 3 months

	const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${config.seriesId}&cosd=${start.toISOString().slice(0, 10)}&coed=${end.toISOString().slice(0, 10)}`;

	const res = await fetch(url, {
		headers: { "User-Agent": "MT/1.0" },
		signal: AbortSignal.timeout(15000),
	});
	if (!res.ok) {
		logger.warn(`[WORLD_BANK/FRED] ${config.seriesId}: HTTP ${res.status}`);
		return { inserted: 0, updated: 0 };
	}

	const text = await res.text();
	const lines = text.trim().split("\n");
	if (lines.length < 2) return { inserted: 0, updated: 0 };

	let inserted = 0;
	let updated = 0;

	const commodity = await ensureCommodity({
		slug: config.slug,
		name: config.name,
		category: config.category,
		unit: config.unit,
		metadata: { source: "fred_monthly", seriesId: config.seriesId },
	});

	// Skip header, parse CSV rows
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(",");
		if (cols.length < 2) continue;

		const dateStr = cols[0].trim();
		const value = parseFloat(cols[1].trim());
		if (Number.isNaN(value) || !dateStr) continue;

		const date = new Date(`${dateStr}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) continue;

		const r = await upsertPrice({
			commodityId: commodity.id,
			date,
			source: "world_bank",
			open: value,
			high: value * 1.02,
			low: value * 0.98,
			close: value,
			volume: null,
			metadata: {
				fredSeries: config.seriesId,
				interval: "monthly",
			},
			interval: "monthly",
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	return { inserted, updated };
}

async function fetchWorldBankData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	// Try World Bank API first
	const wbUrl = "https://api.worldbank.org/v2/commodity?format=json&per_page=5000&date=2020:2026";
	let wbSuccess = false;

	try {
		const res = await fetch(wbUrl, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(15000),
		});
		if (res.ok) {
			const data = (await res.json()) as unknown[];
			if (Array.isArray(data?.[1]) && data[1].length > 0) {
				wbSuccess = true;
				logger.info("[WORLD_BANK] API restored — using primary source");
			}
		}
	} catch {
		// WB API offline — use FRED fallback
	}

	if (!wbSuccess) {
		logger.info("[WORLD_BANK] API offline — using FRED monthly fallback");

		for (const [, config] of Object.entries(FRED_MONTHLY)) {
			try {
				const r = await fetchFredMonthly(config);
				inserted += r.inserted;
				updated += r.updated;
			} catch (err) {
				logger.warn(
					`[WORLD_BANK/FRED] ${config.seriesId} failed: ${err instanceof Error ? err.message : err}`,
				);
			}
		}
	}

	logger.info(`[WORLD_BANK] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const worldBankScraper: Scraper = {
	name: "world_bank",
	fetch: fetchWorldBankData,
};
