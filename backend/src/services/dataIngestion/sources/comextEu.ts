/**
 * Eurostat Comext EU mirror — monthly beef trade flows to China (round-161
 * 批1; research: docs/RESEARCH-BEEF-TRADE-DATA-SOURCES.md §9.1, round-160)
 *
 * The EU's China-approved beef suppliers (IE/NL/FR/PL…) report monthly CN8
 * detail to Comext LONG before those flows show up in Comtrade's EU monthly
 * reporting. This source adds the EU lane the comtrade_mirror cannot cover,
 * keyless (DS-045409, anonymous access, T+~6 weeks verified 2026-09-07).
 *
 * 口径 (deliberate, never merge): Comext values are EU-REPORTED FOB in EUR.
 * comtrade_mirror rows are partner-reported FOB in USD. They get different
 * factor types (export_eu_to_cn_* vs export_to_cn_*) and the read side
 * carries an explicit currency field — the two lanes sit side by side for
 * cross-checking, never merged into one series (round-160 §9.1 design).
 *
 * API contract traps (all live-verified 2026-09-07, pinned by tests):
 *  - The old `/sale/` path is dead; the endpoint is
 *    /api/comext/dissemination/statistics/1.0/data/ds-045409.
 *  - Multi-value on `indicators` SILENTLY collapses the dimension to size 0
 *    (empty values) — one indicator per query. Multi-value on `product`
 *    triggers 413 async queuing — one product per query too.
 *  - Time ranges work: sinceTimePeriod/untilTimePeriod covers the whole
 *    backfill in ONE request (43-month dimension verified) — request count is
 *    constant regardless of lookback depth.
 *  - Every dimension except `time` is singleton per query, so the JSON-stat
 *    flat value index equals the time index — no stride decoding needed.
 *  - QUANTITY_IN_100KG × 100 = kg; months with no trade are simply absent
 *    from `value` (never zero-filled).
 *
 * Reality note (2026-09-07 probe): current EU→CN beef flow is small and
 * concentrated in Ireland (9 of 11 recent months; NL/PL near-zero, FR
 * episodic). The lane is registered for completeness — EU approval lists
 * change and the read side surfaces regions honestly as data appears.
 */

