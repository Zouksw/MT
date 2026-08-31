/**
 * UN Comtrade public preview mirror — monthly beef trade flows to China
 * (V8 批0, round-151; research: docs/RESEARCH-BEEF-TRADE-DATA-SOURCES.md §4.1)
 *
 * China reports no monthly HS detail to Comtrade (reporter 156 monthly = 0
 * rows, live-verified), but its suppliers do. This source inverts the view:
 * partner-side exports TO China (partnerCode=156, flowCode=X) give the
 * 分国别×HS×月度 volume/price layer the retired china_customs_stats never
 * produced (its stats.customs.gov.cn endpoint was fabricated and the host is
 * egress-blocked — KNOWN-ISSUES D1).
 *
 * Three query lanes, all keyless, all on the same public preview API
 * (https://comtradeapi.un.org/public/v1/preview/C/{freq}/HS):
 *  1. Monthly mirror — live monthly reporters BR(76)/AU(36)/NZ(554)/US(842)
 *     × flow X × partner 156. Freshness BR≈t-1, AU/US≈t-2 (NZ in between).
 *  2. Annual fallback — AR(32)/UY(858) report no monthly HS detail; same
 *     mirror semantics at freq=A (latest full year lands ~1 year in arrears:
 *     2025 was still 0 rows on 2026-08-31, 2024 verified).
 *  3. China annual calibration — reporter 156 / flow M (CIF, China-reported)
 *     × 6 suppliers + World. FOB-mirror and CIF-official are SYSTEMATICALLY
 *     different numbers (verified BR: 2024 annual CIF $4,621/t vs 2026-06
 *     monthly FOB $6,751/t); they get different factor types and are never
 *     merged into one series (口径注记, research §七.4).
 *
 * API contract traps (all live-verified 2026-08-31, pinned by tests):
 *  - motCode==0 is the all-modes TOTAL row; the preview splits by transport
 *    mode too (sea 2100 etc. duplicates the total) — naive sum ≈ 2× the real
 *    quantity. Filter motCode!==0 out before anything else.
 *  - flowCode must be "X"/"M" ("1" → 400).
 *  - period accepts exactly ONE value ("Maximum number of periods for preview
 *    is 1") — batch HS codes with commas instead (cmdCode=0201,0202,… works;
 *    partnerCode comma lists work too).
 *  - ~1 req/s rate limit (429 "Try again in 1 seconds") — 2s spacing between
 *    calls + scraperFetch's transient retry covers it.
 *
 * Monthly data riding the daily cycle: non-release days re-fetch the same
 * rolling window and every upsert no-ops — reported as noChange:true (the
 * round-149 usda_import_beef contract) so the freshness board stays healthy.
 */

