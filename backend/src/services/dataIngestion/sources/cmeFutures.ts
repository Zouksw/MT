/**
 * Commodity Futures & Daily Prices via FRED + Yahoo Finance
 *
 * Primary: FRED public CSV (no API key needed for daily crude oil, natural gas,
 *          beef carcass, and exchange rates)
 * Futures: Yahoo Finance v8 chart API for CME front-month futures.
 *
 * History: the original Stooq CSV source died 2026-05 — Stooq removed the
 * `/q/l/` endpoint (404) and put a JavaScript proof-of-work challenge on
 * `/q/d/l/` (unsolvable by plain fetch). Yahoo's chart endpoint is keyless,
 * JSON, and returns the same native CME quote units.
 *
 * Covers: Live Cattle, Feeder Cattle, Lean Hogs, Corn, Soybeans, Wheat,
 * Soybean Meal, Soybean Oil, Coffee, Sugar, Cotton, Crude Oil, Natural Gas, Gold,
 * US Beef Carcass Price, USD/CNY, BRL/USD, AUD/USD, EUR/USD.
 */

import { logger } from "@/lib";
import { fetchFredCsvSeries } from "../fredCsv";
import { ensureCommodity, upsertPrice } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

export const FUTURES: Record<
	string,
	{
		ticker: string;
		slug: string;
		name: string;
		category: string;
		unit: string;
		/**
		 * Multiplier applied to Yahoo's raw quote before writing, to convert
		 * from the exchange's native quote unit into the `unit` declared above.
		 *
		 * Yahoo returns CME futures in their native trading units:
		 *   - grains (ZC/ZS/ZW): cents/bu → USD/bu  needs /100 → 0.01
		 *   - softs (KC/SB/CT) + soybean oil (ZL): cents/lb → USD/lb  needs /100 → 0.01
		 *   - livestock (LE/GF/HE): quoted cents/lb, declared USD/cwt —
		 *     numerically equal (220.3 cents/lb = $220.3/cwt, 100 lb/cwt)
		 *     → 1. NOTE: round-56 wrongly gave these 0.01 (would store $2.2/cwt);
		 *     never exposed because Stooq died before the fix ever ran.
		 *   - soybean meal (ZM): USD/ton (already USD) → 1
		 *   - energy/metals (CL/NG/GC): already USD → 1
		 *
		 * Default 1 (no conversion). Only cent-quoted contracts whose declared
		 * unit is per the same cent-unit get 0.01.
		 * Without this, corn_cme stored 473 (cents) next to USDA's 4.5 (USD)
		 * → 100× unit conflict (docs/KNOWN-ISSUES.md R2).
		 */
		priceFactor?: number;
	}
> = {
	LE: {
		ticker: "LE=F",
		slug: "live_cattle_cme",
		name: "Live Cattle Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
	},
	GF: {
		ticker: "GF=F",
		slug: "feeder_cattle_cme",
		name: "Feeder Cattle Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
	},
	HE: {
		ticker: "HE=F",
		slug: "lean_hogs_cme",
		name: "Lean Hogs Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
	},
	ZC: {
		ticker: "ZC=F",
		slug: "corn_cme",
		name: "Corn Futures (CME)",
		category: "futures",
		unit: "USD/bu",
		priceFactor: 0.01,
	},
	ZS: {
		ticker: "ZS=F",
		slug: "soybeans_cme",
		name: "Soybean Futures (CME)",
		category: "futures",
		unit: "USD/bu",
		priceFactor: 0.01,
	},
	ZW: {
		ticker: "ZW=F",
		slug: "wheat_cme",
		name: "Wheat Futures (CME)",
		category: "futures",
		unit: "USD/bu",
		priceFactor: 0.01,
	},
	ZM: {
		ticker: "ZM=F",
		slug: "soybean_meal_cme",
		name: "Soybean Meal Futures (CME)",
		category: "futures",
		unit: "USD/ton",
	},
	ZL: {
		ticker: "ZL=F",
		slug: "soybean_oil_cme",
		name: "Soybean Oil Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	KC: {
		ticker: "KC=F",
		slug: "coffee_cme",
		name: "Coffee Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	SB: {
		ticker: "SB=F",
		slug: "sugar11_cme",
		name: "Sugar #11 Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	CT: {
		ticker: "CT=F",
		slug: "cotton2_cme",
		name: "Cotton #2 Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	CL: {
		ticker: "CL=F",
		slug: "crude_oil_cme",
		name: "Crude Oil Futures (CME)",
		category: "futures",
		unit: "USD/bbl",
	},
	NG: {
		ticker: "NG=F",
		slug: "natural_gas_cme",
		name: "Natural Gas Futures (CME)",
		category: "futures",
		unit: "USD/MMBtu",
	},
	GC: {
		ticker: "GC=F",
		slug: "gold_cme",
		name: "Gold Futures (CME)",
		category: "futures",
		unit: "USD/troy oz",
	},
};

