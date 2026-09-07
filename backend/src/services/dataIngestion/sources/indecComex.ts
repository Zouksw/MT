/**
 * INDEC COMEX Argentina — official monthly exports to China, NCM8 × FOB
 * USD value + net weight (round-163 批1)
 *
 * Closes the platform's longest-standing mirror hole: Argentina (a top-3
 * China supplier) reports monthly HS detail to Comtrade so sparsely that
 * comtrade_mirror's AR→CN rows are nearly empty, and argentinaExports only
 * carries the all-destination meats rubro (registered gap: "产品×目的地交叉
 * 不存在于 SSPM 75/77"). That cross DOES exist — published by INDEC's own
 * public query system:
 *
 *   https://comex.indec.gob.ar/  (React SPA)
 *   https://comexbe.indec.gob.ar/public-api/*  (its backend — direct-
 *   reachable from this machine, keyless, robots.txt absent/404)
 *
 * Contract (reverse-engineered from the SPA bundles, live-verified
 * 2026-09-07, pinned by tests):
 *  - GET /public-api/search/?commerceType=export&year=Y&period=monthly
 *      &countryQuery=allCountries&products=["02023000",…]&countries=["CN-310"]
 *    returns product × country × month rows {amount(FOB USD), weight(kg),
 *    month, isConfidential?} for the WHOLE year in ONE request — the
 *    `countries` filter is decorative (all countries arrive; filter CN
 *    client-side by iso2).
 *  - China's country id is 310 (search/countries) — embedded as the constant
 *    CN_COUNTRY param.
 *  - Small-destination flows are fiscal-confidential: amount=0, weight=0 with
 *    isConfidential:true — skipped, never zero-landed. China rows are public.
 *  - GET /public-api/staticData → {lastYear, lastMonth} bounds the scan
 *    (2026-09-07: 2026-07 present — T+1 freshness).
 *  - Absent months = no flow (never zero-filled). NCM codes come from
 *    search/products (8-digit NCM8; offal splits 02062910 tails /
 *    02062990 other — 02062900 does NOT exist).
 *
 * 口径: AR-official FOB USD (INDEC). Lands THREE layers of the same official
 * observation, never mixed with other sources: per-NCM8 rows
 * (`export_ar_to_cn_{ncm}`) keep full cut-level fidelity; per-HS6 and
 * 0201/0202 per-HS4 aggregate rows (sums of their NCM children's
 * amount+weight) let the existing /trade-flows pills show an AR monthly
 * lane with zero read-side aggregation logic.
 */

