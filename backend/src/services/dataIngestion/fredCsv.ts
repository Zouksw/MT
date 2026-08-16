/**
 * Shared FRED CSV series fetcher (round-105, audit batch 10 leftover).
 *
 * cmeFutures.fetchFredDaily and worldBankPrices.fetchFredMonthly were
 * near-duplicate implementations of the same job — build a fredgraph.csv URL,
 * fetch it, parse date/value rows, upsert flat candles — differing only in
 * window, interval, and log prefix. This module is the single implementation;
 * both sources now declare their series config + window and delegate.
 *
 * Row semantics (deliberately preserved from both originals):
 * - flat candles: open=high=low=close (FRED publishes one value per period;
 *   no intraday OHLC exists to fabricate — round-104 honesty convention)
 * - source "fred" on every row regardless of which scraper pulled it — the
 *   data's true origin (wb mislabeling surfaced FRED rows under the World
 *   Bank Pink Sheet on the data-sources board)
 * - metadata { seriesId, source: "fred_csv", interval }: the fredSeries key
 *   the monthly path used had zero consumers (verified 2026-08-16), so both
 *   paths now write the same shape
 *
 * No internal catch: like both originals, a network failure propagates to the
 * caller's per-series/per-symbol error handling.
 */

import { logger } from "@/lib";
import { ensureCommodity, upsertPrice } from "./helpers";
import { scraperFetch } from "./http";

export interface FredCsvSeriesConfig {
	seriesId: string;
	slug: string;
	name: string;
	category: string;
	unit: string;
}

/**
 * Fetch one FRED series as CSV and upsert it as flat candles.
 * `start` bounds the window (cosd); today is the end (coed).
 */
export async function fetchFredCsvSeries(params: {
	config: FredCsvSeriesConfig;
	start: Date;
	interval: "daily" | "monthly";
	/** Value for the Commodity.metadata.source tag (e.g. "fred", "fred_monthly"). */
	commoditySource: string;
	timeoutMs?: number;
	logPrefix: string;
}): Promise<{ inserted: number; updated: number }> {
	const { config, interval, commoditySource, logPrefix } = params;

	// cosd/coed MUST be dashed ISO (YYYY-MM-DD). formatDateYMD's dashless
	// YYYYMMDD is silently IGNORED by fredgraph.csv, which then returns the
	// FULL series history — cmeFutures shipped that bug for weeks (every 6h
	// run upserted ~13k rows per daily series), and round-105 briefly wrote
	// 4961 unintended (though real) monthly history rows before this fix.
	const isoDay = (d: Date) => d.toISOString().slice(0, 10);
	const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${config.seriesId}&cosd=${isoDay(params.start)}&coed=${isoDay(new Date())}`;

	const res = await scraperFetch(url, {
		headers: { "User-Agent": "MT/1.0" },
		timeoutMs: params.timeoutMs ?? 15000,
	});
	if (!res.ok) {
		logger.warn(`${logPrefix} ${config.seriesId}: HTTP ${res.status}`);
		return { inserted: 0, updated: 0 };
	}

	const text = await res.text();
	const lines = text.trim().split("\n");
	if (lines.length < 2) return { inserted: 0, updated: 0 };

	const commodity = await ensureCommodity({
		slug: config.slug,
		name: config.name,
		category: config.category,
		unit: config.unit,
		metadata: { source: commoditySource, seriesId: config.seriesId },
	});

	let inserted = 0;
	let updated = 0;

	// Skip the header row; each data row is "date,value".
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
			interval,
			open: value,
			high: value,
			low: value,
			close: value,
			volume: null,
			metadata: { seriesId: config.seriesId, source: "fred_csv", interval },
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	return { inserted, updated };
}
