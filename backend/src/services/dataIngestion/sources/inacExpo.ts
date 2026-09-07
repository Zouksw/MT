/**
 * INAC eDIAE exports — Uruguay fine-grained official export stats (round-162
 * 批1; research: docs/RESEARCH-BEEF-TRADE-DATA-SOURCES.md §乌拉圭 INAC)
 *
 * The eDIAE interactive app behind www.inac.uy/inac/diae/ posts to
 * /inac/DIAEUtils (the same service the revived inac source uses for prices).
 * Its expo sub-app exposes two lanes this source lands:
 *
 *  Lane A — official UY→China monthly bovine FOB value (exportaciones-query3):
 *   pais="REPÚBLICA POPULAR CHINA " (note the trailing space — the server's
 *   own dropdown value), apertura=Pais, n1="Carne bovina". USD thousands,
 *   "Cifras primarias" (official preliminary, revised in place later — the
 *   re-scan window catches revisions). Fills the comtrade_mirror's UY hole
 *   (UY reports monthly HS detail to Comtrade so sparsely the mirror's UY→CN
 *   rows are nearly empty). Value-only: eDIAE publishes no per-country
 *   tonnage, so no unit price is derived here — registered gap.
 *
 *  Lane B — cut-family FOB unit prices, worldwide (exportaciones-query4):
 *   n1="Carne bovina" → n2="Refrigerada" (INAC's fresh-meat branch — despite
 *   the name it CONTAINS the frozen bulk) → n3 ∈ {Congelada, Enfriada} →
 *   n4='' cascades every cut family with USD(mil) AND Peso-Embarque tonnes →
 *   USD/kg per family (kUSD ÷ t = USD/kg exactly). This resurrects the old
 *   BeefCutPrice-era INAC cut semantics at the family level. Destination is
 *   NOT a query4 dimension — cut×destination cross stays a registered gap.
 *   (The "Producto carnico bovino" n2 branch is a small prepared-products
 *   subtree, deliberately NOT scanned.)
 *
 * Contract traps (live-verified 2026-09-07, pinned by tests):
 *  - Responses are server-rendered JS snippets: $('#reportplace').html('…')
 *    with \n \' \" escapes around a JasperReports HTML table; ALL pages of a
 *    report arrive in ONE response. An empty marker (html('')) is FLAKY, not
 *    semantic — an immediate retry usually recovers (application-level retry,
 *    scraperFetch only retries transport errors).
 *  - query4 needs every drill param present, n4='' explicitly — omitting n4
 *    made the server return the empty marker consistently.
 *  - query4 titles carry the served month ("Mes 7/2026."); a mismatch with the
 *    requested month means the server ignored the params — refuse the rows.
 *    query3 has no month in its title; its "YYYY - USD(mil)" header column is
 *    checked against the requested year instead.
 *  - Numbers use dot thousands separators ("193.021"), optional comma decimals.
 *  - Freshness: datosiniciales(app=expo) reports {maxAno, maxMes} (2026-07 on
 *    2026-09-07 — T+1). The scan never asks past that bound.
 */