import { logger } from "@/lib";
import { monthRange, parseMonth, upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const API_BASE = "https://comtradeapi.un.org/public/v1/preview/C";
const SOURCE_ID = "comtrade_mirror";
const PARTNER_CN = 156;

/** Reporters that publish monthly HS detail with usable freshness. */
export const MONTHLY_REPORTERS = [
	{ code: 76, iso2: "BR" },
	{ code: 36, iso2: "AU" },
	{ code: 554, iso2: "NZ" },
	{ code: 842, iso2: "US" },
] as const;

/** Reporters with annual detail only (no monthly HS reporting). */
export const ANNUAL_FALLBACK_REPORTERS = [
	{ code: 32, iso2: "AR" },
	{ code: 858, iso2: "UY" },
] as const;

/**
 * Beef HS codes: 4-digit chapter lines (0201/0202/0206 totals) plus the
 * 6-digit cuts closest to "部位" granularity (0202.30 frozen boneless,
 * 0202.20 frozen bone-in, 0206.10-29 offal items). 0202 ⊇ 020220+020230 —
 * they are stored as separate series and must never be summed on read.
 */
export const HS_CODES = [
	"0201",
	"0202",
	"020230",
	"020220",
	"020610",
	"020621",
	"020622",
	"020629",
] as const;

const HS_CSV = HS_CODES.join(",");

/** China calibration partners: the 6 beef suppliers + 0 (World total). */
const CN_CALIBRATION_PARTNERS = "0,32,36,76,554,842,858";

const REPORTER_ISO: Record<number, string> = {
	76: "BR",
	36: "AU",
	554: "NZ",
	842: "US",
	32: "AR",
	858: "UY",
	156: "CN",
};

const PARTNER_ISO: Record<number, string> = {
	0: "WORLD",
	32: "AR",
	36: "AU",
	76: "BR",
	554: "NZ",
	842: "US",
	858: "UY",
};

/** Rolling window the daily run re-scans (revision catch + fresh months). */
export const DAILY_LOOKBACK_MONTHS = 3;
/** One-time backfill depth (research §六 P0: 首跑回填 36 个月 → 37 includes current). */
export const BACKFILL_MONTHS = 37;
/** Annual lanes scan current + previous 2 years (annual lands ~1y in arrears). */
const ANNUAL_YEARS_BACK = 2;

const MS_BETWEEN_REQUESTS = 2000;

export interface ComtradeRow {
	period: string; // "202606" monthly, "2024" annual
	freqCode?: string;
	reporterCode: number;
	flowCode: string;
	partnerCode: number;
	cmdCode: string;
	motCode: number;
	netWgt: number | null;
	fobvalue: number | null;
	cifvalue: number | null;
	classificationCode?: string | null;
}

export interface ParsedTradeRow {
	type: string;
	region: string;
	date: Date;
	/** Unit value, USD/ton (valueUsd ÷ netWgt-in-t). */
	value: number;
	unit: "USD/ton";
	metadata: Record<string, unknown>;
}

/**
 * Raw Comtrade rows → MarketFactor upsert payloads. Pure function — the
 * unit-test seam for the motCode trap, the FOB/CIF basis split, malformed-row
 * dropping, and the annual/monthly date shapes.
 */
export function parseTradeRows(rows: ComtradeRow[]): ParsedTradeRow[] {
	const out: ParsedTradeRow[] = [];
	for (const row of rows) {
		// Transport-mode split duplicates the total — keep the ALL-modes row only.
		if (row.motCode !== 0) continue;

		const isAnnual = row.period.length === 4;
		const date = parseMonth(isAnnual ? `${row.period}01` : row.period);
		// parseMonth happily returns an Invalid Date for month 13/00 — truthy,
		// so it must be checked explicitly before it reaches Prisma.
		if (!date || Number.isNaN(date.getTime())) continue;

		const valueUsd = row.flowCode === "M" ? row.cifvalue : row.fobvalue;
		if (!valueUsd || valueUsd <= 0 || !row.netWgt || row.netWgt <= 0) continue;

		const reporterIso = REPORTER_ISO[row.reporterCode];
		if (!reporterIso) continue;

		// Calibration lane (China-reported CIF imports) vs mirror lane
		// (partner-reported FOB exports) — separate types, never merged.
		let type: string;
		let region: string;
		if (row.reporterCode === 156) {
			const partnerIso = PARTNER_ISO[row.partnerCode];
			if (!partnerIso) continue;
			type = `import_cn_cif_${row.cmdCode}`;
			region = `CN←${partnerIso}`;
		} else {
			type = `export_to_cn_${row.cmdCode}`;
			region = `${reporterIso}→CN`;
		}

		out.push({
			type,
			region,
			date,
			// Round to the column's Decimal(18,6) scale — otherwise the raw
			// float never equals the stored (truncated) value and every daily
			// re-scan reports an "update" instead of noChange (live-found in
			// the round-151 boot run: 111 phantom updates).
			value: Math.round((valueUsd / (row.netWgt / 1000)) * 1e6) / 1e6,
			unit: "USD/ton",
			metadata: {
				freq: isAnnual ? "A" : "M",
				period: row.period,
				hsCode: row.cmdCode,
				quantityKg: row.netWgt,
				valueUsd,
				basis:
					row.flowCode === "M" ? "CIF (China-reported import)" : "FOB (partner-reported export)",
				reporterCode: row.reporterCode,
				partnerCode: row.partnerCode,
				classification: row.classificationCode ?? "H6",
			},
		});
	}
	return out;
}

/** Build one preview-API URL (single period, batched cmd/partner codes). */
export function comtradeUrl(params: {
	freq: "M" | "A";
	reporterCode: number;
	period: string;
	flowCode: "X" | "M";
	partnerCode: string;
}): string {
	const q = new URLSearchParams({
		reporterCode: String(params.reporterCode),
		period: params.period,
		cmdCode: HS_CSV,
		flowCode: params.flowCode,
		partnerCode: params.partnerCode,
	});
	return `${API_BASE}/${params.freq}/HS?${q}`;
}

interface PreviewResponse {
	data?: ComtradeRow[];
	error?: string | null;
}

async function fetchRows(url: string): Promise<ComtradeRow[] | null> {
	const res = await scraperFetch(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": "MT/1.0 (beef price platform data ingestion)",
		},
		timeoutMs: 20_000,
		retries: 2,
	});
	if (!res.ok) {
		logger.warn(`[COMTRADE_MIRROR] ${url.slice(-80)} returned HTTP ${res.status}`);
		return null;
	}
	const body = (await res.json()) as PreviewResponse;
	if (body.error) {
		logger.warn(`[COMTRADE_MIRROR] API error: ${body.error}`);
		return null;
	}
	return body.data ?? [];
}

