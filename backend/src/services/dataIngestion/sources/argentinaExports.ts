/**
 * Argentina monthly beef-family exports — SSPM/INDEC ICA series
 * (V8 批2, round-151; research: docs/RESEARCH-BEEF-TRADE-DATA-SOURCES.md §4.4)
 *
 * Argentina reports no monthly HS detail to Comtrade (annual only), so the
 * 批0 mirror cannot cover AR monthlies. This source lands the degradation
 * tier the plan specified: the official monthly FOB value series for the
 * "Carnes y sus preparados" (meats) export rubro from the national open-data
 * portal — keyless, direct-reachable, fresh to t-2 (2026-06 present on
 * 2026-08-31), full history back to 1992-01 in the same CSV.
 *
 * Degradation gap, registered deliberately (登记缺口): the product×destination
 * cross (牛肉×目的国月度) does NOT exist in datos.gob.ar — SSPM 75 carries the
 * product rubro without destination, SSPM 77 carries destination totals
 * without product. type stays `export_fob_carnes` / region `AR→WORLD`
 * (deliberately NOT the 批0 `export_to_cn_*` semantics: this is all
 * destinations, value only, no quantity → no unit price). Fill paths stay on
 * the observation list (INDEC NCM×destino annexes, SENASA via proxy).
 *
 * Monthly data on the daily cycle: re-scans a 36-month window; non-release
 * days no-op every upsert → noChange:true (round-149 contract).
 */

import { logger } from "@/lib";
import { parseMonth, upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const CSV_URL =
	"https://infra.datos.gob.ar/catalog/sspm/dataset/75/distribution/75.3/download/exportaciones-mensual.csv";
const SOURCE_ID = "argentina_exports";
/** The meats rubro column inside the ICA monthly CSV. */
export const CARNES_FIELD = "ica_carnes";
/** Rolling window re-scanned daily (backfill arrives free in the same CSV). */
export const LOOKBACK_MONTHS = 36;

export interface CarnesRow {
	/** Month start (UTC). */
	date: Date;
	/** FOB exports of the meats rubro, millions USD. */
	valueUsdM: number;
}

/**
 * Parse the SSPM 75.3 monthly CSV into {date, valueUsdM} rows. Pure function
 * — the unit-test seam. All-or-nothing on schema: a header without the
 * carnes field returns [] so the fetch path refuses to write anything
 * (column drift must surface as a 0-row warning, never wrong data).
 */
export function parseCarnesCsv(text: string): CarnesRow[] {
	const lines = text.trim().split(/\r?\n/);
	if (lines.length < 2) return [];

	const header = lines[0].split(",");
	const timeIdx = header.indexOf("indice_tiempo");
	const carnesIdx = header.indexOf(CARNES_FIELD);
	if (timeIdx === -1 || carnesIdx === -1) return [];

	const rows: CarnesRow[] = [];
	for (const line of lines.slice(1)) {
		const cols = line.split(",");
		if (cols.length <= Math.max(timeIdx, carnesIdx)) continue;

		const date = parseMonth(cols[timeIdx].slice(0, 7).replace("-", ""));
		if (!date || Number.isNaN(date.getTime())) continue;

		const value = Number.parseFloat(cols[carnesIdx]);
		if (!Number.isFinite(value) || value < 0) continue;

		rows.push({ date, valueUsdM: value });
	}
	return rows;
}

async function fetchArgentinaExports(): Promise<ScraperResult> {
	const res = await scraperFetch(CSV_URL, {
		headers: { Accept: "text/csv", "User-Agent": "MT/1.0 (beef price platform data ingestion)" },
		timeoutMs: 20_000,
		retries: 2,
	});
	if (!res.ok) {
		logger.warn(`[ARGENTINA_EXPORTS] CSV fetch returned HTTP ${res.status}`);
		return { inserted: 0, updated: 0 };
	}

	const rows = parseCarnesCsv(await res.text());
	if (rows.length === 0) {
		// Schema drift or empty upstream — 0 rows classify as warning.
		logger.warn("[ARGENTINA_EXPORTS] no carnes rows parsed — schema drift?");
		return { inserted: 0, updated: 0 };
	}

	const cutoff = new Date();
	cutoff.setUTCMonth(cutoff.getUTCMonth() - LOOKBACK_MONTHS);

	let inserted = 0;
	let updated = 0;
	for (const row of rows) {
		if (row.date < cutoff) continue;
		const r = await upsertFactor({
			type: "export_fob_carnes",
			region: "AR→WORLD",
			date: row.date,
			// Same Decimal(18,6) rounding as comtradeMirror — the CSV carries
			// ~10 significant decimals, which would defeat sameFactor's no-op
			// and turn every daily run into phantom updates.
			value: Math.round(row.valueUsdM * 1e6) / 1e6,
			unit: "USD M",
			source: SOURCE_ID,
			metadata: {
				serie: CARNES_FIELD,
				dataset: "sspm-75.3",
				desc: "Carnes y sus preparados FOB exports, millions USD, monthly, all destinations (INDEC/SSPM ICA)",
				coverage: "AR→WORLD (destination cross not published at this level — registered gap)",
			},
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	// Monthly series on the daily cycle: rows parsed, zero writes = confirmed
	// unchanged (upsertFactor's sameFactor no-op), not a silent failure.
	const noChange = inserted + updated === 0;
	logger.info(
		`[ARGENTINA_EXPORTS] ${rows.length} rows in CSV (${LOOKBACK_MONTHS}m window) → ${noChange ? "unchanged" : `${inserted} inserted, ${updated} updated`}`,
	);
	return noChange ? { inserted, updated, noChange: true } : { inserted, updated };
}

export const argentinaExportsScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchArgentinaExports,
};