import { logger } from "@/lib";
import { parseMonth, upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const SERVICE_URL = "https://www.inac.uy/inac/DIAEUtils";
const SOURCE_ID = "inac_expo";

/** Rolling window the daily run re-scans (revisions + fresh months). */
export const DAILY_LOOKBACK_MONTHS = 3;
/** One-time backfill depth. */
export const BACKFILL_MONTHS = 37;
/** Lane B process drills: INAC n3 value → process tag in the type. */
export const PROCESS_DRILLS = [
	{ n3: "Congelada", process: "frozen" },
	{ n3: "Enfriada", process: "chilled" },
] as const;

const MS_BETWEEN_REQUESTS = 1200;
/** eDIAE serves an empty-table marker transiently — retry before giving up. */
const EMPTY_RETRIES = 2;

/** INAC n4 cut-family vocabulary → stable slug for the factor type. */
export const CUT_SLUGS: Record<string, string> = {
	"Canal, media canal, cuarto compensado, cuarto combinado con hueso": "carcass_bone_in",
	"Canal, media canal, cuarto compensado, cuarto combinado sin hueso": "carcass_boneless",
	"Carnes chicas": "thin_cuts",
	"Cuarto o corte del delantero con hueso": "forequarter_bone_in",
	"Cuarto o corte del delantero sin hueso": "forequarter_boneless",
	"Cuarto o corte del trasero con hueso": "hindquarter_bone_in",
	"Cuarto o corte del trasero sin hueso": "hindquarter_boneless",
	"Otras carnes con hueso": "other_bone_in",
	"Otras carnes sin hueso": "other_boneless",
	Generico: "generic",
};

/** Cascade/aggregate labels that share the leaf row shape — never cut rows. */
const NON_LEAF_LABELS = new Set([
	"Carne bovina",
	"Producto carnico bovino",
	"Refrigerada",
	"Congelada",
	"Enfriada",
	"Congelado",
	"Enfriado",
	"Cocido-congelado",
	"Conserva",
	"Humedad controlada",
	"TOTAL GENERAL",
]);

const CHINA_LABEL = "REPÚBLICA POPULAR CHINA";

/** Parse "193.021" / "1.234,56" (dot thousands, comma decimals) → number. */
export function parseEsNumber(raw: string): number {
	const normalized = raw.trim().replace(/\./g, "").replace(",", ".");
	const n = Number.parseFloat(normalized);
	return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Unescape the $('#reportplace').html('…')[; trailing JS] wrapper into plain
 * HTML. Inside the literal every quote is backslash-escaped, so the first
 * raw `');` after the opening IS the terminator (fixtures end with
 * `');doNextPage=false;`).
 */
export function unwrapReportScript(script: string): string {
	const open = script.indexOf(".html('");
	if (open === -1) return "";
	const start = open + ".html('".length;
	const end = script.indexOf("');", start);
	const escaped = end === -1 ? script.slice(start) : script.slice(start, end);
	return escaped
		.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
		.replace(/\\n/g, "\n")
		.replace(/\\'/g, "'")
		.replace(/\\"/g, '"');
}

export interface TableRow {
	label: string;
	numbers: number[];
}

/** Extract label + numeric cells from the unwrapped JasperReports HTML. Pure. */
export function parseExpoTable(script: string): TableRow[] {
	if (!script.includes("html('")) return [];
	const html = unwrapReportScript(script);
	const rows: TableRow[] = [];
	for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
		const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
			m[1]
				.replace(/<[^>]+>/g, " ")
				.replace(/&nbsp;/g, " ")
				.replace(/&amp;/g, "&")
				.trim(),
		);
		const label = cells.find((c) => c.length > 0 && !/^[+-]?[\d.,\s]+$/.test(c));
		if (!label) continue;
		const numbers = cells
			.filter((c) => /^[\d.,]+$/.test(c))
			.map(parseEsNumber)
			.filter((n) => Number.isFinite(n) && n >= 0);
		rows.push({ label, numbers });
	}
	return rows;
}

export interface ChinaMonthly {
	/** Requested month's bovine FOB exports to China, USD thousands. */
	usdThousands: number;
	/** Jan–requested-month cumulative of the same year, USD thousands. */
	ytdUsdThousands: number;
}

/**
 * Lane A parse: the China row carries [curMonth, curYTD, prevMonth, prevYTD]
 * in USD thousands. `year` guards the response's "YYYY - USD(mil)" header —
 * a mismatch means the server served a different year than asked.
 */
export function parseChinaMonthly(script: string, year: number): ChinaMonthly | null {
	if (!script.includes("html('")) return null;
	const html = unwrapReportScript(script);
	const headerYear = Number(/(\d{4})\s*-\s*USD\(mil\)/.exec(html)?.[1]);
	if (headerYear !== year) return null;

	for (const row of parseExpoTable(script)) {
		if (!row.label.startsWith(CHINA_LABEL) || row.numbers.length < 2) continue;
		if (row.label.startsWith("Total")) continue;
		const [usdThousands, ytdUsdThousands] = row.numbers;
		if (!usdThousands || usdThousands <= 0) return null;
		return { usdThousands, ytdUsdThousands };
	}
	return null;
}

export interface CutRow {
	slug: string;
	cutEs: string;
	usdThousands: number;
	tonnes: number;
	/** Families outside the pinned vocabulary — logged, never landed. */
	unknown: false;
}
export interface UnknownRow {
	label: string;
	unknown: true;
}

/**
 * Lane B parse: leaf rows are the n4 cut families (2 numbers: USD thousands,
 * shipment tonnes). `month` guards the title ("Mes 7/2026.") against the
 * server ignoring the requested month.
 */
export function parseCutRows(
	script: string,
	year: number,
	month: number,
): Array<CutRow | UnknownRow> | null {
	if (!script.includes("html('")) return null;
	const html = unwrapReportScript(script);
	const titleMonth = /Mes\s*(\d{1,2})\/(\d{4})/.exec(html);
	if (!titleMonth) return null;
	if (Number(titleMonth[2]) !== year || Number(titleMonth[1]) !== month) return null;

	const out: Array<CutRow | UnknownRow> = [];
	for (const row of parseExpoTable(script)) {
		if (row.label.startsWith("Fuente")) continue;
		if (NON_LEAF_LABELS.has(row.label)) continue;
		if (row.numbers.length < 2) continue;
		const [usdThousands, tonnes] = row.numbers;
		if (usdThousands <= 0 || tonnes <= 0) continue;

		const slug = CUT_SLUGS[row.label];
		if (slug) out.push({ slug, cutEs: row.label, usdThousands, tonnes, unknown: false });
		else out.push({ label: row.label, unknown: true });
	}
	return out;
}

/** Build a DIAEUtils GET query with %20 spaces (the app's own encoding). */
export function diaeUrl(params: Record<string, string | number>): string {
	const q = Object.entries(params)
		.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
		.join("&");
	return `${SERVICE_URL}?${q}`;
}

async function fetchReport(url: string): Promise<string | null> {
	for (let attempt = 0; attempt <= EMPTY_RETRIES; attempt++) {
		if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
		try {
			const res = await scraperFetch(url, {
				headers: {
					Accept: "text/javascript, text/html, */*",
					"User-Agent": "MT/1.0 (beef price platform data ingestion)",
				},
				timeoutMs: 30_000,
				retries: 1,
			});
			if (!res.ok) {
				logger.warn(`[INAC_EXPO] HTTP ${res.status} on ${url.slice(-80)}`);
				continue;
			}
			const text = await res.text();
			// Flaky empty marker — retry (usually recovers on the next hit).
			if (text.includes("html('')")) continue;
			if (!text.includes("html('")) {
				logger.warn("[INAC_EXPO] unexpected response shape (no html wrapper)");
				return null;
			}
			return text;
		} catch (err) {
			logger.warn(
				`[INAC_EXPO] fetch failed (attempt ${attempt}): ${err instanceof Error ? err.message : err}`,
			);
		}
	}
	return null;
}

interface MonthSpec {
	year: number;
	month: number;
}

async function fetchMaxPeriod(): Promise<MonthSpec | null> {
	try {
		const res = await scraperFetch(diaeUrl({ cmdaction: "datosiniciales", app: "expo" }), {
			headers: { Accept: "application/json", "User-Agent": "MT/1.0 (data ingestion)" },
			timeoutMs: 20_000,
			retries: 2,
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { maxAno?: number; maxMes?: number; status?: number };
		if (body.status !== 0 || !body.maxAno || !body.maxMes) return null;
		return { year: body.maxAno, month: body.maxMes };
	} catch {
		return null;
	}
}

/** Months from (now − monthsLookback) up to maxAno/maxMes, oldest first. */
export function monthWindow(now: Date, monthsLookback: number, max: MonthSpec): MonthSpec[] {
	const out: MonthSpec[] = [];
	const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsLookback, 1));
	const end = Date.UTC(max.year, max.month - 1, 1);
	while (cur.getTime() <= end) {
		out.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() + 1 });
		cur.setUTCMonth(cur.getUTCMonth() + 1);
	}
	return out;
}

