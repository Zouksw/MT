/**
 * Roujiaosuo (肉交所 roujiaosuo.com) spot LISTING quotes — the platform's
 * first live spot-market channel for beef cuts (round-165; design registered
 * round-164 批C in RESEARCH-BEEF-TRADE-DATA-SOURCES.md §路线 P1b).
 *
 * What it is: the free /sell/ feed lists 20 mixed-species meat items per
 * page (beef/pork/lamb/offal interleaved), each with title, supply type,
 * ORIGIN COUNTRY, price (元/公斤), quantity, warehouse city and a relative
 * update time. Beef rows whose title maps onto the canonical BeefCutTaxonomy
 * vocabulary land as BeefCutPrice rows under a VIRTUAL factory (code
 * RJS-SPOT), currency CNY — isolated from the frozen USD FOB plant series
 * by the factory dimension, never converted.
 *
 * Honesty contract (round-164 design, all load-bearing):
 *  - priceType = "listing" (挂价, a quoted ask) — NOT a transaction price;
 *    metadata carries listingId/title/origin/warehouse/sourceUrl for audit.
 *  - Titles map ONLY via canonical taxonomy terms (nameZh ∪ ALIASES,
 *    longest-first substring). Unmapped beef titles are skipped and logged,
 *    never guessed (宁缺勿错).
 *  - Processed-product markers (黑椒/腌制/调理/预煮/即食/熟食) exclude a
 *    title even when it contains a cut word.
 *  - Plausibility band 5–300 CNY/kg rejects per-case/mispriced listings
 *    (live example: "雪花肥牛砖 16000 元/公斤") — rejected with a warning,
 *    never clamped.
 *  - robots.txt allows /sell/ and blocks /*search*: this source walks the
 *    public listing pages only (no search endpoint, no login), capped at
 *    PAGE_CAP pages/day with a polite delay — day-1 次 低频 per the ToS
 *    recon (round-161 批3).
 *
 * Pagination quirks (live-verified 2026-09-19): /sell/ == index-htm-page-0
 * == page-1 (same first page), page-2 intermittently serves an empty shell —
 * the walker walks 0..N, skips zero-item pages, de-dupes by listingId in
 * run, and stops early once every id on a page is already ingested.
 */

import type { Prisma } from "@prisma/client";

import { logger, prisma } from "@/lib";
import { ALIASES, getAllCutMappings } from "../beefCutNormalizer";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const SOURCE_ID = "roujiaosuo_spot";
const BASE = "https://www.roujiaosuo.com/sell/";
/** Virtual factory code — isolates CNY listing series from USD plant series. */
export const SPOT_FACTORY_CODE = "RJS-SPOT";
const PAGE_CAP = 8;
const PAGE_DELAY_MS = 1500;
/** CNY/kg plausibility band for beef spot listings (offal ≈5–40, cuts ≈30–120,
 * premium ≈120–300; per-case typos like 16000 land far outside). */
const PRICE_MIN_CNY = 5;
const PRICE_MAX_CNY = 300;
/** Processed/prepared products never map to a raw-cut series. */
const PROCESSED_MARKERS = /黑椒|腌制|调理|预煮|即食|熟食|卤味/;

// ---------------------------------------------------------------------------
// Vocabulary — canonical terms only, longest-first. Built once.
// ---------------------------------------------------------------------------

/** term → cutCode, ordered longest-first so 牛小排 wins over 小排-style hits. */
export const BEEF_SPOT_TERMS: Array<{ term: string; cutCode: string }> = (() => {
	const map = new Map<string, string>();
	for (const cut of getAllCutMappings()) {
		const term = cut.nameZh?.trim();
		// Two cuts share 牛仔骨 (BACK_RIBS / SHORT_RIBS — same rib family);
		// first registration wins, deterministic by CUT_MAPPINGS order.
		if (term && !map.has(term)) map.set(term, cut.cutCode);
	}
	for (const [alias, code] of Object.entries(ALIASES)) {
		// Chinese aliases only — the feed is a Chinese-language site and the
		// EN/ES/PT aliases can never appear in these titles.
		if (!/[\u4e00-\u9fff]/.test(alias)) continue;
		if (!map.has(alias)) map.set(alias, code);
	}
	return [...map.entries()]
		.map(([term, cutCode]) => ({ term, cutCode }))
		.sort((a, b) => b.term.length - a.term.length);
})();

/**
 * Resolve a listing title to a canonical cutCode, or null. Requires the
 * beef marker 牛, rejects processed products, then takes the longest
 * canonical term contained in the title.
 */
export function resolveBeefSpotCut(title: string): { cutCode: string; term: string } | null {
	if (!title.includes("牛")) return null;
	if (PROCESSED_MARKERS.test(title)) return null;
	for (const { term, cutCode } of BEEF_SPOT_TERMS) {
		if (title.includes(term)) return { cutCode, term };
	}
	return null;
}

// ---------------------------------------------------------------------------
// Listing-page parsing — pure, the test seam.
// ---------------------------------------------------------------------------

