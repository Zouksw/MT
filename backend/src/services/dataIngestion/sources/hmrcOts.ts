/**
 * HMRC UK Overseas Trade Statistics — official UK monthly bovine exports to
 * China (round-171 批3; recon: api.uktradeinfo.com OData live-probed
 * 2026-09-20, research doc §9.4 promoted from P3).
 *
 * Why this lane: the UK left the EU so it is NOT in the Comext EU lane, and
 * the UK reports no partner-split monthly HS detail to UN Comtrade (verified:
 * reporter 826 monthly × CN = 0 rows) — this official OData API is the only
 * monthly programmatic path for GB→CN bovine trade. Volumes are small (live
 * probe: 5 months with trade since 2025-01, £4k-£188k/month) — this lane is
 * coverage completeness, not a heavyweight series. License: OGL 3.0 (commercial
 * redistribution with attribution allowed). No robots.txt restrictions (the
 * API hosts none — soft-404).
 *
 * Contract (live-verified):
 *   GET /OTS?$filter=MonthId ge X and CountryId eq 720 and FlowTypeId eq 4
 *            and CommodityId in (14 bovine CN8 ids)
 *   → {"value":[{MonthId:202607, CommodityId, Value:£, NetMass:kg|null,
 *               SuppressionIndex, ...}]}
 *   FlowType 4 = Non-EU Exports (post-Brexit UK exports); CountryId 720 = CN.
 *   CN8 ids map 1:1 onto HS4 chapters 0201 (fresh/chilled) and 0202 (frozen).
 *
 * Landing convention — the trade-mirror family shape (comtrade_mirror
 * USD/ton, comext_eu EUR/ton): chapter-aggregated DERIVED UNIT PRICE as
 *   type `export_uk_to_cn_{0201|0202}`, region "GB→CN", unit "GBP/ton",
 *   value = ΣValue£ ÷ ΣNetMass(kg) × 1000.
 * Months with suppressed/null Value or zero mass are skipped honestly — no
 * price is invented for a month the statistics suppress. Raw £/kg aggregates
 * ride in row metadata for auditability.
 *
 * Cadence: monthly data on the daily cycle; a 6-month rolling window
 * re-scanned daily catches the fresh release plus revisions, non-release
 * days no-op via sameFactor → noChange (round-149 contract). One request per
 * run, far under the 60 req/min OData rate limit.
 */

import { logger } from "@/lib";
import { parseMonth, upsertFactor } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const API_BASE = "https://api.uktradeinfo.com";
export const SOURCE_ID = "hmrc_ots";
/** China CountryId + Non-EU Exports FlowTypeId (live-verified constants). */
const COUNTRY_CN = 720;
const FLOW_NON_EU_EXPORT = 4;
/** Rolling window re-scanned daily (fresh month + revision catch). */
export const LOOKBACK_MONTHS = 6;

/** Bovine CN8 commodity ids from /Commodity where Cn8Code starts 0201/0202,
 * grouped by HS4 chapter (live-verified ids 2026-09-20). */
export const BOVINE_CN8: Record<string, number[]> = {
	"0201": [2011000, 2012020, 2012030, 2012050, 2012090, 2013000],
	"0202": [2021000, 2022010, 2022030, 2022050, 2022090, 2023010, 2023050, 2023090],
};

export interface OtsRow {
	MonthId: number;
	CommodityId: number;
	Value: number | null;
	NetMass: number | null;
}

export interface UkChapterMonth {
	chapter: string;
	/** Month start (UTC midnight). */
	date: Date;
	valueGbp: number;
	massKg: number;
	/** ΣValue ÷ ΣMass × 1000 — null when mass is zero/suppressed. */
	gbpPerTon: number | null;
}

/** Pure aggregation: OData rows → per (chapter, month) sums + derived unit
 * price. Value and mass aggregate independently (official totals), the unit
 * price derives from both sums; suppressed rows contribute zero to each. */
