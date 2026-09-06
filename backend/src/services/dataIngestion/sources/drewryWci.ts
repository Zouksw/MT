/**
 * Drewry World Container Index (WCI) — weekly ocean-freight benchmark
 * (round-161 批2; research: TradeSources v2.0.0 §十二, round-160 P2).
 *
 * The free Drewry page publishes the composite index and 8 east-west route
 * spot rates as PLAIN TEXT (verified live 2026-09-07: "$4,465 per 40ft"),
 * updated every Thursday. This source lands the composite as a weekly
 * CommodityPrice series (ocean_freight_wci, USD/40ft) — the freight-context
 * benchmark for the landing-cost tool.
 *
 * 口径 (deliberate): USD per 40ft CONTAINER. It is NOT convertible to USD/kg
 * without a payload-tonnage assumption, which is the user's call — the
 * landing-cost response surfaces it as-is with a per-container note and the
 * freight input stays user-supplied (no fabricated conversion).
 *
 * Contract notes (live-verified):
 *  - The FIRST "$N per 40ft" match on the page is the composite; route
 *    figures follow (Shanghai–LA/NY/Genoa/Rotterdam…).
 *  - The assessment date rides the "Our detailed assessment for Thursday,
 *    DD Mmm YYYY" heading.
 *  - A page reformat that breaks either regex → 0 rows + warning (the honest
 *    silent-failure shape), never a guessed value.
 */

import { logger } from "@/lib";
import { ensureCommodity, upsertPrice } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const URL_ =
	"https://www.drewry.co.uk/maritime-research-opinion-browser/world-container-index-assessed-by-drewry";
const SOURCE_ID = "drewry_wci";

export const WCI_SLUG = "ocean_freight_wci";

const MONTHS: Record<string, number> = {
	Jan: 0,
	Feb: 1,
	Mar: 2,
	Apr: 3,
	May: 4,
	Jun: 5,
	Jul: 6,
	Aug: 7,
	Sep: 8,
	Oct: 9,
	Nov: 10,
	Dec: 11,
};

export interface ParsedWci {
	/** Assessment Thursday, UTC midnight. */
	date: Date;
	/** Composite index, USD per 40ft container. */
	compositeUsd: number;
}

/**
 * Extract { date, composite } from the free WCI page HTML. Pure — the test
 * seam for the first-match-is-composite contract and reformat detection.
 */
export function parseWciPage(html: string): ParsedWci | null {
	const dateMatch = html.match(
		/detailed assessment for [A-Za-z]+, (\d{1,2}) ([A-Za-z]{3}) (\d{4})/,
	);
	const valueMatch = html.match(/\$([\d,]+(?:\.\d+)?) per 40ft/);
	if (!dateMatch || !valueMatch) return null;

	const day = Number(dateMatch[1]);
	const month = MONTHS[dateMatch[2]];
	const year = Number(dateMatch[3]);
	if (!day || month === undefined || !year) return null;

	const compositeUsd = Number(valueMatch[1].replace(/,/g, ""));
	if (!Number.isFinite(compositeUsd) || compositeUsd <= 0) return null;

	const date = new Date(Date.UTC(year, month, day));
	if (Number.isNaN(date.getTime())) return null;
	return { date, compositeUsd };
}

async function fetchDrewryWci(): Promise<ScraperResult> {
	const res = await scraperFetch(URL_, {
		headers: {
			Accept: "text/html",
			"User-Agent": "MT/1.0 (beef price platform data ingestion)",
		},
		timeoutMs: 20_000,
		retries: 2,
	});
	if (!res.ok) {
		logger.warn(`[DREWRY_WCI] page returned HTTP ${res.status}`);
		return { inserted: 0, updated: 0 };
	}

	const html = await res.text();
	const parsed = parseWciPage(html);
	if (!parsed) {
		// 0/0 WITHOUT noChange — a reformat is exactly the "empty, possible
		// silent failure" shape the freshness board should surface.
		logger.warn("[DREWRY_WCI] page parsed no composite value (reformat?)");
		return { inserted: 0, updated: 0 };
	}

	const commodity = await ensureCommodity({
		slug: WCI_SLUG,
		name: "World Container Index (Drewry WCI composite)",
		category: "shipping",
		unit: "USD/40ft",
		metadata: { source: "drewry", basis: "Composite of 8 east-west route spot rates" },
	});

	// Decimal(18,6) scale (commodity_prices OHLC columns) — same rounding
	// contract as fredCsv/comtradeMirror so re-scans no-op.
	const value = Math.round(parsed.compositeUsd * 1e6) / 1e6;
	const r = await upsertPrice({
		commodityId: commodity.id,
		date: parsed.date,
		source: "drewry",
		interval: "weekly",
		open: value,
		high: value,
		low: value,
		close: value,
		volume: null,
		metadata: { source: "drewry_wci", unit: "USD/40ft", assessedAt: parsed.date.toISOString() },
	});

	const noChange = r.inserted === 0 && r.updated === 0;
	logger.info(
		`[DREWRY_WCI] $${value}/40ft (${parsed.date.toISOString().slice(0, 10)}) → ${noChange ? "unchanged" : `${r.inserted} inserted, ${r.updated} updated`}`,
	);
	return noChange ? { inserted: 0, updated: 0, noChange: true } : r;
}

export const drewryWciScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchDrewryWci,
};