export interface SpotListingItem {
	listingId: string;
	title: string;
	supplyType: string;
	originCountry: string;
	priceCnyPerKg: number | null;
	volumeKg: number | null;
	warehouse: string;
	timeText: string;
}

function stripTags(fragment: string): string {
	return fragment
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;|&#160;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Parse one /sell/ listing page. Pure. Returns [] on a reformat (the honest
 * empty shape — the caller decides whether that page was the empty-shell
 * quirk or a site redesign).
 */
export function parseRjsListingPage(html: string): SpotListingItem[] {
	const items: SpotListingItem[] = [];
	const blocks = html.match(/<ul class="meat-list-item[^"]*">[\s\S]*?<\/ul>/g) ?? [];
	for (const block of blocks) {
		const link = block.match(/sell\/show\/(\d+)\//);
		if (!link) continue;
		const cells = (block.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? []).map(stripTags);
		// Column contract: 0 品名 | 1 供货类型 | 2 产地 | 3 价格 | 4 数量 | 5 仓库 | 6 更新时间
		if (cells.length < 7) continue;
		const price = cells[3].match(/([\d.]+)\s*元\/公斤/);
		const volume = cells[4].match(/(\d+)\s*公斤/);
		items.push({
			listingId: link[1],
			title: cells[0],
			supplyType: cells[1],
			originCountry: cells[2],
			priceCnyPerKg: price ? Number(price[1]) : null,
			volumeKg: volume && Number(volume[1]) > 0 ? Number(volume[1]) : null,
			warehouse: cells[5],
			timeText: cells[6],
		});
	}
	return items;
}

/**
 * Relative ("20分钟前"/"3小时前"/"2天前") or absolute ("09-18", "2026-09-18")
 * listing time → Date; null when unparseable (caller falls back to now —
 * the walker only reads the newest pages, so unparseable ≈ today).
 */
export function parseListingTime(text: string, now: Date): Date | null {
	const rel = text.match(/(\d+)\s*(分钟|小时|天)前/);
	if (rel) {
		const n = Number(rel[1]);
		const ms = rel[2] === "分钟" ? n * 60_000 : rel[2] === "小时" ? n * 3_600_000 : n * 86_400_000;
		return new Date(now.getTime() - ms);
	}
	const abs = text.match(/(\d{4})-(\d{2})-(\d{2})/) ?? text.match(/(\d{2})-(\d{2})/);
	if (!abs) return null;
	if (abs.length === 4)
		return new Date(Date.UTC(Number(abs[1]), Number(abs[2]) - 1, Number(abs[3])));
	// MM-DD assumes the current year (and December posts read in January
	// would mis-year — but the walker only sees the newest pages).
	return new Date(Date.UTC(now.getUTCFullYear(), Number(abs[1]) - 1, Number(abs[2])));
}

// ---------------------------------------------------------------------------
// Ingest — parsed items → BeefCutPrice rows (idempotent per day).
// ---------------------------------------------------------------------------

export interface SpotIngestReport {
	/** Rows actually created (first listing of the day per cut wins). */
	inserted: number;
	/** Beef rows dropped by the plausibility band. */
	rejectedPrice: number;
	/** Beef titles with no canonical term — logged for vocabulary iteration. */
	unmappedTitles: string[];
	/** Matched items whose (cut, day) row already existed. */
	duplicates: number;
}

/** UTC midnight of the listing day — the row key's date component. */
function dayKey(d: Date): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Persist resolved spot listings. Exported for integration tests (the fetch
 * path is thin; THIS is where the honesty gates live). Never updates an
 * existing (factory, cut, day, source) row — first-of-day wins, no flapping
 * between competing sellers.
 */
export async function ingestSpotItems(
	items: SpotListingItem[],
	now: Date,
): Promise<SpotIngestReport> {
	const report: SpotIngestReport = {
		inserted: 0,
		rejectedPrice: 0,
		unmappedTitles: [],
		duplicates: 0,
	};

	const factory = await prisma.factory.upsert({
		where: { code: SPOT_FACTORY_CODE },
		update: {},
		create: {
			code: SPOT_FACTORY_CODE,
			name: "Roujiaosuo Exchange spot listings (virtual)",
			nameLocal: "肉交所平台挂价（虚拟聚合厂）",
			country: "CN",
			metadata: {
				virtual: true,
				kind: "exchange-spot-platform",
				note: "Aggregated platform LISTING quotes (挂价, not transactions), CNY/kg as published. Isolated from plant FOB series by this virtual factory; never currency-converted.",
			},
		},
	});

	const seenCuts = new Set<string>();
	const rows: Prisma.BeefCutPriceCreateManyInput[] = [];

	for (const item of items) {
		const resolved = resolveBeefSpotCut(item.title);
		if (!resolved) {
			if (item.title.includes("牛")) report.unmappedTitles.push(item.title);
			continue;
		}
		if (item.priceCnyPerKg == null) continue; // 面议 etc. — no price, no row
		if (item.priceCnyPerKg < PRICE_MIN_CNY || item.priceCnyPerKg > PRICE_MAX_CNY) {
			report.rejectedPrice++;
			logger.warn(
				`[RJS_SPOT] price outside ${PRICE_MIN_CNY}-${PRICE_MAX_CNY} CNY/kg band, rejected: ${item.title} @ ${item.priceCnyPerKg}`,
			);
			continue;
		}
		const date = dayKey(parseListingTime(item.timeText, now) ?? now);
		const dayCut = `${date.toISOString().slice(0, 10)}:${resolved.cutCode}`;
		if (seenCuts.has(dayCut)) {
			report.duplicates++;
			continue; // first-of-day wins within the run too
		}
		seenCuts.add(dayCut);

		rows.push({
			factoryId: factory.id,
			cutCode: resolved.cutCode,
			date,
			price: Math.round(item.priceCnyPerKg * 100) / 100,
			currency: "CNY",
			unit: "CNY/kg",
			source: SOURCE_ID,
			sourceRef: item.listingId,
			volume: item.volumeKg,
			metadata: {
				priceType: "listing",
				title: item.title,
				matchedTerm: resolved.term,
				originCountry: item.originCountry,
				warehouse: item.warehouse,
				supplyType: item.supplyType,
				sourceUrl: `https://www.roujiaosuo.com/sell/show/${item.listingId}/`,
			},
		});
	}

	if (rows.length > 0) {
		// skipDuplicates on the (factoryId, cutCode, date, source) unique key:
		// yesterday's rows survive a re-scan untouched → noChange re-runs.
		const r = await prisma.beefCutPrice.createMany({ data: rows, skipDuplicates: true });
		report.inserted = r.count;
		report.duplicates += rows.length - r.count;
	}
	return report;
}

// ---------------------------------------------------------------------------
// Scraper entry — walk the newest pages.
// ---------------------------------------------------------------------------

function pageUrl(n: number): string {
	return n === 0 ? BASE : `${BASE}index-htm-page-${n}.html`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRoujiaosuoSpot(): Promise<ScraperResult> {
	const now = new Date();
	const all: SpotListingItem[] = [];
	const seenIds = new Set<string>();
	let pagesWithItems = 0;
	let stalePage = false;

	for (let page = 0; page < PAGE_CAP && !stalePage; page++) {
		if (page > 0) await sleep(PAGE_DELAY_MS);
		const res = await scraperFetch(pageUrl(page), {
			headers: {
				Accept: "text/html",
				"User-Agent": "MT/1.0 (beef price platform data ingestion; contact: github.com/Zouksw/MT)",
			},
			timeoutMs: 20_000,
			retries: 2,
		});
		if (!res.ok) {
			// A single failed page is survivable when earlier pages parsed;
			// a first-page failure is the honest 0/0-empty shape.
			logger.warn(`[RJS_SPOT] page ${page} returned HTTP ${res.status}`);
			if (page === 0) return { inserted: 0, updated: 0 };
			break;
		}
		const items = parseRjsListingPage(await res.text());
		if (items.length === 0) continue; // the empty-shell page quirk — skip

		pagesWithItems++;
		// In-run de-dup (the page-0/page-1 mirror) …
		const fresh = items.filter((it) => !seenIds.has(it.listingId));
		for (const it of fresh) seenIds.add(it.listingId);
		all.push(...fresh);

		// … and the early stop on PERSISTED listings only: when every id on
		// this page was ingested by a previous run, deeper pages are older
		// still. (Checking the DB — not this run's seenIds — is what keeps
		// the page-1 mirror from aborting the walk.)
		if (page > 0 && fresh.length > 0) {
			const persisted = await prisma.beefCutPrice.findMany({
				where: { source: SOURCE_ID, sourceRef: { in: fresh.map((it) => it.listingId) } },
				select: { sourceRef: true },
			});
			if (persisted.length === fresh.length) stalePage = true;
		}
	}

	if (pagesWithItems === 0) {
		// No page yielded items — site redesign or a block. 0/0 WITHOUT
		// noChange so the freshness board surfaces it.
		logger.warn("[RJS_SPOT] no listing items parsed across pages (reformat or block?)");
		return { inserted: 0, updated: 0 };
	}

	const report = await ingestSpotItems(all, now);
	if (report.unmappedTitles.length > 0) {
		logger.info(
			`[RJS_SPOT] ${report.unmappedTitles.length} beef titles unmapped (skipped): ${[...new Set(report.unmappedTitles)].slice(0, 5).join(" / ")}`,
		);
	}
	logger.info(
		`[RJS_SPOT] ${all.length} listings → ${report.inserted} inserted, ${report.duplicates} known-day, ${report.rejectedPrice} price-rejected`,
	);
	return report.inserted === 0
		? { inserted: 0, updated: 0, noChange: true }
		: { inserted: report.inserted, updated: 0 };
}

export const roujiaosuoSpotScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchRoujiaosuoSpot,
};
