/**
 * Commodity Futures & Daily Prices via FRED + Stooq
 *
 * Primary: FRED public CSV (no API key needed for daily crude oil, natural gas,
 *          beef carcass, and exchange rates)
 * Fallback: Stooq.com CSV for CME futures (may be blocked by Cloudflare)
 *
 * Covers: Live Cattle, Feeder Cattle, Lean Hogs, Corn, Soybeans, Wheat,
 * Soybean Meal, Soybean Oil, Coffee, Sugar, Cotton, Crude Oil, Natural Gas, Gold,
 * US Beef Carcass Price, USD/CNY, BRL/USD, AUD/USD, EUR/USD.
 */

import { logger } from "@/lib";
import { ensureCommodity, formatDateYMD, upsertPrice } from "../helpers";
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
		 * Multiplier applied to Stooq's raw quote before writing, to convert
		 * from the exchange's native quote unit into the `unit` declared above.
		 *
		 * Stooq returns CME futures in their native trading units:
		 *   - grains (ZC/ZS/ZW): cents/bu       → USD/bu      needs /100 → 0.01
		 *   - livestock (LE/GF/HE): cents/cwt   → USD/cwt     needs /100 → 0.01
		 *   - softs (KC/SB/CT) + soybean oil (ZL): cents/lb   → USD/lb      needs /100 → 0.01
		 *   - soybean meal (ZM): USD/ton (already USD)                     → 1
		 *   - energy/metals (CL/NG/GC): already USD                        → 1
		 *
		 * Default 1 (no conversion). The cent-quoted contracts get 0.01.
		 * Without this, corn_cme stored 473 (cents) next to USDA's 4.5 (USD)
		 * → 100× unit conflict (docs/KNOWN-ISSUES.md R2).
		 */
		priceFactor?: number;
	}
