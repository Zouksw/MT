/**
 * FRED (Federal Reserve Economic Data) Integration
 *
 * Economic indicators and commodity indices from the St. Louis Fed.
 * Primary: JSON API (free with API key, register at
 * https://fred.stlouisfed.org/docs/api/api_key.html)
 * Fallback: keyless fredgraph.csv download (round-153) — the source stays
 * alive without a key; the key, when present, upgrades to the official API.
 *
 * Covers: CPI, PPI, interest rates, commodity indices, USD index
 */

import { logger } from "@/lib";
import { upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
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
	// Commodity indices. Series ids corrected round-153: four legacy ids were
	// truncated variants (PCOPPUSD/PWHEAMTUSD/PCOTTIND/PSUGAUSA) that 404 on
	// every fetch — invisible while the source was key-gated, surfaced by the
	// keyless CSV fallback's first live run. All ids verified live on
	// fredgraph.csv 2026-08-31.
	PALLFNFINDEXM: {
		name: "Global Price Index of All Commodities",
		frequency: "monthly",
		unit: "index",
	},
	PCOPPUSDM: {
		name: "Global Copper Price",
		frequency: "monthly",
		unit: "USD/ton",
	},
	PSOYBUSDM: {
		name: "Global Soybeans Price",
		frequency: "monthly",
		unit: "USD/ton",
	},
	PWHEAMTUSDM: {
		name: "Global Wheat Price",
		frequency: "monthly",
		unit: "USD/ton",
	},
	PCOTTINDUSDM: {
		name: "Global Cotton Price",
		frequency: "monthly",
		unit: "USD/kg",
	},
	// Same Pink Sheet series worldBankPrices ingests into commodity_prices —
	// sugar quotes in cents/kg there; keep the identical dimension here.
	PSUGAISAUSDM: { name: "Global Sugar Price", frequency: "monthly", unit: "cents/kg" },

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

	// No BALTIC_DRY entry: it is not a FRED series (fredgraph.csv 404s it —
	// verified 2026-08-31) and the dedicated baltic_dry source owns the BDI.
};

interface FREDObservation {
	realtime_start: string;
	realtime_end: string;
	date: string; // YYYY-MM-DD
	value: string; // can be "." for missing
}

/**
 * Keyless observations via the public fredgraph.csv download (the same
 * endpoint fredCsv.ts uses). The JSON API needs a key this deployment does
 * not have, which previously hard-skipped the source every cycle
 * ("Missing FRED_API_KEY" error rows ~30/36h, ingestion_logs 2026-08-31).
 *
 * cosd cannot be trusted to bound every series (FEDFUNDS ignores it and
 * returns full history — observed 2026-08-31), so the caller's last-12 slice
 * is the real observation cap.
 */
async function fetchCsvObservations(seriesId: string): Promise<FREDObservation[]> {
	const isoDay = (d: Date) => d.toISOString().slice(0, 10);
	const start = new Date();
	start.setUTCDate(start.getUTCDate() - 60); // generous for daily series; slice caps anyway
	const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${isoDay(start)}&coed=${isoDay(new Date())}`;

	const res = await scraperFetch(url, {
		headers: { "User-Agent": "MT/1.0" },
		timeoutMs: 15000,
	});
	if (!res.ok) {
		logger.warn(`[FRED] Series ${seriesId} CSV returned ${res.status}`);
		return [];
	}
	const text = await res.text();
	if (text.trimStart().startsWith("<")) {
		// A series absent on fredgraph.csv renders an HTML page (BALTIC_DRY,
		// observed 2026-08-31) — never parse markup as data.
		logger.warn(`[FRED] Series ${seriesId} CSV returned HTML, not CSV`);
		return [];
	}

	const rows: FREDObservation[] = [];
	const lines = text.trim().split("\n");
	// Skip the header row; each data row is "date,value".
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(",");
		if (cols.length < 2) continue;
		const dateStr = cols[0].trim();
		const value = parseFloat(cols[1].trim());
		if (Number.isNaN(value) || !dateStr) continue; // "." missing → NaN
		rows.push({ realtime_start: "", realtime_end: "", date: dateStr, value: String(value) });
	}
	return rows;
}

async function fetchFREDData(): Promise<ScraperResult> {
	const apiKey = process.env.FRED_API_KEY;
	if (!apiKey) {
		logger.info("[FRED] No FRED_API_KEY — using keyless fredgraph.csv fallback");
	}

	let inserted = 0;
	let updated = 0;
	let seen = 0;

	for (const [seriesId, config] of Object.entries(FRED_SERIES)) {
		try {
			let observations: FREDObservation[];
			if (apiKey) {
				// Fetch last 2 years of data
				const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&observation_start=2024-01-01&sort_order=desc&file_type=json`;

				const res = await scraperFetch(url, { timeoutMs: 15000 });

				if (!res.ok) {
					logger.warn(`[FRED] Series ${seriesId} returned ${res.status}`);
					continue;
				}

				const data = (await res.json()) as { observations: FREDObservation[] };
				observations = data.observations?.filter((o) => o.value !== ".") ?? [];
			} else {
				observations = await fetchCsvObservations(seriesId);
			}
			if (observations.length === 0) continue;

			// Store last 12 observations per series. API rows arrive newest-first
			// (sort_order=desc → first 12); CSV rows arrive oldest-first (last 12).
			const recent = apiKey ? observations.slice(0, 12) : observations.slice(-12);

			for (const obs of recent) {
				// MarketFactor.value is Decimal(18,6): round at the boundary so a
				// re-scrape of the same observation is a true no-op (upsertFactor's
				// sameFactor compares raw floats — same phantom-update class fixed
				// this round in fredCsv.ts).
				const value = Math.round(parseFloat(obs.value) * 1e6) / 1e6;
				if (Number.isNaN(value)) continue;

				const date = new Date(`${obs.date}T00:00:00Z`);
				if (Number.isNaN(date.getTime())) continue;

				seen++;

				const region = seriesId.includes("DEX") || seriesId.includes("BALTIC") ? "global" : "US";

				const result = await upsertFactor({
					type: "economic",
					region,
					date,
					value,
					unit: config.unit,
					source: "fred",
					// 15 series share type "economic" + region "US"/"global" —
					// without the series key they overwrote each other per date.
					seriesKey: seriesId,
					metadata: {
						seriesId,
						name: config.name,
						frequency: config.frequency,
						observationDate: obs.date,
						fetchPath: apiKey ? "api" : "csv",
					},
				});
				inserted += result.inserted;
				updated += result.updated;
			}
		} catch (err) {
			logger.warn(`[FRED] ${seriesId} failed: ${err instanceof Error ? err.message : err}`);
		}
	}

	// noChange: monthly series re-scanned on the daily cycle legitimately write
	// 0/0 with data in hand — a confirmed-unchanged cycle, not a silent failure.
	const noChange = seen > 0 && inserted === 0 && updated === 0;
	logger.info(`[FRED] ${inserted} inserted, ${updated} updated${noChange ? " (unchanged)" : ""}`);
	return { inserted, updated, ...(noChange ? { noChange: true } : {}) };
}

export const fredScraper: Scraper = {
	name: "fred",
	fetch: fetchFREDData,
	// No requiresKey: the keyless fredgraph.csv fallback keeps this source
	// alive without FRED_API_KEY (round-153); the key upgrades to the JSON API.
};
