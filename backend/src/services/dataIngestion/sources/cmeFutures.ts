/**
 * Commodity Futures via Stooq (Free CSV API)
 *
 * Uses stooq.com free CSV endpoint — no API key required.
 * Covers: Live Cattle, Feeder Cattle, Lean Hogs, Corn, Soybeans, Wheat,
 * Soybean Meal, Soybean Oil, Coffee, Sugar, Cotton, Crude Oil, Natural Gas, Gold.
 */

import { logger } from "@/lib";
import { ensureCommodity, formatDateYMD, upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const FUTURES: Record<
	string,
	{ ticker: string; slug: string; name: string; category: string; unit: string }
> = {
	LE: {
		ticker: "le.f",
		slug: "live_cattle_cme",
		name: "Live Cattle Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
	},
	GF: {
		ticker: "gf.f",
		slug: "feeder_cattle_cme",
		name: "Feeder Cattle Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
	},
	HE: {
		ticker: "he.f",
		slug: "lean_hogs_cme",
		name: "Lean Hogs Futures (CME)",
		category: "futures",
		unit: "USD/cwt",
	},
	ZC: {
		ticker: "zc.f",
		slug: "corn_cme",
		name: "Corn Futures (CME)",
		category: "futures",
		unit: "USD/bu",
	},
	ZS: {
		ticker: "zs.f",
		slug: "soybeans_cme",
		name: "Soybean Futures (CME)",
		category: "futures",
		unit: "USD/bu",
	},
	ZW: {
		ticker: "zw.f",
		slug: "wheat_cme",
		name: "Wheat Futures (CME)",
		category: "futures",
		unit: "USD/bu",
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
	},
	KC: {
		ticker: "kc.f",
		slug: "coffee_cme",
		name: "Coffee Futures (CME)",
		category: "futures",
		unit: "USD/lb",
	},
	SB: {
		ticker: "sb.f",
		slug: "sugar11_cme",
		name: "Sugar #11 Futures (CME)",
		category: "futures",
		unit: "USD/lb",
	},
	CT: {
		ticker: "ct.f",
		slug: "cotton2_cme",
		name: "Cotton #2 Futures (CME)",
		category: "futures",
		unit: "USD/lb",
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
	if (lines.length < 1) return null;

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

	for (const [symbol, cfg] of Object.entries(FUTURES)) {
		try {
			const bar = await fetchStooqBar(cfg.ticker);
			if (!bar) {
				logger.warn(`[CME] ${cfg.ticker}: no data`);
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

			const r = await upsertPrice({
				commodityId: commodity.id,
				date: bar.date,
				source: "cme",
				open: bar.open,
				high: bar.high,
				low: bar.low,
				close: bar.close,
				volume: bar.volume,
				metadata: { productSymbol: symbol, stooqTicker: cfg.ticker },
			});
			inserted += r.inserted;
			updated += r.updated;
		} catch (err) {
			logger.warn(`[CME] ${cfg.ticker} failed: ${err instanceof Error ? err.message : err}`);
		}
	}

	logger.info(`[CME] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const cmeFuturesScraper: Scraper = { name: "cme_futures", fetch: fetchCMEFutures };