> = {
	LE: {
		ticker: "le.f",
		slug: "live_cattle_cme",
		name: "Live Cattle Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
		priceFactor: 0.01,
	},
	GF: {
		ticker: "gf.f",
		slug: "feeder_cattle_cme",
		name: "Feeder Cattle Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
		priceFactor: 0.01,
	},
	HE: {
		ticker: "he.f",
		slug: "lean_hogs_cme",
		name: "Lean Hogs Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
		priceFactor: 0.01,
	},
	ZC: {
		ticker: "zc.f",
		slug: "corn_cme",
		name: "Corn Futures (CME)",
		category: "futures",
		unit: "USD/bu",
		priceFactor: 0.01,
	},
	ZS: {
		ticker: "zs.f",
		slug: "soybeans_cme",
		name: "Soybean Futures (CME)",
		category: "futures",
		unit: "USD/bu",
		priceFactor: 0.01,
	},
	ZW: {
		ticker: "zw.f",
		slug: "wheat_cme",
		name: "Wheat Futures (CME)",
		category: "futures",
		unit: "USD/bu",
		priceFactor: 0.01,
	},
	ZM: {
		ticker: "zm.f",
		slug: "soybean_meal_cme",
		name: "Soybean Meal Futures (CME)",
		category: "futures",
		unit: "USD/ton",
	},
	ZL: {
		ticker: "zl.f",
		slug: "soybean_oil_cme",
		name: "Soybean Oil Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	KC: {
		ticker: "kc.f",
		slug: "coffee_cme",
		name: "Coffee Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	SB: {
		ticker: "sb.f",
		slug: "sugar11_cme",
		name: "Sugar #11 Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	CT: {
		ticker: "ct.f",
		slug: "cotton2_cme",
		name: "Cotton #2 Futures (CME)",
		category: "futures",
		unit: "USD/lb",
		priceFactor: 0.01,
	},
	CL: {
		ticker: "cl.f",
		slug: "crude_oil_cme",
		name: "Crude Oil Futures (CME)",
		category: "futures",
		unit: "USD/bbl",
	},
	NG: {
		ticker: "ng.f",
		slug: "natural_gas_cme",
		name: "Natural Gas Futures (CME)",
		category: "futures",
		unit: "USD/MMBtu",
	},
	GC: {
		ticker: "gc.f",
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
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - 7);

	const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${config.seriesId}&cosd=${formatDateYMD(start)}&coed=${formatDateYMD(end)}`;

	const res = await fetch(url, {
		headers: { "User-Agent": "MT/1.0" },
		signal: AbortSignal.timeout(10000),
	});
	if (!res.ok) {
		logger.warn(`[CME/FRED] ${config.seriesId}: HTTP ${res.status}`);
		return { inserted: 0, updated: 0 };
	}

	const text = await res.text();
	const lines = text.trim().split("\n");
	if (lines.length < 2) return { inserted: 0, updated: 0 };

	// Skip header, parse CSV rows
	let inserted = 0;
	let updated = 0;

	const commodity = await ensureCommodity({
		slug: config.slug,
		name: config.name,
		category: config.category,
		unit: config.unit,
		metadata: { source: "fred", seriesId: config.seriesId },
	});

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
			source: "fred",
			open: value,
			high: value,
			low: value,
			close: value,
			volume: null,
			metadata: { seriesId: config.seriesId, source: "fred_csv" },
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	return { inserted, updated };
}

async function fetchStooqBar(ticker: string): Promise<{
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number | null;
} | null> {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - 7);

	const url = `https://stooq.com/q/l/?s=${encodeURIComponent(ticker)}&d1=${formatDateYMD(start)}&d2=${formatDateYMD(end)}&i=d`;
	const res = await fetch(url, {
		headers: {
			Accept: "text/csv",
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
		},
		signal: AbortSignal.timeout(10000),
	});
	if (!res.ok) return null;

	const lines = (await res.text()).trim().split("\n");
	if (lines.length < 2) return null;

	const cols = lines[lines.length - 1].split(",");
	if (cols.length < 7) return null;

	const close = parseFloat(cols[6]?.trim() ?? "");
	if (Number.isNaN(close)) return null;

	const ds = cols[1]?.trim() ?? "";
	const date = new Date(
		`${ds.substring(0, 4)}-${ds.substring(4, 6)}-${ds.substring(6, 8)}T00:00:00Z`,
	);
	const open = parseFloat(cols[3]?.trim() ?? "");
	const high = parseFloat(cols[4]?.trim() ?? "");
	const low = parseFloat(cols[5]?.trim() ?? "");
	const vol = parseFloat(cols[7]?.trim() ?? "");

	return {
		date,
		open: Number.isNaN(open) ? close : open,
		high: Number.isNaN(high) ? close : high,
		low: Number.isNaN(low) ? close : low,
		close,
		volume: Number.isNaN(vol) ? null : vol,
	};
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

	// Phase 2: Try Stooq for remaining CME futures (may be Cloudflare-blocked)
	for (const [symbol, cfg] of Object.entries(FUTURES)) {
		// Skip commodities already covered by FRED
		if (symbol in FRED_DAILY) continue;

		try {
			const bar = await fetchStooqBar(cfg.ticker);
			if (!bar) {
				logger.debug(`[CME/Stooq] ${cfg.ticker}: no data`);
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

			// Convert Stooq's native quote (cents for grains/livestock/softs)
			// into the declared USD unit. priceFactor defaults to 1 (no-op) for
			// energy/metals/soybean-meal which Stooq already returns in USD.
			// See the FUTURES table docstring for the per-contract rationale.
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
				metadata: { productSymbol: symbol, stooqTicker: cfg.ticker },
			});
			inserted += r.inserted;
			updated += r.updated;
		} catch (err) {
			logger.debug(`[CME/Stooq] ${cfg.ticker} failed: ${err instanceof Error ? err.message : err}`);
		}
	}

	logger.info(`[CME] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const cmeFuturesScraper: Scraper = { name: "cme_futures", fetch: fetchCMEFutures };