/** FRED series IDs that provide daily data via public CSV download (no API key) */
const FRED_DAILY: Record<
	string,
	{ seriesId: string; slug: string; name: string; category: string; unit: string }
> = {
	CL: {
		seriesId: "DCOILWTICO",
		slug: "crude_oil_cme",
		name: "Crude Oil WTI (FRED)",
		category: "energy",
		unit: "USD/bbl",
	},
	NG: {
		seriesId: "DHHNGSP",
		slug: "natural_gas_cme",
		name: "Natural Gas Henry Hub (FRED)",
		category: "energy",
		unit: "USD/MMBtu",
	},
	// Beef carcass price (daily, USDA-reported via FRED)
	BEEF: {
		seriesId: "CBBTCUSD",
		slug: "beef_carcass_us",
		name: "US Beef Carcass Price (FRED)",
		category: "beef_cuts",
		unit: "USD/cwt",
	},
	// Exchange rates (daily, FRED DEX series — no API key needed)
	USDCNY: {
		seriesId: "DEXCHUS",
		slug: "usd_cny",
		name: "USD/CNY Exchange Rate (FRED)",
		category: "forex",
		unit: "CNY/USD",
	},
	BRLUSD: {
		seriesId: "DEXBZUS",
		slug: "brl_usd",
		name: "BRL/USD Exchange Rate (FRED)",
		category: "forex",
		unit: "BRL/USD",
	},
	AUDUSD: {
		seriesId: "DEXUSAL",
		slug: "aud_usd",
		name: "AUD/USD Exchange Rate (FRED)",
		category: "forex",
		unit: "AUD/USD",
	},
	EURUSD: {
		seriesId: "DEXUSEU",
		slug: "eur_usd",
		name: "EUR/USD Exchange Rate (FRED)",
		category: "forex",
		unit: "EUR/USD",
	},
};

async function fetchFredDaily(
	config: (typeof FRED_DAILY)[string],
): Promise<{ inserted: number; updated: number }> {
	const start = new Date();
	start.setDate(start.getDate() - 7);
	// Shared FRED CSV implementation (round-105) — this used to be a private
	// near-duplicate of worldBankPrices.fetchFredMonthly.
	return fetchFredCsvSeries({
		config,
		start,
		interval: "daily",
		commoditySource: "fred",
		timeoutMs: 10000,
		logPrefix: "[CME/FRED]",
	});
}

/** Minimal shape of Yahoo's v8 chart response (daily bars). */
interface YahooChartResponse {
	chart?: {
		result?: Array<{
			timestamp?: number[];
			indicators?: {
				quote?: Array<{
					open?: Array<number | null>;
					high?: Array<number | null>;
					low?: Array<number | null>;
					close?: Array<number | null>;
					volume?: Array<number | null>;
				}>;
			};
		}>;
	};
}

/** Minimal structural type both native fetch and undici fetch responses satisfy. */
interface ChartResponse {
	ok: boolean;
	json(): Promise<unknown>;
}

