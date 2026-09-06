/**
 * IBGE SIDRA t/1092 — quarterly bovine slaughter (official Brazil, keyless)
 * (round-158 批B; research: docs/DATA-SOURCES-EVALUATION.md §8.1)
 *
 * The Pesquisa Trimestral do Abate national totals: animals slaughtered
 * (variable 284, head) and total carcass weight (variable 285, kg) per
 * quarter. National level (n1/1) returns only the Total categories — no
 * classification filtering needed. API verified live 2026-09-06/07 (params
 * validated; multi-variable slash syntax v/284/285 hangs, so one v/allxp
 * fetch is filtered client-side — informantes variable 151 dropped).
 *
 * Lands MarketFactor (analysis face, same as comtrade_mirror /
 * argentina_exports — NOT a CommodityPrice prediction series). weekly_kills
 * stays untouched: it is a WEEKLY US-style table and quarterly national
 * totals are a different shape; forcing them in would corrupt its semantics.
 *
 * Quarterly data on the daily cycle: re-scans the last 8 quarters;
 * non-release days no-op every upsert → noChange:true (round-149 contract).
 */

import { logger } from "@/lib";
import { upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const API_URL = "https://apisidra.ibge.gov.br/values/t/1092/n1/1/v/allxp/p/last%208";
const SOURCE_ID = "ibge_sidra";
/** Rolling window re-scanned daily (backfill arrives free in the same query). */
export const LOOKBACK_QUARTERS = 8;

export interface SidraSlaughterRow {
	variable: "head" | "carcassKg";
	/** Quarter start (UTC midnight). */
	date: Date;
	/** Animais abatidos (head) or Peso total das carcaças (kg). */
	value: number;
	/** Quarter label as SIDRA returns it, e.g. "1º trimestre 2026". */
	quarter: string;
}

/** Shape of one SIDRA /values row (first array element is the legend row). */
interface SidraValueRow {
	V?: string;
	D2C?: string; // variable code (151 informantes / 284 head / 285 carcass kg)
	D2N?: string;
	D3C?: string; // quarter code YYYYQQ ("202601" = Q1 2026)
	D3N?: string;
	MN?: string; // unit name (Cabeças / Quilogramas)
}

/** Quarter code "202601" → 2026-01-01 UTC; "202604" → 2026-10-01. Null when malformed. */
export function parseQuarterCode(code: string): Date | null {
	const m = code.match(/^(\d{4})(0[1-4])$/);
	if (!m) return null;
	const month = (Number.parseInt(m[2], 10) - 1) * 3 + 1;
	return new Date(`${m[1]}-${String(month).padStart(2, "0")}-01T00:00:00Z`);
}

/**
 * Parse the SIDRA /values response into head/carcass rows. Pure function —
 * the unit-test seam. All-or-nothing per row: any malformed quarter code or
 * non-positive value is dropped (schema drift must surface as missing rows,
 * never wrong data). Informantes (151) is not a data series and is skipped.
 */
export function parseSidraSlaughter(payload: unknown): SidraSlaughterRow[] {
	if (!Array.isArray(payload)) return [];
	const rows: SidraSlaughterRow[] = [];
	for (const raw of payload.slice(1)) {
		const r = raw as SidraValueRow;
		if (r.D2C !== "284" && r.D2C !== "285") continue;

		const date = r.D3C ? parseQuarterCode(r.D3C) : null;
		const value = Number.parseFloat(String(r.V ?? ""));
		if (!date || !Number.isFinite(value) || value <= 0) continue;

		rows.push({
			variable: r.D2C === "284" ? "head" : "carcassKg",
			date,
			value,
			quarter: r.D3N ?? r.D3C ?? "",
		});
	}
	return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function fetchSidraSlaughter(): Promise<ScraperResult> {
	const res = await scraperFetch(API_URL, {
		headers: {
			Accept: "application/json",
			"User-Agent": "MT/1.0 (beef price platform data ingestion)",
		},
		timeoutMs: 25_000,
		retries: 2,
	});
	if (!res.ok) {
		logger.warn(`[IBGE_SIDRA] API fetch returned HTTP ${res.status}`);
		return { inserted: 0, updated: 0 };
	}

	let payload: unknown;
	try {
		payload = JSON.parse(await res.text());
	} catch {
		logger.warn("[IBGE_SIDRA] response is not JSON — endpoint drift?");
		return { inserted: 0, updated: 0 };
	}

	const rows = parseSidraSlaughter(payload);
	if (rows.length === 0) {
		logger.warn("[IBGE_SIDRA] no slaughter rows parsed — schema drift?");
		return { inserted: 0, updated: 0 };
	}

	let inserted = 0;
	let updated = 0;
	for (const row of rows) {
		const r = await upsertFactor({
			type: "slaughter_bovines",
			region: "BR",
			seriesKey: row.variable === "head" ? "animais_abatidos" : "peso_carcacas",
			date: row.date,
			// Integer counts/weights — the 6dp round keeps sameFactor's no-op
			// exact against Decimal(18,6) storage (comtradeMirror precedent).
			value: Math.round(row.value * 1e6) / 1e6,
			unit: row.variable === "head" ? "head" : "kg",
			source: SOURCE_ID,
			metadata: {
				table: "1092",
				variableCode: row.variable === "head" ? "284" : "285",
				variableName: row.variable === "head" ? "Animais abatidos" : "Peso total das carcaças",
				quarter: row.quarter,
				desc: "Pesquisa Trimestral do Abate, bovines, national total (IBGE SIDRA t/1092), quarterly",
				portal: "https://apisidra.ibge.gov.br/",
			},
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	// Quarterly series on the daily cycle: rows parsed, zero writes = confirmed
	// unchanged (upsertFactor's sameFactor no-op), not a silent failure.
	const noChange = inserted + updated === 0;
	logger.info(
		`[IBGE_SIDRA] ${rows.length} quarterly rows (last ${LOOKBACK_QUARTERS}Q) → ${noChange ? "unchanged" : `${inserted} inserted, ${updated} updated`}`,
	);
	return noChange ? { inserted, updated, noChange: true } : { inserted, updated };
}

export const ibgeSidraScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchSidraSlaughter,
};