import { logger } from "@/lib";
import { parseMonth, upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";
import { HS_CODES } from "./comtradeMirror";

const API_BASE =
	"https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/ds-045409";
const SOURCE_ID = "comext_eu";

/** EU member states approved to export beef to China (reporter = ISO2). */
export const EU_REPORTERS = ["IE", "NL", "FR", "PL"] as const;

/**
 * CN8 codes with verified EU→CN flow — the cut-level product mix inside the
 * HS6 frozen lanes (round-162 批2). Codes + labels are the API's own product
 * dimension, probed live 2026-09-07 (IE→CN, 2024-01..2026-06 window):
 * 02023050 → 4 obs, 02023090 → 27 obs (the bulk), 02022090 → 1 obs,
 * 02022010 → valid but zero flow so far. The candidate codes 02023011/19/30
 * and 02023060 do NOT exist in DS-045409's product dimension (no label, no
 * size) — do not re-add them from the CN nomenclature spec alone.
 */
export const CN8_CODES = ["02022010", "02022090", "02023050", "02023090"] as const;

/** API product-dimension labels, embedded for read-side 口径 display. */
export const CN8_LABELS: Record<(typeof CN8_CODES)[number], string> = {
	"02022010": "Frozen compensated bovine quarters, bone in",
	"02022090": "Frozen bovine cuts, bone in (other)",
	"02023050": "Frozen bovine boneless crop, chuck and blade and brisket cuts",
	"02023090": "Frozen bovine boneless meat (other)",
};

/** Every product this source sweeps: HS lanes + the CN8 mix. */
const ALL_PRODUCTS = [...HS_CODES, ...CN8_CODES] as string[];

/** Rolling window the daily run re-scans (revision catch + fresh months). */
export const DAILY_LOOKBACK_MONTHS = 3;
/** One-time backfill depth — one range query per lane, same request count. */
export const BACKFILL_MONTHS = 37;

const MS_BETWEEN_REQUESTS = 1200;

const VALUE_INDICATOR = "VALUE_IN_EUROS";
const QTY_INDICATOR = "QUANTITY_IN_100KG";

/** Minimal JSON-stat 2.0 shape this source consumes. */
export interface JsonStatDataset {
	value?: Record<string, number>;
	id?: string[];
	size?: number[];
	dimension?: {
		time?: { category?: { index?: Record<string, number> } };
	};
	error?: unknown;
}

export interface ParsedEuRow {
	type: string;
	region: string;
	date: Date;
	/** Unit value, EUR/ton (valueEur ÷ quantity-in-t). */
	value: number;
	unit: "EUR/ton";
	metadata: Record<string, unknown>;
}

/**
 * Decode a single-indicator JSON-stat body into period→number. Pure — the
 * test seam for the flat-index-equals-time-index contract and malformed
 * payloads (missing time index, non-numeric values) which return {}.
 */
export function decodeJsonStat(body: JsonStatDataset): Map<string, number> {
	const out = new Map<string, number>();
	const index = body?.dimension?.time?.category?.index;
	const values = body?.value;
	if (!index || !values || typeof body.size?.[body.size.length - 1] !== "number") return out;

	const periodByFlatIndex = new Map<number, string>();
	for (const [period, flatIndex] of Object.entries(index)) {
		periodByFlatIndex.set(flatIndex, period);
	}
	for (const [flatIndex, raw] of Object.entries(values)) {
		const period = periodByFlatIndex.get(Number(flatIndex));
		const num = typeof raw === "number" ? raw : Number(raw);
		if (!period || !Number.isFinite(num)) continue;
		out.set(period, num);
	}
	return out;
}

/** Join one lane's value+quantity maps into upsert payloads. Pure. */
export function parseComextSeries(
	valueByPeriod: Map<string, number>,
	qtyByPeriod: Map<string, number>,
	reporterIso: string,
	productCode: string,
	/** CN8 lanes carry the API product label for 口径 display. */
	productLabel?: string,
): ParsedEuRow[] {
	const out: ParsedEuRow[] = [];
	for (const [period, valueEur] of valueByPeriod) {
		const qtyHundredKg = qtyByPeriod.get(period);
		if (!qtyHundredKg || qtyHundredKg <= 0 || !valueEur || valueEur <= 0) continue;

		const date = parseMonth(period.replace("-", ""));
		if (!date || Number.isNaN(date.getTime())) continue;

		const quantityKg = qtyHundredKg * 100;
		out.push({
			type: `export_eu_to_cn_${productCode}`,
			region: `${reporterIso}→CN`,
			date,
			// Decimal(18,6) scale — see the comtradeMirror rounding note.
			value: Math.round((valueEur / (quantityKg / 1000)) * 1e6) / 1e6,
			unit: "EUR/ton",
			metadata: {
				freq: "M",
				period,
				hsCode: productCode,
				productLevel: productCode.length === 8 ? "CN8" : "HS",
				...(productLabel ? { productLabel } : {}),
				quantityKg,
				valueEur,
				currency: "EUR",
				basis: "FOB-EUR (EU-reported export, Comext DS-045409)",
			},
		});
	}
	return out;
}

/** Build one Comext URL (single product, single indicator, time range). */
export function comextUrl(params: {
	reporter: string;
	product: string;
	indicator: string;
	since: string;
	until: string;
}): string {
	const q = new URLSearchParams({
		lang: "EN",
		freq: "M",
		reporter: params.reporter,
		partner: "CN",
		product: params.product,
		flow: "2",
		indicators: params.indicator,
		sinceTimePeriod: params.since,
		untilTimePeriod: params.until,
	});
	return `${API_BASE}?${q}`;
}

async function fetchJsonStat(url: string): Promise<JsonStatDataset | null> {
	const res = await scraperFetch(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": "MT/1.0 (beef price platform data ingestion)",
		},
		timeoutMs: 20_000,
		retries: 2,
	});
	if (!res.ok) {
		logger.warn(`[COMEXT_EU] ${url.slice(-90)} returned HTTP ${res.status}`);
		return null;
	}
	try {
		return (await res.json()) as JsonStatDataset;
	} catch (err) {
		logger.warn(`[COMEXT_EU] JSON parse failed: ${err instanceof Error ? err.message : err}`);
		return null;
	}
}

