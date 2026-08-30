/**
 * USDA AMS NW_LS421 — Import Beef Trade (weekly, keyless PDF)
 *
 * The weekly US import benchmark for manufacturing beef: price ranges for
 * Bull/Cow meat (95/90% lean) and trimmings from Australia/NZ and South
 * America, per cwt F.O.B/T.I.S. by coast and delivery window. The canonical
 * series we persist is AU/NZ Cow Meat 90% (the "90CL" import benchmark) East
 * Coast 0-15 days — the same market the MLA 90CL indicator and the World Bank
 * Pink Sheet's (since 2024-01) "New Zealand 90CL c.i.f. US East Coast" monthly
 * beef series draw on, at weekly resolution.
 *
 * Carrier forensics (round-149, V7 批1): MLA's own 90CL page embeds a Power BI
 * report (app.nlrsreports.mla.com.au) whose data sits behind a Power BI embed
 * token — not programmatically fetchable without a browser. This official AMS
 * report is the primary upstream, keyless, on a host this machine can reach
 * (mymarketnews/marsapi hosts are egress-blocked here; www.ams.usda.gov is
 * not). URL is stable: the mnreports PDF always holds the CURRENT week, so
 * history accrues one point per weekly run — no backfill exists on this host.
 *
 * Host prerequisite: `pdftotext` (poppler-utils) on PATH — single-machine PM2
 * deployment, same ops model as the systemd PostgreSQL/Redis deps.
 *
 * Weekly series stay OUT of prediction scheduling by construction: the
 * subscription gates match interval daily / (monthly and not daily) only
 * (predictionCache.ts), so ADR-0001's horizon=step semantics never see a
 * weekly series. Data + display only.
 */

import { spawn } from "node:child_process";
import { logger } from "@/lib";
import { ensureCommodity, upsertPrice } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const REPORT_URL = "https://www.ams.usda.gov/mnreports/ams_2823.pdf";
const SOURCE_ID = "usda_import_beef";
export const SLUG_90CL = "beef_90cl_us";

/** One quoted row: a named lean item with an East (and optional West) coast
 * price range inside one origin section × delivery window. */
export interface ImportBeefQuote {
	origin: "australia_nz" | "south_america";
	window: "0-15" | "16-45";
	item: string; // e.g. "Cow Meat (90%)"
	leanPct: number;
	eastLow: number;
	eastHigh: number;
	westLow: number | null;
	westHigh: number | null;
}

export interface ImportBeefReport {
	/** Report date (MM/DD/YYYY "Report for:" line), UTC midnight. Null when the
	 * line is missing — the fetch path refuses to write without it. */
	date: Date | null;
	quotes: ImportBeefQuote[];
}

/** Item label + optional second (West Coast) range, e.g.
 *  "Cow Meat (90%)      342.00 - 354.00" or "... 342.00 - 354.00  346.00 - 350.00" */
const QUOTE_ROW =
	/^(Bull Meat|Cow Meat|CFM Fores|Beef Trim) \((\d+)%\)\s+(\d+\.\d{2})\s*-\s*(\d+\.\d{2})(?:\s+(\d+\.\d{2})\s*-\s*(\d+\.\d{2}))?\s*$/;

/**
 * Parse `pdftotext -layout` output of the NW_LS421 weekly report into
 * structured quotes. Pure function — the unit-test seam for layout drift.
 * State machine over section headers; page breaks repeat the report header
 * and (once) split a section header from its rows, which a per-line scan
 * tolerates naturally.
 */
export function parseImportBeefReport(text: string): ImportBeefReport {
	const report: ImportBeefReport = { date: null, quotes: [] };
	let origin: ImportBeefQuote["origin"] | null = null;
	let delivery: "0-15" | "16-45" | null = null;

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;

		const dateMatch = line.match(/^Report for:\s*(\d{2})\/(\d{2})\/(\d{4})/);
		if (dateMatch) {
			const d = new Date(`${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}T00:00:00Z`);
			if (!Number.isNaN(d.getTime())) report.date = d;
			continue;
		}

		if (/Australia\s*\/\s*New Zealand/.test(line)) {
			origin = "australia_nz";
			continue;
		}
		if (/South America/.test(line)) {
			origin = "south_america";
			continue;
		}
		if (/0-15 Days/.test(line)) {
			delivery = "0-15";
			continue;
		}
		if (/16-45 Days/.test(line)) {
			delivery = "16-45";
			continue;
		}

		const m = line.match(QUOTE_ROW);
		if (m && origin && delivery) {
			const eastLow = Number.parseFloat(m[3]);
			const eastHigh = Number.parseFloat(m[4]);
			if (eastLow > eastHigh) continue; // malformed range — drop the row
			report.quotes.push({
				origin,
				window: delivery,
				item: `${m[1]} (${m[2]}%)`,
				leanPct: Number.parseInt(m[2], 10),
				eastLow,
				eastHigh,
				westLow: m[5] ? Number.parseFloat(m[5]) : null,
				westHigh: m[6] ? Number.parseFloat(m[6]) : null,
			});
		}
	}

	return report;
}

/**
 * PDF bytes → layout text via `pdftotext -layout - -` (stdin/stdout pipes, no
 * temp file). Throws on missing binary (actionable ENOENT message) or non-zero
 * exit; callers treat that as a failed cycle, never a partial write.
 */
