/**
 * FAO Food Price Indices — the official monthly global benchmark family
 * (round-171 批1; recon 2026-09-20 live-probed in
 * docs/RESEARCH-BEEF-TRADE-DATA-SOURCES.md §十 执行记录).
 *
 * Source: FAO "World Food Situation" free CSV — the full index family
 * (Food / Meat / Dairy / Cereals / Oils / Sugar), 2014-2016=100, monthly
 * 1990-01 → t-1. The URL is stable without the CMS `sfvrsn` version token
 * (verified 200 both ways, 48KB). robots: fao.org disallows only CMS paths
 * (/typo3/, /t3lib/, /index.php) — the media/docs path is open.
 *
 * Why this source: the platform's global beef benchmarks were IMF
 * beef_carcass_us (monthly, ~2.5-month lag, 0 verified predictions yet) and
 * nothing else at index level. The FAO Meat Price Index is the standard
 * global meat benchmark published at t-1 freshness (2026-08 point live on
 * 2026-09-20) — it enters the SAME monthly-benchmark family and the monthly
 * prediction gate (latest ≤90d + ≥3 points, ADR-0001 ⑤) automatically.
 *
 * Honesty constraints:
 * - The free file carries the SIX top-level indices ONLY. The bovine
 *   SUB-index exists in FAO's narrative releases but is NOT in this CSV —
 *   we store what the file ships, never derive a sub-index.
 * - Index points (2014-2016=100) are dimensionless: currency stays the
 *   schema default but the unit string states the base — same convention
 *   as pork_world/poultry_world (index 2010=100).
 * - Flat candles: open=high=low=close (one value per month — nothing to
 *   fabricate OHLC from; round-104 convention).
 *
 * Cadence: monthly data on the daily cycle. The CSV is 48KB so the fetch is
 * cheap; the upsert loop is INCREMENTAL — after the first backfill, each
 * daily run re-upserts only a 3-month rolling tail (catches the just
 * -released month plus FAO's routine revisions of recent months); every
 * other row short-circuits in upsertPrice's samePrice no-op → noChange on
 * non-release days (round-149 contract).
 */

import { logger, prisma } from "@/lib";
import { ensureCommodity, upsertPrice } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const CSV_URL =
	"https://www.fao.org/media/docs/worldfoodsituationlibraries/default-document-library/food_price_indices_data.csv";
export const SOURCE_ID = "fao_index";

/** Months of the tail re-upserted per run after the initial backfill:
 * the new month + FAO's revision window for recent months. */
export const TAIL_MONTHS = 3;

export interface FaoIndexSeriesConfig {
	/** Column header in the FAO CSV. */
	column: string;
	slug: string;
	name: string;
	nameCn: string;
	/** Short id for row metadata traceability. */
	seriesId: string;
}

/** The six top-level indices the file ships, in column order. */
export const FAO_INDEX_SERIES: FaoIndexSeriesConfig[] = [
	{
		column: "Food Price Index",
		slug: "fao_food_index",
		name: "FAO Food Price Index",
		nameCn: "FAO 粮食价格指数",
		seriesId: "FPI",
	},
	{
		column: "Meat",
		slug: "fao_meat_index",
		name: "FAO Meat Price Index",
		nameCn: "FAO 肉类价格指数",
		seriesId: "MEAT",
	},
	{
		column: "Dairy",
		slug: "fao_dairy_index",
		name: "FAO Dairy Price Index",
		nameCn: "FAO 乳制品价格指数",
		seriesId: "DAIRY",
	},
	{
		column: "Cereals",
		slug: "fao_cereals_index",
		name: "FAO Cereals Price Index",
		nameCn: "FAO 谷物价格指数",
		seriesId: "CEREALS",
	},
	{
		column: "Oils",
		slug: "fao_oils_index",
		name: "FAO Vegetable Oils Price Index",
		nameCn: "FAO 植物油价格指数",
		seriesId: "OILS",
	},
	{
		column: "Sugar",
		slug: "fao_sugar_index",
		name: "FAO Sugar Price Index",
		nameCn: "FAO 食糖价格指数",
		seriesId: "SUGAR",
	},
];

export interface FaoIndexPoint {
	slug: string;
	/** Month start (UTC midnight). */
	date: Date;
	value: number;
}

/**
 * Parse the FAO indices CSV body. The file has three junk lines before the
 * real header (title, base-period line, blank), so the header is FOUND by
 * its "Date," prefix rather than assumed at a line number. Blank cells
 * (a series not yet published for that month) are skipped, never zero-filled.
 * Pure function — no I/O — so tests feed fixture text directly.
 */