export async function runInacExpo(monthsLookback: number): Promise<ScraperResult> {
	const max = await fetchMaxPeriod();
	if (!max) {
		logger.warn("[INAC_EXPO] datosiniciales unavailable — skipping run");
		return { inserted: 0, updated: 0 };
	}

	const months = monthWindow(new Date(), monthsLookback, max);
	let inserted = 0;
	let updated = 0;
	let parsedRows = 0;
	let firstRequest = true;
	const sleep = () => new Promise((r) => setTimeout(r, MS_BETWEEN_REQUESTS));

	// Lane A — UY→CN bovine monthly FOB value.
	for (const m of months) {
		if (!firstRequest) await sleep();
		firstRequest = false;
		const url = diaeUrl({
			cmdaction: "exportaciones-query3",
			fromyear: m.year,
			frommonth: m.month,
			n1: "Carne bovina",
			pais: "REPÚBLICA POPULAR CHINA ",
			mercado: "",
			apertura: "Pais",
			desglozar: 0,
			mostrar: -1,
			width: 900,
		});
		const script = await fetchReport(url);
		if (!script) continue;
		const row = parseChinaMonthly(script, m.year);
		if (!row) continue;

		const date = parseMonth(`${m.year}${String(m.month).padStart(2, "0")}`);
		if (!date) continue;
		parsedRows++;
		const r = await upsertFactor({
			type: "export_fob_inac_bovina",
			region: "UY→CN",
			date,
			// USD thousands → USD millions (matches export_fob_carnes family).
			value: Math.round((row.usdThousands / 1000) * 1e6) / 1e6,
			unit: "USD M",
			source: SOURCE_ID,
			metadata: {
				freq: "M",
				period: `${m.year}-${String(m.month).padStart(2, "0")}`,
				usdThousands: row.usdThousands,
				ytdUsdThousands: row.ytdUsdThousands,
				currency: "USD",
				basis: "FOB-USD (Uruguay INAC eDIAE, Carne bovina, Cifras primarias)",
			},
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	// Lane B — cut-family FOB unit prices per process, worldwide.
	for (const m of months) {
		for (const drill of PROCESS_DRILLS) {
			if (!firstRequest) await sleep();
			firstRequest = false;
			const url = diaeUrl({
				cmdaction: "exportaciones-query4",
				fromyear: m.year,
				frommonth: m.month,
				n1: "Carne bovina",
				n2: "Refrigerada",
				n3: drill.n3,
				n4: "",
				width: 900,
			});
			const script = await fetchReport(url);
			if (!script) continue;
			const rows = parseCutRows(script, m.year, m.month);
			if (!rows) continue;

			const date = parseMonth(`${m.year}${String(m.month).padStart(2, "0")}`);
			if (!date) continue;
			for (const row of rows) {
				if (row.unknown) {
					logger.warn(`[INAC_EXPO] unmapped cut family "${row.label}" — skipped`);
					continue;
				}
				parsedRows++;
				const r = await upsertFactor({
					type: `export_fob_cut_uy_${drill.process}_${row.slug}`,
					region: "UY→WORLD",
					date,
					// kUSD ÷ t = USD/kg. Decimal(18,6) scale — comtradeMirror note.
					value: Math.round((row.usdThousands / row.tonnes) * 1e6) / 1e6,
					unit: "USD/kg",
					source: SOURCE_ID,
					metadata: {
						freq: "M",
						period: `${m.year}-${String(m.month).padStart(2, "0")}`,
						usdThousands: row.usdThousands,
						tonnes: row.tonnes,
						process: drill.process,
						cutEs: row.cutEs,
						currency: "USD",
						basis: "FOB-USD/kg product weight (INAC eDIAE query4, all destinations)",
					},
				});
				inserted += r.inserted;
				updated += r.updated;
			}
		}
	}

	const noChange = parsedRows > 0 && inserted + updated === 0;
	logger.info(
		`[INAC_EXPO] ${months.length} months × (1 CN + 2 cut drills) → ${parsedRows} rows → ${noChange ? "unchanged" : `${inserted} inserted, ${updated} updated`} (max period ${max.year}-${max.month})`,
	);
	return noChange ? { inserted, updated, noChange: true } : { inserted, updated };
}

async function fetchInacExpo(): Promise<ScraperResult> {
	return runInacExpo(DAILY_LOOKBACK_MONTHS);
}

export const inacExpoScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchInacExpo,
};