export function aggregateOtsRows(rows: OtsRow[]): UkChapterMonth[] {
	const idToChapter = new Map<string, string>();
	for (const [chapter, ids] of Object.entries(BOVINE_CN8)) {
		for (const id of ids) idToChapter.set(String(id), chapter);
	}

	const acc = new Map<
		string,
		{ chapter: string; monthId: number; valueGbp: number; massKg: number }
	>();
	for (const row of rows) {
		const chapter = idToChapter.get(String(row.CommodityId));
		if (!chapter) continue;
		const key = `${chapter}-${row.MonthId}`;
		const cur = acc.get(key) ?? { chapter, monthId: row.MonthId, valueGbp: 0, massKg: 0 };
		cur.valueGbp += row.Value ?? 0;
		cur.massKg += row.NetMass ?? 0;
		acc.set(key, cur);
	}

	const out: UkChapterMonth[] = [];
	for (const { chapter, monthId, valueGbp, massKg } of acc.values()) {
		if (valueGbp <= 0) continue; // suppressed or trade-less month — no honest price
		const date = parseMonth(String(monthId));
		if (!date) continue;
		out.push({
			chapter,
			date,
			valueGbp,
			massKg,
			gbpPerTon: massKg > 0 ? Math.round((valueGbp / massKg) * 1000 * 1e6) / 1e6 : null,
		});
	}
	return out.sort(
		(a, b) => a.chapter.localeCompare(b.chapter) || a.date.getTime() - b.date.getTime(),
	);
}

/** Land chapter-months in the trade-mirror family shape. Null-price months
 * (suppressed mass) are skipped — no division is invented. */
export async function persistOtsMonths(months: UkChapterMonth[]): Promise<{
	inserted: number;
	updated: number;
}> {
	let inserted = 0;
	let updated = 0;
	for (const m of months) {
		if (m.gbpPerTon === null) continue;
		const r = await upsertFactor({
			type: `export_uk_to_cn_${m.chapter}`,
			region: "GB→CN",
			date: m.date,
			value: m.gbpPerTon,
			unit: "GBP/ton",
			source: SOURCE_ID,
			metadata: {
				valueGbp: Math.round(m.valueGbp * 100) / 100,
				massKg: m.massKg,
				license: "OGL 3.0",
			},
		});
		inserted += r.inserted;
		updated += r.updated;
	}
	return { inserted, updated };
}

async function fetchHmrcOts(): Promise<ScraperResult> {
	// Window start = first MonthId LOOKBACK_MONTHS back from the current month.
	const now = new Date();
	const start = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (LOOKBACK_MONTHS - 1), 1),
	);
	const monthIdStart = start.getUTCFullYear() * 100 + start.getUTCMonth() + 1;
	const allIds = Object.values(BOVINE_CN8).flat();

	// WAF note (bisected live 2026-09-20): the OData `in (...)` operator trips
	// the host's WAF as an injection pattern (in-1 403s, or-chains 200) —
	// build the CommodityId predicate as an OR chain instead.
	const idPredicate = allIds.map((id) => `CommodityId eq ${id}`).join(" or ");
	const filter = [
		`MonthId ge ${monthIdStart}`,
		`CountryId eq ${COUNTRY_CN}`,
		`FlowTypeId eq ${FLOW_NON_EU_EXPORT}`,
		`(${idPredicate})`,
	].join(" and ");
	const url = `${API_BASE}/OTS?$filter=${encodeURIComponent(filter)}&$top=500&$select=MonthId,CommodityId,Value,NetMass`;

	const res = await scraperFetch(url, {
		headers: {
			Accept: "application/json",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "MT/1.0 (beef price platform data ingestion)",
		},
		timeoutMs: 20_000,
		retries: 2,
	});
	if (!res.ok) {
		throw new Error(`HMRC OTS returned HTTP ${res.status}`);
	}
	const body = (await res.json()) as { value?: OtsRow[]; error?: { message?: string } };
	if (body.error) {
		throw new Error(`HMRC OTS API error: ${body.error.message ?? "unknown"}`);
	}
	const rows = body.value ?? [];
	if (rows.length === 0) {
		// Within any 6-month window the UK has traded bovine meat with CN at
		// least once in every live probe — an all-zero window means the API
		// shape changed. 0/0 without noChange → classifier marks warning.
		return { inserted: 0, updated: 0 };
	}

	const months = aggregateOtsRows(rows);
	if (months.length === 0) {
		// Rows came back but every month is suppressed/zero — same honest
		// warning shape (data present but nothing priceable).
		return { inserted: 0, updated: 0 };
	}

	const { inserted, updated } = await persistOtsMonths(months);
	logger.info(
		`[HMRC_OTS] ${rows.length} rows / ${months.length} chapter-months → ${inserted} inserted, ${updated} updated`,
	);
	return inserted + updated === 0 ? { inserted, updated, noChange: true } : { inserted, updated };
}

export const hmrcOtsScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchHmrcOts,
};
