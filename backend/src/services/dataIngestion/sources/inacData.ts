/**
 * INAC DIAE — Uruguay fat-steers live-weight monthly price (keyless)
 * (revived round-159; recon: docs/DATA-SOURCES-EVALUATION.md §四.2 / §八)
 *
 * The old contract (pre-2026-08-15 decommission) scraped cut-level FOB
 * tables off www.inac.gub.uy/estadisticas/exportaciones.html into
 * BeefCutPrice. That domain is gone (SSL-dead, verified 2026-09-06). The
 * portal moved to www.inac.uy (Liferay) with a "DIAE Interactiva" data app
 * whose backend service is POST/GET https://www.inac.uy/inac/DIAEUtils:
 *   - cmdaction=datosiniciales&app=precios → {maxAno, maxMes} (freshness)
 *   - ?cmdaction=precios&format=CSV&ano=Y&categoria=1&tipoprecio=1
 *     → "Precios de Novillos gordos en pie" — fat steers, LIVE weight,
 *       USD/kg, monthly, year Y plus year Y-1 columns side by side.
 * Verified live 2026-09-07: maxAno=2026/maxMes=7, decimals are comma ("2,948"),
 * September is Uruguayan "Setiembre", footer rows carry "Fuente: INAC".
 *
 * Lands CommodityPrice (slug novillo_gordo_uy, interval monthly — the same
 * monthly-benchmark family as beef_carcass_us). Cut-level FOB (the old
 * BeefCutPrice semantics) may return later via the DIAE "expo" app — not
 * this revival's scope.
 *
 * Monthly data on the daily cycle: one datosiniciales probe + a stride-2
 * ladder of year queries (each CSV carries 2 years) re-scanned daily;
 * non-release days no-op every upsert → noChange:true (round-149 contract).
 */

import { logger } from "@/lib";
import { ensureCommodity, upsertPrice } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const SERVICE_URL = "https://www.inac.uy/inac/DIAEUtils";
const SOURCE_ID = "inac";
export const SLUG_NOVILLO = "novillo_gordo_uy";
/** Years of history kept warm. Each ano query returns that year + the one
 * before, so the ladder steps by 2: 4 requests cover 8 calendar years. */
export const LOOKBACK_YEARS = 8;

export interface InacPricePoint {
	/** Month start (UTC midnight). */
	date: Date;
	valueUsdKg: number;
}

/** Uruguayan Spanish month names (note "Setiembre"; "Septiembre" accepted). */
const MONTHS: Record<string, number> = {
	enero: 1,
	febrero: 2,
	marzo: 3,
	abril: 4,
	mayo: 5,
	junio: 6,
	julio: 7,
	agosto: 8,
	setiembre: 9,
	septiembre: 9,
	octubre: 10,
	noviembre: 11,
	diciembre: 12,
};

/** Quote-aware single-line CSV splitter (values like "2,948" are quoted
 * because the decimal separator is a comma). */
function splitCsvLine(line: string): string[] {
	const fields: string[] = [];
	let cur = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === "," && !inQuotes) {
			fields.push(cur);
			cur = "";
		} else {
			cur += ch;
		}
	}
	fields.push(cur);
	return fields;
}

/** Spanish-locale number ("2,948" / "1.234,56") → number. NaN on garbage. */
function parseEsNumber(s: string): number {
	const t = s.trim();
	if (!t) return Number.NaN;
	return Number.parseFloat(t.replace(/\./g, "").replace(",", "."));
}

/**
 * Parse one DIAE precios CSV into month points across BOTH year columns.
 * Pure function — the unit-test seam.
 *
 * Column quirk (live-verified 2026-09-07): Jasper's CSV export shifts the
 * header against the data rows — year labels sit at cols 3/7 while the
 * CURRENT-year values land at col 4 and the previous-year values at col 7.
 * Header-index parsing silently drops the current year, so values are taken
 * by COLUMN DISCOVERY instead: the (at most two) columns that carry
 * numeric cells across month rows, left = newer year, right = previous
 * year (the report renders years descending, and the previous year is the
 * fully-covered column). Anything but exactly two columns is drift → [].
 */
