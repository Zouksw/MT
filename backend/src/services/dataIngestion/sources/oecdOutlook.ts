/**
 * OECD-FAO Agricultural Outlook — bovine meat balance sheet + 10-year
 * projections (round-171 批2; recon in
 * docs/RESEARCH-BEEF-TRADE-DATA-SOURCES.md §十 执行记录).
 *
 * Source: the OECD SDMX CSV export of the Outlook dataflow
 * (sdmx.oecd.org — robots: no robots.txt, public data API). The dataflow id
 * is PINNED to the 2026-2035 edition: when OECD publishes the next edition
 * the id changes and this URL keeps serving the old (or dies) — bumping it
 * is a conscious maintenance step, not an accident to silently absorb.
 *
 * Why this source: it is the platform's first SUPPLY-DEMAND and PROJECTION
 * dataset — annual production/consumption/imports/exports per beef country
 * 1990→2035, i.e. ten years of official projected balance-sheet context on
 * top of measured history. Everything else in the platform is measured
 * prices/flows; this adds the structural outlook layer.
 *
 * Server-side filtering: the SDMX CSV endpoint 404s on c[COMMODITY] filters
 * (verified live 2026-09-20 and in the research doc) and ignores c[REF_AREA],
 * so the FULL file (~237MB, ~774k rows) is downloaded and filtered locally to
 * the bovine subset (~27k rows → ~1.5k stored). The body is STREAMED through
 * Response.body so the process never holds the whole file in memory.
 *
 * Unit honesty (live-calibrated 2026-09-20): bovine QP/QC/IM/EX values carry
 * UNIT_MEASURE=T with UNIT_MULT=3 — i.e. thousands of tonnes (CHN QP 2024
 * 7791 = 7.79 Mt ✓, BRA EX 2024 3779 = 3.78 Mt ✓). Stored unit string states
 * this explicitly. Producer prices (PP, local currency XDC_T) and the
 * scattered WP world-price rows (46 rows, no usable shape) are deliberately
 * NOT landed: currency/unit handling would be guesswork.
 *
 * Projection honesty: rows with TIME_PERIOD beyond the current calendar year
 * are OECD PROJECTIONS, stored with metadata.projection=true — never mixed
 * into anything that reads as measured data.
 *
 * Cadence: an edition is revised at most quarterly; the scan runs on the
 * daily cycle behind a 7-day in-source gate keyed on the source's own last
 * SUCCESS ingestionLog row (a failed/empty scan leaves the gate open). Other
 * six days: instant noChange (gacc_registry precedent, round-170).
 */

import { logger, prisma } from "@/lib";
import { upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const CSV_URL =
	"https://sdmx.oecd.org/public/rest/data/OECD.TAD.ATM,DSD_AGR@DF_OUTLOOK_2026_2035,1.1?format=csvfilewithlabels";
export const SOURCE_ID = "oecd_outlook";
/** Bovine meat commodity code in the Outlook CPC nomenclature. */
const COMMODITY_BV = "CPC_EX_BV";
/** Edition pinned in the URL — surfaces in every row's metadata. */
const EDITION = "2026-2035";
/** Days between full re-scans (editions revise at most quarterly). */
export const SCAN_GATE_DAYS = 7;

/**
 * Modeled areas landed. URY (Uruguay) is NOT modeled individually by the
 * Outlook (verified: zero bovine rows) — the honest note for anyone looking
 * for it; Uruguay flows live in inac/inac_expo instead.
 */
export const OUTLOOK_AREAS = ["CHN", "BRA", "ARG", "AUS", "NZL", "USA", "PRY", "OECD"] as const;

/** Balance-sheet measures in thousand tonnes. */
export const OUTLOOK_MEASURES: Record<string, string> = {
	QP: "Production",
	QC: "Consumption",
	IM: "Imports",
	EX: "Exports",
};

/**
 * Quote-aware CSV line split. The labeled SDMX export wraps text labels in
 * quotes and some (measure descriptions) contain commas — a naive split(",")
 * shifts every column after the first such label, silently mis-parsing
 * REF_AREA/MEASURE/OBS_VALUE downstream. Handles "" escapes; lines here are
 * single-row so embedded newlines inside quotes are out of scope.
 */
export function splitCsvLine(line: string): string[] {
	const cols: string[] = [];
	let cur = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					cur += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				cur += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ",") {
			cols.push(cur);
			cur = "";
		} else {
			cur += ch;
		}
	}
	cols.push(cur);
	return cols;
}

export interface OutlookRow {
	area: string;
	measure: string;
	/** Calendar year. */
	year: number;
	value: number;
	projection: boolean;
}

export interface OutlookColumns {
	refArea: number;
	commodity: number;
	measure: number;
	period: number;
	value: number;
}

/** Column index for the labeled-CSV header; null when any key column is absent. */
export function buildOutlookColumns(headerLine: string): OutlookColumns | null {
	const headers = splitCsvLine(headerLine).map((h) => h.trim());
	const idx = {
		refArea: headers.indexOf("REF_AREA"),
		commodity: headers.indexOf("COMMODITY"),
		measure: headers.indexOf("MEASURE"),
		period: headers.indexOf("TIME_PERIOD"),
		value: headers.indexOf("OBS_VALUE"),
	};
	if (Object.values(idx).some((i) => i === -1)) return null;
	return idx;
}

/**
 * One CSV line → one OutlookRow, or null when the line is not a bovine
 * balance-sheet row for a landed area/measure. THE single filter shared by
 * the batch parser (tests) and the streaming fetch path (live) so they
 * cannot drift.
 */