/** "2026-07"-style month from a Date, stepped back `months`. */
function isoMonth(d: Date, monthsBack = 0): string {
	const m = new Date(d);
	m.setUTCMonth(m.getUTCMonth() - monthsBack);
	return m.toISOString().slice(0, 7);
}

/**
 * Run the EU mirror sweep. `monthsLookback` widens the window for the
 * one-time backfill; the daily scraper uses DAILY_LOOKBACK_MONTHS. Request
 * count is constant (one range query per reporter×HS×indicator) regardless
 * of depth.
 */
export async function runComextEu(monthsLookback: number): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;
	let parsedRows = 0;
	let firstRequest = true;
	const sleep = () => new Promise((r) => setTimeout(r, MS_BETWEEN_REQUESTS));

	const now = new Date();
	const since = isoMonth(now, monthsLookback);
	const until = isoMonth(now);

	const valueMaps = new Map<string, Map<string, number>>();
	const qtyMaps = new Map<string, Map<string, number>>();
	const laneKey = (reporter: string, hs: string) => `${reporter}:${hs}`;

	const queries: Array<{ url: string; reporter: string; hs: string; indicator: string }> = [];
	for (const reporter of EU_REPORTERS) {
		for (const hs of ALL_PRODUCTS) {
			for (const indicator of [VALUE_INDICATOR, QTY_INDICATOR]) {
				queries.push({
					url: comextUrl({ reporter, product: hs, indicator, since, until }),
					reporter,
					hs,
					indicator,
				});
			}
		}
	}

	for (const { url, reporter, hs, indicator } of queries) {
		if (!firstRequest) await sleep();
		firstRequest = false;

		let body: JsonStatDataset | null;
		try {
			body = await fetchJsonStat(url);
		} catch (err) {
			logger.warn(`[COMEXT_EU] fetch failed: ${err instanceof Error ? err.message : err}`);
			continue;
		}
		if (!body) continue;

		const decoded = decodeJsonStat(body);
		if (indicator === VALUE_INDICATOR) valueMaps.set(laneKey(reporter, hs), decoded);
		else qtyMaps.set(laneKey(reporter, hs), decoded);
	}

	for (const reporter of EU_REPORTERS) {
		for (const hs of ALL_PRODUCTS) {
			const cn8Label = CN8_LABELS[hs as (typeof CN8_CODES)[number]];
			const rows = parseComextSeries(
				valueMaps.get(laneKey(reporter, hs)) ?? new Map(),
				qtyMaps.get(laneKey(reporter, hs)) ?? new Map(),
				reporter,
				hs,
				cn8Label,
			);
			for (const parsed of rows) {
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
	}

	// Monthly series re-scanned on the daily cycle: rows parsed but zero
	// writes means confirmed-unchanged data (noChange contract, round-149).
	const noChange = parsedRows > 0 && inserted + updated === 0;
	logger.info(
		`[COMEXT_EU] ${queries.length} queries, ${parsedRows} rows → ${noChange ? "unchanged" : `${inserted} inserted, ${updated} updated`}`,
	);
	return noChange ? { inserted, updated, noChange: true } : { inserted, updated };
}

async function fetchComextEu(): Promise<ScraperResult> {
	return runComextEu(DAILY_LOOKBACK_MONTHS);
}

export const comextEuScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchComextEu,
};