/**
 * Run the mirror sweep. `monthsLookback` widens the monthly window for the
 * one-time backfill; the daily scraper uses DAILY_LOOKBACK_MONTHS.
 */
export async function runComtradeMirror(monthsLookback: number): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;
	let parsedRows = 0;
	let firstRequest = true;
	const sleep = () => new Promise((r) => setTimeout(r, MS_BETWEEN_REQUESTS));

	const now = new Date();
	const start = new Date(now);
	start.setUTCMonth(start.getUTCMonth() - monthsLookback);
	const periods = monthRange(start, now);

	const year = now.getUTCFullYear();
	const years: string[] = [];
	for (let i = 0; i <= ANNUAL_YEARS_BACK; i++) years.push(String(year - i));

	const queries: Array<{ url: string }> = [];
	for (const period of periods) {
		for (const r of MONTHLY_REPORTERS) {
			queries.push({
				url: comtradeUrl({
					freq: "M",
					reporterCode: r.code,
					period,
					flowCode: "X",
					partnerCode: String(PARTNER_CN),
				}),
			});
		}
	}
	for (const y of years) {
		for (const r of ANNUAL_FALLBACK_REPORTERS) {
			queries.push({
				url: comtradeUrl({
					freq: "A",
					reporterCode: r.code,
					period: y,
					flowCode: "X",
					partnerCode: String(PARTNER_CN),
				}),
			});
		}
		queries.push({
			url: comtradeUrl({
				freq: "A",
				reporterCode: 156,
				period: y,
				flowCode: "M",
				partnerCode: CN_CALIBRATION_PARTNERS,
			}),
		});
	}

	for (const { url } of queries) {
		if (!firstRequest) await sleep();
		firstRequest = false;

		let rows: ComtradeRow[] | null;
		try {
			rows = await fetchRows(url);
		} catch (err) {
			logger.warn(`[COMTRADE_MIRROR] fetch failed: ${err instanceof Error ? err.message : err}`);
			continue;
		}
		if (rows === null) continue;

		for (const parsed of parseTradeRows(rows)) {
			parsedRows++;
			const r = await upsertFactor({
				type: parsed.type,
				region: parsed.region,
				date: parsed.date,
				value: parsed.value,
				unit: parsed.unit,
				source: SOURCE_ID,
				metadata: parsed.metadata,
			});
			inserted += r.inserted;
			updated += r.updated;
		}
	}

	// Monthly/annual series re-scanned on the daily cycle: rows parsed but
	// zero writes means the same data confirmed unchanged (upsertFactor's
	// sameFactor no-op) — success, not an empty warning.
	const noChange = parsedRows > 0 && inserted + updated === 0;
	logger.info(
		`[COMTRADE_MIRROR] ${queries.length} queries, ${parsedRows} rows → ${noChange ? "unchanged" : `${inserted} inserted, ${updated} updated`}`,
	);
	return noChange ? { inserted, updated, noChange: true } : { inserted, updated };
}

async function fetchComtradeMirror(): Promise<ScraperResult> {
	return runComtradeMirror(DAILY_LOOKBACK_MONTHS);
}

export const comtradeMirrorScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchComtradeMirror,
};
