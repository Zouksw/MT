/**
 * FRED (Federal Reserve Economic Data) Integration
 *
 * Economic indicators and commodity indices from the St. Louis Fed.
 * API: https://api.stlouisfed.org/fred/series/observations
 * Free with API key (register at https://fred.stlouisfed.org/docs/api/api_key.html)
 *
 * Covers: CPI, PPI, interest rates, commodity indices, USD index
 */

import { logger } from "@/lib";
import { upsertFactor } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

// FRED series IDs mapped to our system
const FRED_SERIES: Record<
	string,
	{
		name: string;
		frequency: "daily" | "weekly" | "monthly";
		unit: string;
	}
> = {
	// Commodity indices
	PALLFNFINDEX: {
		name: "Global Price Index of All Commodities",
		frequency: "monthly",
		unit: "index",
	},
	PCOPPUSD: {
		name: "Global Copper Price",
		frequency: "monthly",
		unit: "USD/ton",
	},
	PSOYBUSDM: {
		name: "Global Soybeans Price",
		frequency: "monthly",
		unit: "USD/ton",
	},
	PWHEAMTUSD: {
		name: "Global Wheat Price",
		frequency: "monthly",
		unit: "USD/ton",
	},
	PCOTTIND: {
		name: "Global Cotton Price",
		frequency: "monthly",
		unit: "USD/kg",
	},
	PSUGAUSA: { name: "US Sugar Price", frequency: "monthly", unit: "USD/kg" },

	// Economic indicators
	CPIAUCSL: {
		name: "Consumer Price Index (CPI)",
		frequency: "monthly",
		unit: "index",
	},
	PPIACO: {
		name: "Producer Price Index (PPI)",
		frequency: "monthly",
		unit: "index",
	},
	DCOILWTICO: { name: "Crude Oil WTI", frequency: "daily", unit: "USD/bbl" },
	DCOILBRENTEU: {
		name: "Crude Oil Brent",
		frequency: "daily",
		unit: "USD/bbl",
	},
	DEXUSEU: {
		name: "USD/EUR Exchange Rate",
		frequency: "daily",
		unit: "EUR/USD",
	},
	DEXCHUS: {
		name: "CNY/USD Exchange Rate",
		frequency: "daily",
		unit: "CNY/USD",
	},
	DEXBZUS: {
		name: "BRL/USD Exchange Rate",
		frequency: "daily",
		unit: "BRL/USD",
	},
	T10Y2Y: {
		name: "10Y-2Y Treasury Spread",
		frequency: "daily",
		unit: "percent",
	},
	FEDFUNDS: {
		name: "Federal Funds Rate",
		frequency: "monthly",
		unit: "percent",
	},

	// Shipping
	BALTIC_DRY: { name: "Baltic Dry Index", frequency: "daily", unit: "index" },
};

interface FREDObservation {
	realtime_start: string;
	realtime_end: string;
	date: string; // YYYY-MM-DD
	value: string; // can be "." for missing
}

async function fetchFREDData(): Promise<ScraperResult> {
	const apiKey = process.env.FRED_API_KEY;
	if (!apiKey) {
		logger.warn("[FRED] No FRED_API_KEY configured, skipping");
		return { inserted: 0, updated: 0 };
	}

	let inserted = 0;
	let updated = 0;

	for (const [seriesId, config] of Object.entries(FRED_SERIES)) {
		try {
			// Fetch last 2 years of data
			const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&observation_start=2024-01-01&sort_order=desc&file_type=json`;

			const res = await fetch(url, {
				signal: AbortSignal.timeout(15000),
			});

			if (!res.ok) {
				logger.warn(`[FRED] Series ${seriesId} returned ${res.status}`);
				continue;
			}

			const data = (await res.json()) as { observations: FREDObservation[] };
			const observations = data.observations?.filter((o) => o.value !== ".") ?? [];
			if (observations.length === 0) continue;

			// Store last 12 observations per series
			const recent = observations.slice(0, 12);

			for (const obs of recent) {
				const value = parseFloat(obs.value);
				if (Number.isNaN(value)) continue;

				const date = new Date(`${obs.date}T00:00:00Z`);
				if (Number.isNaN(date.getTime())) continue;

				const region = seriesId.includes("DEX") || seriesId.includes("BALTIC") ? "global" : "US";

				const result = await upsertFactor({
					type: "economic",
					region,
					date,
					value,
					unit: config.unit,
					source: "fred",
					metadata: {
						seriesId,
						name: config.name,
						frequency: config.frequency,
						observationDate: obs.date,
					},
				});
				inserted += result.inserted;
				updated += result.updated;
			}
		} catch (err) {
			logger.warn(`[FRED] ${seriesId} failed: ${err instanceof Error ? err.message : err}`);
		}
	}

	logger.info(`[FRED] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const fredScraper: Scraper = {
	name: "fred",
	fetch: fetchFREDData,
};