export function parseInacPreciosCsv(text: string): InacPricePoint[] {
	const lines = text.trim().split(/\r?\n/);
	if (lines.length < 2) return [];

	// Years come from the header labels (descending order below).
	const years: number[] = [];
	for (const line of lines) {
		for (const f of splitCsvLine(line)) {
			const m = f.trim().match(/^(\d{4})\s*\(USD\/Kg\)$/i);
			if (m) years.push(Number.parseInt(m[1], 10));
		}
		if (years.length >= 2) break;
	}
	if (years.length < 2) return [];
	years.sort((a, b) => b - a);

	// Month rows first (junk header / "Fuente" footer have no month name).
	const monthRows: Array<{ month: number; fields: string[] }> = [];
	for (const line of lines) {
		const fields = splitCsvLine(line);
		const name = fields.map((f) => f.trim().toLowerCase()).find((f) => MONTHS[f] !== undefined);
		if (name) monthRows.push({ month: MONTHS[name], fields });
	}
	if (monthRows.length === 0) return [];

	// Numeric cell at a column, or null. "%" cells (variación) are excluded
	// before numeric parsing — parseFloat would happily read "29,47%".
	const numericAt = (fields: string[], i: number): number | null => {
		const t = fields[i]?.trim() ?? "";
		if (!t || t.endsWith("%")) return null;
		const v = parseEsNumber(t);
		return Number.isFinite(v) && v > 0 ? v : null;
	};

	const width = Math.max(...monthRows.map((r) => r.fields.length));
	const valueCols: number[] = [];
	for (let i = 0; i < width; i++) {
		if (monthRows.some((r) => numericAt(r.fields, i) !== null)) valueCols.push(i);
	}
	if (valueCols.length !== 2) return []; // drift: not exactly the two year columns

	const [newerCol, olderCol] = valueCols;
	const points: InacPricePoint[] = [];
	for (const r of monthRows) {
		const newer = numericAt(r.fields, newerCol);
		const older = numericAt(r.fields, olderCol);
		if (newer !== null) {
			points.push({ date: new Date(Date.UTC(years[0], r.month - 1, 1)), valueUsdKg: newer });
		}
		if (older !== null) {
			points.push({ date: new Date(Date.UTC(years[1], r.month - 1, 1)), valueUsdKg: older });
		}
	}
	return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Latest published year from the service (falls back to the wall clock). */
async function latestYear(): Promise<number> {
	try {
		const res = await scraperFetch(`${SERVICE_URL}?cmdaction=datosiniciales&app=precios`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "MT/1.0 (beef price platform data ingestion)",
			},
			timeoutMs: 15_000,
			retries: 1,
		});
		if (!res.ok) return new Date().getUTCFullYear();
		const data = (await res.json()) as { status?: number; maxAno?: number };
		return data.status === 0 && typeof data.maxAno === "number"
			? data.maxAno
			: new Date().getUTCFullYear();
	} catch {
		return new Date().getUTCFullYear();
	}
}

async function fetchInacPrecios(): Promise<ScraperResult> {
	const maxAno = await latestYear();

	// Stride-2 ladder: ano=Y carries Y and Y-1 columns.
	const anos: number[] = [];
	for (let k = 0; k < LOOKBACK_YEARS; k += 2) anos.push(maxAno - k);

	const commodity = await ensureCommodity({
		slug: SLUG_NOVILLO,
		name: "Uruguay Fat Steers Live Weight (Novillo Gordo en pie)",
		nameCn: "乌拉圭育肥牛活重价（Novillo Gordo）",
		category: "livestock",
		unit: "USD/kg",
		metadata: {
			seriesId: "INAC-DIAE:precios:categoria=1:tipoprecio=1",
			reportUrl: SERVICE_URL,
			definition:
				"Uruguay fat steers (novillos gordos) live-weight price, USD/kg, monthly average (INAC DIAE)",
			caliberNote:
				"活重（en pie）口径，非胴体（en gancho）价，与 beef_carcass_us（IMF 月度）对比时注意口径差异；乌拉圭官方序列。",
		},
	});

	let inserted = 0;
	let updated = 0;
	for (const ano of anos) {
		const res = await scraperFetch(
			`${SERVICE_URL}?cmdaction=precios&format=CSV&ano=${ano}&categoria=1&tipoprecio=1`,
			{
				headers: {
					Accept: "text/csv",
					"User-Agent": "MT/1.0 (beef price platform data ingestion)",
				},
				timeoutMs: 20_000,
				retries: 2,
			},
		);
		if (!res.ok) {
			logger.warn(`[INAC] year ${ano} CSV returned HTTP ${res.status}`);
			continue;
		}

		const points = parseInacPreciosCsv(await res.text());
		if (points.length === 0) {
			// One empty year in the ladder is tolerable (pre-history); every
			// year empty means drift — surfaced by the 0-row warning below.
			logger.warn(`[INAC] year ${ano} parsed 0 rows — pre-history or schema drift?`);
			continue;
		}

		for (const p of points) {
			// Flat candle for a monthly point average (fred monthly precedent).
			const r = await upsertPrice({
				commodityId: commodity.id,
				date: p.date,
				interval: "monthly",
				source: SOURCE_ID,
				open: p.valueUsdKg,
				high: p.valueUsdKg,
				low: p.valueUsdKg,
				close: p.valueUsdKg,
				volume: null,
				metadata: {
					report: "Precios de Novillos gordos en pie",
					unidad: "USD/Kg vivo",
					anoQueried: ano,
				},
			});
			inserted += r.inserted;
			updated += r.updated;
		}
	}

	// Monthly series on the daily cycle: rows parsed, zero writes = confirmed
	// unchanged (upsertPrice's samePrice no-op), not a silent failure.
	const noChange = inserted + updated === 0;
	logger.info(
		`[INAC] novillo_gordo_uy ladder ${anos[0]}..${anos[anos.length - 1]} → ${noChange ? "unchanged" : `${inserted} inserted, ${updated} updated`}`,
	);
	return noChange ? { inserted, updated, noChange: true } : { inserted, updated };
}

export const inacScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchInacPrecios,
};