export function extractPdfText(pdf: Buffer): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("pdftotext", ["-layout", "-", "-"]);
		const stdout: Buffer[] = [];
		let stderr = "";
		const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);

		child.on("error", (err) => {
			clearTimeout(timer);
			reject(
				err instanceof Error && "code" in err && err.code === "ENOENT"
					? new Error("pdftotext not found on PATH — install poppler-utils")
					: err,
			);
		});
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"));
			else reject(new Error(`pdftotext exited ${code}: ${stderr.trim()}`));
		});

		child.stdin.on("error", () => {}); // EPIPE if child dies early — close event handles it
		child.stdin.end(pdf);
	});
}

/** The canonical 90CL row: AU/NZ spot window, East Coast delivery. */
function canonical90cl(quotes: ImportBeefQuote[]): ImportBeefQuote | undefined {
	return quotes.find(
		(q) => q.origin === "australia_nz" && q.window === "0-15" && q.item === "Cow Meat (90%)",
	);
}

async function fetchImportBeef(): Promise<ScraperResult> {
	const res = await scraperFetch(REPORT_URL, {
		headers: {
			Accept: "application/pdf",
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
		},
		timeoutMs: 30_000,
		retries: 1,
	});
	if (!res.ok) {
		logger.warn(`[USDA_IMPORT_BEEF] report fetch returned HTTP ${res.status}`);
		return { inserted: 0, updated: 0 };
	}

	const pdf = Buffer.from(await res.arrayBuffer());
	if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
		logger.warn("[USDA_IMPORT_BEEF] response is not a PDF — layout change?");
		return { inserted: 0, updated: 0 };
	}

	const report = parseImportBeefReport(await extractPdfText(pdf));
	if (!report.date) {
		logger.warn("[USDA_IMPORT_BEEF] no 'Report for:' date line — refusing to write");
		return { inserted: 0, updated: 0 };
	}
	const q = canonical90cl(report.quotes);
	if (!q) {
		// All-or-nothing: the one series this source owns must be present and
		// parseable, else the report layout drifted and ANY write would risk
		// being wrong-shaped. 0 rows → run classifies as warning (freshness
		// board surfaces it), never as healthy silence.
		logger.warn(
			`[USDA_IMPORT_BEEF] canonical AU/NZ 0-15 Cow Meat (90%) row missing (parsed ${report.quotes.length} quotes) — layout drift, no write`,
		);
		return { inserted: 0, updated: 0 };
	}

	// Weekly range quote → flat candle: close/open = range midpoint, low/high
	// carry the quoted range. The quote nature stays traceable via metadata.
	const mid = (q.eastLow + q.eastHigh) / 2;

	const commodity = await ensureCommodity({
		slug: SLUG_90CL,
		name: "US Imported 90CL Beef (AU/NZ, East Coast)",
		nameCn: "美国进口 90CL 牛肉（澳/新 · 东岸）",
		category: "proteins",
		unit: "USD/cwt",
		metadata: {
			seriesId: "NW_LS421",
			reportUrl: REPORT_URL,
			definition:
				"US import price, Australia/New Zealand manufacturing cow beef, 90% chemical lean, East Coast delivery, per cwt F.O.B/T.I.S., weekly (USDA AMS NW_LS421)",
			// 口径注记 (V7 批1): the monthly IMF/世行 benchmark (beef_carcass_us)
			// switched to "New Zealand 90CL c.i.f. US East Coast" from 2024-01 —
			// same underlying market as this weekly series but different wording
			// (c.i.f. vs F.O.B/T.I.S.) and a splice-broken pre-2024 history;
			// never merge the two into one continuous series.
			caliberNote:
				"与 beef_carcass_us（IMF 月度基准）并排对比时注意：世行序列 2024-01 起为新西兰 90CL c.i.f. 美东，此前口径不同不可拼接；本序列为 USDA 周度 F.O.B/T.I.S. 报价区间中值。",
		},
	});

	const result = await upsertPrice({
		commodityId: commodity.id,
		date: report.date,
		interval: "weekly",
		source: SOURCE_ID,
		open: mid,
		high: q.eastHigh,
		low: q.eastLow,
		close: mid,
		volume: null,
		metadata: {
			reportId: "NW_LS421",
			mnreportsId: 2823,
			item: q.item,
			origin: "Australia/New Zealand",
			deliveryWindow: "0-15 days",
			coast: "East Coast",
			basis: "Per CWT, F.O.B/T.I.S.",
			quote: "weekly range midpoint",
			rangeLow: q.eastLow,
			rangeHigh: q.eastHigh,
			westCoast: q.westLow != null ? `${q.westLow}-${q.westHigh}` : null,
		},
	});

	// Reaching here means the PDF fetched, the canonical row parsed, and the
	// write path ran — a 0/0 result can only be upsertPrice's samePrice no-op
	// (the report is weekly; this source rides the daily cycle). Report it as
	// confirmed-unchanged so the freshness board keeps `healthy`.
	const noChange = result.inserted === 0 && result.updated === 0;
	logger.info(
		`[USDA_IMPORT_BEEF] 90CL ${report.date.toISOString().slice(0, 10)} ${q.eastLow}-${q.eastHigh} → ${noChange ? "unchanged" : `${result.inserted} inserted, ${result.updated} updated`}`,
	);
	return noChange ? { ...result, noChange: true } : result;
}

export const usdaImportBeefScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchImportBeef,
};