export function outlookRowFromLine(
	line: string,
	idx: OutlookColumns,
	currentYear: number,
): OutlookRow | null {
	// Fast path: the commodity code appears only in the commodity column, so
	// a line without it cannot be a bovine row — skip the quote-aware split
	// for the ~96% of the file that isn't bovine.
	if (!line.includes(COMMODITY_BV)) return null;
	const cols = splitCsvLine(line);
	if (cols.length <= idx.value) return null;
	if (cols[idx.commodity]?.trim() !== COMMODITY_BV) return null;
	const area = cols[idx.refArea]?.trim();
	const measure = cols[idx.measure]?.trim();
	if (!area || !(OUTLOOK_AREAS as readonly string[]).includes(area)) return null;
	if (!(measure in OUTLOOK_MEASURES)) return null;
	const year = Number.parseInt(cols[idx.period]?.trim() ?? "", 10);
	const value = Number.parseFloat(cols[idx.value]?.trim() ?? "");
	if (!Number.isFinite(year) || Number.isNaN(value)) return null;
	return {
		area,
		measure,
		year,
		// Decimal(18,6) storage contract (samePrice/sameFactor no-op, round-153).
		value: Math.round(value * 1e6) / 1e6,
		projection: year > currentYear,
	};
}

/**
 * Parse the full Outlook CSV body (already downloaded as text — the fetcher
 * streams chunks but tests feed a complete fixture here). Pure function:
 * filters to bovine × areas × measures and marks projection years.
 */
export function parseOutlookCsv(text: string, currentYear: number): OutlookRow[] {
	const lines = text.split("\n");
	if (lines.length === 0) return [];
	const idx = buildOutlookColumns(lines[0]);
	if (!idx) return [];
	const rows: OutlookRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const row = outlookRowFromLine(lines[i], idx, currentYear);
		if (row) rows.push(row);
	}
	return rows;
}

/** Stream the SDMX CSV through Response.body, buffering only one line at a
 * time. Collapses CRLF; tolerates a final line without newline. */
export async function streamOutlookCsv(
	res: Response,
	onLine: (line: string) => void,
): Promise<number> {
	if (!res.body) throw new Error("OECD SDMX response has no body stream");
	const reader = res.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let buffer = "";
	let count = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let nl = buffer.indexOf("\n");
		while (nl !== -1) {
			const line = buffer.slice(0, nl).replace(/\r$/, "");
			buffer = buffer.slice(nl + 1);
			onLine(line);
			count++;
			nl = buffer.indexOf("\n");
		}
	}
	const tail = buffer.replace(/\r$/, "");
	if (tail.length > 0) {
		onLine(tail);
		count++;
	}
	return count;
}

export async function persistOutlookRows(
	rows: OutlookRow[],
): Promise<{ inserted: number; updated: number }> {
	let inserted = 0;
	let updated = 0;
	for (const r of rows) {
		const res = await upsertFactor({
			type: "outlook_bovine",
			region: r.area,
			// Annual series keyed to the year's Jan 1.
			date: new Date(Date.UTC(r.year, 0, 1)),
			value: r.value,
			unit: "kt (thousand tonnes, OECD-FAO Outlook)",
			source: SOURCE_ID,
			seriesKey: r.measure,
			metadata: {
				edition: EDITION,
				measure: OUTLOOK_MEASURES[r.measure],
				projection: r.projection,
				unitMult: 3,
			},
		});
		inserted += res.inserted;
		updated += res.updated;
	}
	return { inserted, updated };
}

async function fetchOecdOutlook(): Promise<ScraperResult> {
	// 7-day gate on this source's own last SUCCESS log row — a failed or
	// empty scan leaves the gate open for the next cycle.
	const lastSuccess = await prisma.ingestionLog.findFirst({
		where: { source: SOURCE_ID, status: "success" },
		orderBy: { createdAt: "desc" },
		select: { createdAt: true },
	});
	if (lastSuccess && Date.now() - lastSuccess.createdAt.getTime() < SCAN_GATE_DAYS * 86400_000) {
		return { inserted: 0, updated: 0, noChange: true };
	}

	const res = await scraperFetch(CSV_URL, {
		headers: {
			Accept: "text/csv,*/*",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "MT/1.0 (beef price platform data ingestion)",
		},
		timeoutMs: 240_000,
		retries: 2,
	});
	if (!res.ok) {
		throw new Error(`OECD Outlook CSV returned HTTP ${res.status}`);
	}

	// Stream lines through the shared row filter — never materialize the
	// 237MB body (see parseOutlookCsv for the same predicate under test).
	const currentYear = new Date().getUTCFullYear();
	const collected: OutlookRow[] = [];
	let columns: OutlookColumns | null = null;
	let totalLines = 0;

	await streamOutlookCsv(res, (line) => {
		totalLines++;
		if (!columns) {
			columns = buildOutlookColumns(line);
			return;
		}
		const row = outlookRowFromLine(line, columns, currentYear);
		if (row) collected.push(row);
	});

	if (columns === null || collected.length === 0) {
		// 200 with no recognizable header/rows = format change — return 0/0
		// WITHOUT noChange so the classifier marks it warning and the gate
		// stays open (the success-log gate would otherwise sleep 7 days).
		return { inserted: 0, updated: 0 };
	}

	const { inserted, updated } = await persistOutlookRows(collected);
	logger.info(
		`[OECD_OUTLOOK] ${totalLines} lines streamed / ${collected.length} bovine rows → ${inserted} inserted, ${updated} updated`,
	);
	return inserted + updated === 0 ? { inserted, updated, noChange: true } : { inserted, updated };
}

export const oecdOutlookScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchOecdOutlook,
};