export function parseFaoIndices(text: string): FaoIndexPoint[] {
	const lines = text.split("\n");
	const headerIdx = lines.findIndex((l) => l.startsWith("Date,"));
	if (headerIdx === -1) return [];

	const headers = lines[headerIdx].split(",").map((h) => h.trim());
	const columnSeries = FAO_INDEX_SERIES.map((series) => ({
		series,
		colIdx: headers.indexOf(series.column),
	})).filter((c): c is { series: FaoIndexSeriesConfig; colIdx: number } => c.colIdx !== -1);

	const points: FaoIndexPoint[] = [];
	for (let i = headerIdx + 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!/^\d{4}-\d{2},/.test(line)) continue;
		const cols = line.split(",");
		const ym = cols[0].trim();
		const date = new Date(`${ym}-01T00:00:00Z`);
		if (Number.isNaN(date.getTime())) continue;
		for (const { series, colIdx } of columnSeries) {
			const raw = parseFloat((cols[colIdx] ?? "").trim());
			if (Number.isNaN(raw)) continue; // unpublished cell — skip, don't zero-fill
			// Decimal(18,6) storage contract: round at the parse boundary so a
			// re-scrape of the same CSV is a true samePrice no-op (fredCsv
			// precedent, round-153).
			points.push({ slug: series.slug, date, value: Math.round(raw * 1e6) / 1e6 });
		}
	}
	return points;
}

/**
 * Persist parsed points with an incremental tail window per series: when a
 * series already has rows, only points within TAIL_MONTHS of its stored max
 * are upserted (new releases + revisions); the first run backfills all.
 */
export async function persistFaoIndexPoints(points: FaoIndexPoint[]): Promise<{
	inserted: number;
	updated: number;
	touched: number;
}> {
	let inserted = 0;
	let updated = 0;
	let touched = 0;

	for (const series of FAO_INDEX_SERIES) {
		const seriesPoints = points
			.filter((p) => p.slug === series.slug)
			.sort((a, b) => a.date.getTime() - b.date.getTime());
		if (seriesPoints.length === 0) continue;

		const commodity = await ensureCommodity({
			slug: series.slug,
			name: series.name,
			nameCn: series.nameCn,
			category: "price_index",
			unit: "index (2014-2016=100)",
			metadata: { source: SOURCE_ID, seriesId: series.seriesId, base: "2014-2016=100" },
		});

		const maxStored = await prismaMaxDate(commodity.id);
		let windowStart: Date | null = null;
		if (maxStored) {
			windowStart = new Date(maxStored);
			windowStart.setUTCMonth(windowStart.getUTCMonth() - (TAIL_MONTHS - 1));
		}

		for (const p of seriesPoints) {
			if (windowStart && p.date < windowStart) continue;
			touched++;
			const r = await upsertPrice({
				commodityId: commodity.id,
				date: p.date,
				source: SOURCE_ID,
				interval: "monthly",
				open: p.value,
				high: p.value,
				low: p.value,
				close: p.value,
				metadata: { seriesId: series.seriesId, family: "fao-fpi" },
			});
			inserted += r.inserted;
			updated += r.updated;
		}
	}
	return { inserted, updated, touched };
}

async function prismaMaxDate(commodityId: string): Promise<Date | null> {
	const latest = await prisma.commodityPrice.findFirst({
		where: { commodityId, source: SOURCE_ID, interval: "monthly" },
		orderBy: { date: "desc" },
		select: { date: true },
	});
	return latest?.date ?? null;
}

async function fetchFaoIndices(): Promise<ScraperResult> {
	const res = await scraperFetch(CSV_URL, {
		headers: {
			Accept: "text/csv,*/*",
			// Real-language list: undici's fetch sends `Accept-Language: *` by
			// default and some CMS stacks 500 on it (jwqyp lesson, round-170).
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "MT/1.0 (beef price platform data ingestion)",
		},
		timeoutMs: 20_000,
		retries: 2,
	});
	if (!res.ok) {
		throw new Error(`FAO indices CSV returned HTTP ${res.status}`);
	}

	const text = await res.text();
	const points = parseFaoIndices(text);
	if (points.length === 0) {
		// A 200 with an unparseable body is a format change, not a no-data day —
		// return 0/0 WITHOUT noChange so the classifier marks it warning.
		return { inserted: 0, updated: 0 };
	}

	const { inserted, updated, touched } = await persistFaoIndexPoints(points);
	logger.info(
		`[FAO_INDEX] ${points.length} parsed / ${touched} in window → ${inserted} inserted, ${updated} updated`,
	);
	return inserted + updated === 0 ? { inserted, updated, noChange: true } : { inserted, updated };
}

export const faoIndexScraper: Scraper = {
	name: "fao_index",
	fetch: fetchFaoIndices,
};