/**
 * Yahoo fetcher — routed through the shared client with opt-in proxy
 * (round-105). Yahoo's edge is IP-blocked from this host (direct connect
 * ETIMEDOUTs; via the local mihomo proxy it returns 200 — verified
 * 2026-08-14), so production sets SCRAPER_PROXY_URL and scraperFetch
 * dispatches through a cached undici ProxyAgent; unset means direct (dev).
 */
function fetchYahooChart(url: string): Promise<ChartResponse> {
	return scraperFetch(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
		},
		timeoutMs: 10000,
		viaProxy: true,
	}) as unknown as Promise<ChartResponse>;
}

/**
 * Latest completed daily bar for a Yahoo Finance symbol (e.g. "LE=F").
 *
 * Walks back past today's intraday row (its OHLC is null until the session
 * closes) to the most recent bar with a real close.
 */
async function fetchYahooBar(symbol: string): Promise<{
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number | null;
} | null> {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

	const res = await fetchYahooChart(url);
	if (!res.ok) return null;

	const data = (await res.json()) as YahooChartResponse;
	const result = data.chart?.result?.[0];
	const timestamps = result?.timestamp;
	const quote = result?.indicators?.quote?.[0];
	if (!timestamps || !quote?.close) return null;

	for (let i = timestamps.length - 1; i >= 0; i--) {
		const close = quote.close[i];
		if (close == null) continue;

		return {
			date: new Date(timestamps[i] * 1000),
			open: quote.open?.[i] ?? close,
			high: quote.high?.[i] ?? close,
			low: quote.low?.[i] ?? close,
			close,
			volume: quote.volume?.[i] ?? null,
		};
	}
	return null;
}

async function fetchCMEFutures(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	// Phase 1: Fetch daily data from FRED (reliable, no API key)
	for (const [, config] of Object.entries(FRED_DAILY)) {
		try {
			const r = await fetchFredDaily(config);
			inserted += r.inserted;
			updated += r.updated;
		} catch (err) {
			logger.warn(
				`[CME/FRED] ${config.seriesId} failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	// Phase 2: Yahoo Finance for the remaining CME futures (keyless JSON).
	// Stooq died 2026-05: /q/l/ removed (404) and /q/d/l/ sits behind a
	// JavaScript proof-of-work challenge plain fetch cannot pass.
	for (const [symbol, cfg] of Object.entries(FUTURES)) {
		// Skip commodities already covered by FRED
		if (symbol in FRED_DAILY) continue;

		try {
			const bar = await fetchYahooBar(cfg.ticker);
			if (!bar) {
				logger.debug(`[CME/Yahoo] ${cfg.ticker}: no data`);
				continue;
			}

			bar.date.setHours(0, 0, 0, 0);
			const commodity = await ensureCommodity({
				slug: cfg.slug,
				name: cfg.name,
				category: cfg.category,
				unit: cfg.unit,
				metadata: { source: "cme", productSymbol: symbol },
			});

			// Convert Yahoo's native quote (cents for grains/softs) into the
			// declared USD unit. priceFactor defaults to 1 (no-op) for
			// livestock/energy/metals/soybean-meal. See the FUTURES table
			// docstring for the per-contract rationale.
			const f = cfg.priceFactor ?? 1;
			const r = await upsertPrice({
				commodityId: commodity.id,
				date: bar.date,
				source: "cme",
				open: bar.open * f,
				high: bar.high * f,
				low: bar.low * f,
				close: bar.close * f,
				volume: bar.volume,
				metadata: { productSymbol: symbol, yahooSymbol: cfg.ticker },
			});
			inserted += r.inserted;
			updated += r.updated;
		} catch (err) {
			logger.debug(`[CME/Yahoo] ${cfg.ticker} failed: ${err instanceof Error ? err.message : err}`);
		}
	}

	logger.info(`[CME] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const cmeFuturesScraper: Scraper = { name: "cme_futures", fetch: fetchCMEFutures };
