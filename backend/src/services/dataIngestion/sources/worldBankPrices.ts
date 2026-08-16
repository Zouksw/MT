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
import { fetchFredCsvSeries } from "../fredCsv";
import { ensureCommodity, upsertPrice } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

/** FRED monthly commodity price series (no API key needed via CSV download) */
export const FRED_MONTHLY: Record<
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
		slug: "corn_cbot",
		name: "Corn (CBOT)",
		category: "grain",
		unit: "USD/ton",
	},
	SOYBEANS: {
		seriesId: "PSOYBUSDM",
		slug: "soybeans_cbot",
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
	const start = new Date();
	start.setMonth(start.getMonth() - 3); // last 3 months
	// Shared FRED CSV implementation (round-105) — this used to be a private
	// near-duplicate of cmeFutures.fetchFredDaily. Flat candles + interval
	// monthly + source "fred" semantics preserved (see fredCsv.ts header).
	return fetchFredCsvSeries({
		config,
		start,
		interval: "monthly",
		commoditySource: "fred_monthly",
		timeoutMs: 15000,
		logPrefix: "[WORLD_BANK/FRED]",
	});
}

async function fetchWorldBankData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	// Liveness probe for the World Bank commodity API. This is a DIAGNOSTIC
	// signal only — it never gates the FRED write path below. The WB API was
	// the original primary source, but it currently returns 404 (verified
	// 2026-08-01) and even when reachable its response (data[1]) is not parsed
	// into price rows. FRED is the real writer (see file header). Probing here
	// keeps an observable "is WB back?" signal in the logs without the previous
	// bug where `wbSuccess=true` skipped FRED and silently wrote 0 rows while
	// logging "API restored — using primary source".
	const wbUrl = "https://api.worldbank.org/v2/commodity?format=json&per_page=5000&date=2020:2026";
	try {
		const res = await scraperFetch(wbUrl, {
			headers: { Accept: "application/json" },
			timeoutMs: 15000,
		});
		if (res.ok) {
			const data = (await res.json()) as unknown[];
			if (Array.isArray(data?.[1]) && data[1].length > 0) {
				logger.info(
					"[WORLD_BANK] API reachable (liveness OK) — response not parsed; FRED remains the write path",
				);
			} else {
				logger.info("[WORLD_BANK] API reachable but empty — FRED remains the write path");
			}
		} else {
			logger.info(`[WORLD_BANK] API offline (HTTP ${res.status}) — FRED remains the write path`);
		}
	} catch (err) {
		logger.info(
			`[WORLD_BANK] API unreachable (${err instanceof Error ? err.message : "error"}) — FRED remains the write path`,
		);
	}

	// FRED monthly CSV download is the real data writer (file header's primary
	// source). Runs unconditionally — it is not a "fallback". Each series is a
	// no-key CSV fetch, so a single failure degrades that series only.
	logger.info("[WORLD_BANK] Fetching FRED monthly series");
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

	logger.info(`[WORLD_BANK] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const worldBankScraper: Scraper = {
	name: "world_bank",
	fetch: fetchWorldBankData,
};