import { logger } from "@/lib";
import { parseMonth, upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const API_BASE = "https://comexbe.indec.gob.ar/public-api";
const SOURCE_ID = "indec_comex";

/** Beef-family NCM8 codes (fresh + frozen + bovine offal). */
export const NCM_CODES = [
	"02011000",
	"02012010",
	"02012020",
	"02012090",
	"02013000",
	"02021000",
	"02022010",
	"02022020",
	"02022090",
	"02023000",
	"02061000",
	"02062100",
	"02062200",
	"02062910",
	"02062990",
] as const;

/** API product-dimension labels (search/products), for 口径 display. */
export const NCM_LABELS: Record<(typeof NCM_CODES)[number], string> = {
	"02011000": "Carne bovina en reses o medias reses, fresca o refrigerada",
	"02012010": "Cuartos delanteros de carne bovina fresca/refrigerada s/deshuesar",
	"02012020": "Cuartos traseros de carne bovina fresca/refrigerada s/deshuesar",
	"02012090": "Cortes de carne bovina fresca/refrigerada s/deshuesar, ncop.",
	"02013000": "Carne bovina deshuesada, fresca o refrigerada",
	"02021000": "Carne bovina en reses o medias reses, congelada",
	"02022010": "Cuartos delanteros de carne bovina congelada s/deshuesar",
	"02022020": "Cuartos traseros de carne bovina congelada s/deshuesar",
	"02022090": "Cortes de carne bovina congelada s/deshuesar, ncop.",
	"02023000": "Carne bovina congelada deshuesada",
	"02061000": "Despojos de la especie bovina, frescos o refrigerados",
	"02062100": "Lenguas bovinas congeladas",
	"02062200": "Hígados bovinos congelados",
	"02062910": "Colas (rabos) bovinos congelados",
	"02062990": "Despojos de la especie bovina ncop. congelados",
};

const CN_COUNTRY = "CN-310";
/** Rolling window re-scanned daily: the current data year (1 request). */
export const DAILY_LOOKBACK_YEARS = 1;
/** One-time backfill depth in years (37 months spans 4 calendar years). */
export const BACKFILL_YEARS = 4;

/** Minimal shapes of the two endpoints this source consumes. */
export interface ComexSearchRow {
	product?: { id?: string };
	country?: { iso2?: string };
	month?: number;
	amount?: number;
	weight?: number;
	isConfidential?: boolean;
}

export interface ComexRow {
	/** NCM8 (per-NCM layer) or HS6/HS4 (aggregate layer). */
	code: string;
	level: "NCM8" | "HS6" | "HS4";
	/** "YYYY-MM". */
	period: string;
	valueUsd: number;
	quantityKg: number;
}

/**
 * Filter one year's response to China rows and build the three layers. Pure
 * — the test seam: CN filter, confidential/zero-row skip, month zero-pad,
 * and the NCM→HS6→HS4 aggregation (sum amount + sum weight, then derive the
 * unit price from the sums — never average averages).
 */
export function parseComexRows(rows: ComexSearchRow[], year: number): ComexRow[] {
	const known = new Set<string>(NCM_CODES);
	const byNcm = new Map<string, Map<number, { usd: number; kg: number }>>();

	for (const row of rows) {
		const code = row.product?.id ?? "";
		if (!known.has(code)) continue;
		if ((row.country?.iso2 ?? "") !== "CN") continue;
		if (row.isConfidential === true) continue;
		const usd = row.amount ?? 0;
		const kg = row.weight ?? 0;
		const month = row.month ?? 0;
		if (usd <= 0 || kg <= 0 || month < 1 || month > 12) continue;

		const months = byNcm.get(code) ?? new Map();
		const acc = months.get(month) ?? { usd: 0, kg: 0 };
		acc.usd += usd;
		acc.kg += kg;
		months.set(month, acc);
		byNcm.set(code, months);
	}

	const out: ComexRow[] = [];
	/** Aggregate parents: every NCM's HS6, plus the 0201/0202 HS4 pills. */
	const parents = (ncm: string): Array<{ code: string; level: "HS6" | "HS4" }> => {
		const list: Array<{ code: string; level: "HS6" | "HS4" }> = [
			{ code: ncm.slice(0, 6), level: "HS6" },
		];
		const hs4 = ncm.slice(0, 4);
		if (hs4 === "0201" || hs4 === "0202") list.push({ code: hs4, level: "HS4" });
		return list;
	};
	const agg = new Map<string, Map<number, { usd: number; kg: number }>>();

	for (const [ncm, months] of byNcm) {
		for (const [month, acc] of months) {
			out.push({
				code: ncm,
				level: "NCM8",
				period: `${year}-${String(month).padStart(2, "0")}`,
				valueUsd: acc.usd,
				quantityKg: acc.kg,
			});
			for (const parent of parents(ncm)) {
				const pMonths = agg.get(parent.code) ?? new Map();
				const pAcc = pMonths.get(month) ?? { usd: 0, kg: 0 };
				pAcc.usd += acc.usd;
				pAcc.kg += acc.kg;
				pMonths.set(month, pAcc);
				agg.set(parent.code, pMonths);
			}
		}
	}
	for (const [code, months] of agg) {
		for (const [month, acc] of months) {
			out.push({
				code,
				level: code.length === 4 ? "HS4" : "HS6",
				period: `${year}-${String(month).padStart(2, "0")}`,
				valueUsd: acc.usd,
				quantityKg: acc.kg,
			});
		}
	}
	return out;
}

/** Build the one-request-per-year search URL. */
export function comexSearchUrl(year: number): string {
	const q = new URLSearchParams({
		commerceType: "export",
		year: String(year),
		period: "monthly",
		countryQuery: "allCountries",
		products: JSON.stringify([...NCM_CODES]),
		countries: JSON.stringify([CN_COUNTRY]),
	});
	return `${API_BASE}/search/?${q}`;
}

async function fetchMaxPeriod(): Promise<{ year: number; month: number } | null> {
	try {
		const res = await scraperFetch(`${API_BASE}/staticData`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "MT/1.0 (beef price platform data ingestion)",
			},
			timeoutMs: 20_000,
			retries: 2,
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { lastYear?: number; lastMonth?: number };
		if (!body.lastYear || !body.lastMonth) return null;
		return { year: body.lastYear, month: body.lastMonth };
	} catch {
		return null;
	}
}

async function fetchYear(year: number): Promise<ComexSearchRow[] | null> {
	try {
		const res = await scraperFetch(comexSearchUrl(year), {
			headers: {
				Accept: "application/json",
				"User-Agent": "MT/1.0 (beef price platform data ingestion)",
			},
			timeoutMs: 45_000,
			retries: 2,
		});
		if (!res.ok) {
			logger.warn(`[INDEC_COMEX] year ${year} query returned HTTP ${res.status}`);
			return null;
		}
		const body = (await res.json()) as ComexSearchRow[];
		if (!Array.isArray(body)) return null;
		return body;
	} catch (err) {
		logger.warn(
			`[INDEC_COMEX] year ${year} fetch failed: ${err instanceof Error ? err.message : err}`,
		);
		return null;
	}
}

export async function runIndecComex(yearsLookback: number): Promise<ScraperResult> {
	const max = await fetchMaxPeriod();
	if (!max) {
		logger.warn("[INDEC_COMEX] staticData unavailable — skipping run");
		return { inserted: 0, updated: 0 };
	}

	let inserted = 0;
	let updated = 0;
	let parsedRows = 0;

	for (let year = max.year; year > max.year - yearsLookback; year--) {
		const rows = await fetchYear(year);
		if (!rows) continue;

		for (const parsed of parseComexRows(rows, year)) {
			const date = parseMonth(parsed.period.replace("-", ""));
			if (!date || Number.isNaN(date.getTime())) continue;
			parsedRows++;
			const r = await upsertFactor({
				type: `export_ar_to_cn_${parsed.code}`,
				region: "AR→CN",
				date,
				// Decimal(18,6) scale — the comtradeMirror rounding contract.
				value: Math.round((parsed.valueUsd / (parsed.quantityKg / 1000)) * 1e6) / 1e6,
				unit: "USD/ton",
				source: SOURCE_ID,
				metadata: {
					freq: "M",
					period: parsed.period,
					quantityKg: parsed.quantityKg,
					valueUsd: parsed.valueUsd,
					currency: "USD",
					productLevel: parsed.level,
					...(parsed.level === "NCM8"
						? {
								ncm: parsed.code,
								productLabelEs: NCM_LABELS[parsed.code as (typeof NCM_CODES)[number]],
							}
						: { hsCode: parsed.code }),
					basis: `FOB-USD (Argentina INDEC COMEX, ${parsed.level === "NCM8" ? `NCM ${parsed.code}` : `${parsed.level} ${parsed.code} aggregate`}, official)`,
				},
			});
			inserted += r.inserted;
			updated += r.updated;
		}
	}

	const noChange = parsedRows > 0 && inserted + updated === 0;
	logger.info(
		`[INDEC_COMEX] ${yearsLookback} year(s) → ${parsedRows} rows → ${noChange ? "unchanged" : `${inserted} inserted, ${updated} updated`} (max period ${max.year}-${max.month})`,
	);
	return noChange ? { inserted, updated, noChange: true } : { inserted, updated };
}

async function fetchIndecComex(): Promise<ScraperResult> {
	return runIndecComex(DAILY_LOOKBACK_YEARS);
}

export const indecComexScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchIndecComex,
};
