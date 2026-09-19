/**
 * GACC foreign meat-establishment registry — weekly reference snapshot
 * (round-170 批1; registered as P2 "厂号名录三源" → P1 in
 * RESEARCH-BEEF-TRADE-DATA-SOURCES.md, foodmate mirror listed 最优先).
 *
 * What it is: 海关总署《进口食品境外生产企业注册》 mirror at
 * jwqyp.foodmate.net (keyless, robots.txt fully open). The mirror exposes a
 * layui table backed by POST /index/index/getlist (form-encoded, server-side
 * pagination, page size up to 100). This source scans the 肉类 category for
 * the 6 source countries (US/BR/AU/UY/AR/NZ) into FactoryRegistryEntry rows.
 *
 * Honesty contract:
 *  - SPECIES-AGNOSTIC: the mirror carries the registry's 肉类 category only.
 *    An entry certifies "a China-registered meat establishment in <country>"
 *    — never a beef-specific approval. Consumers (factory 转正, display)
 *    must not claim species scope the registry doesn't.
 *  - approvalNo → factoryCode normalization is FORMAT-OBSERVED, not guessed:
 *    BR publishes SIF-prefixed (SIF1; bare digits accepted — same federal
 *    plant id), NZ publishes ME-prefixed (ME9; bare digits likewise), the
 *    other four publish bare establishment numbers. Anything else →
 *    factoryCode NULL, row still stored (registry completeness), counted
 *    and logged. 宁缺勿错 on code invention.
 *  - Snapshot semantics: all-6-countries-or-nothing. A mid-scan country
 *    failure aborts WITHOUT persisting — a partial snapshot would touch
 *    lastSeenAt and blind the weekly gate for 7 days with a missing country.
 *  - Cadence: weekly freshness gate (in-source, on the daily cycle —
 *    drewry_wci precedent). Unchanged rows are still touched (lastSeenAt)
 *    so a static registry doesn't re-scan daily; the touch is NOT counted
 *    as an update. Rows vanished from the mirror are left in place (audit
 *    trail) — churn handling registered for follow-up if observed.
 *
 * Live-verified 2026-09-19: BR meat plants = 103 (page1=100 + page2=3 — the
 * response `count` field caps at 100, pagination is NOT capped; trust
 * data.length, never count).
 */

import { logger, prisma } from "@/lib";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const SOURCE_ID = "gacc_registry";
const GETLIST_URL = "http://jwqyp.foodmate.net/index/index/getlist";

/** Scan scope: the product's 6 source countries (factories seed order).
 * gid values are the mirror's internal country ids (live-verified). */
const COUNTRIES: ReadonlyArray<{ iso2: string; gid: number }> = [
	{ iso2: "US", gid: 392 },
	{ iso2: "BR", gid: 3570 },
	{ iso2: "AU", gid: 398 },
	{ iso2: "NZ", gid: 399 },
	{ iso2: "UY", gid: 3686 },
	{ iso2: "AR", gid: 3569 },
];

const CATEGORY = "肉类";
const PAGE_LIMIT = 100;
/** Safety bound only — live max is BR's 2 pages; 10 pages = 1000/country. */
const PAGE_CAP_PER_COUNTRY = 10;
const PAGE_DELAY_MS = 1500;
/** Weekly snapshot cadence (gate reads max(lastSeenAt); see header note). */
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60_000;

// ---------------------------------------------------------------------------
// Pure helpers — the test seam.
// ---------------------------------------------------------------------------

/**
 * Normalize a registry approvalNo into the platform factoryCode convention
 * (round-168): BR keeps the seed SIF prefix, everything else {ISO2}-{n};
 * NZ's ME prefix is stripped (ME9 → NZ-9, the title-attribution shape).
 * Unrecognized formats → null (宁缺勿错 — never invent a code).
 *
 * First-snapshot observed classes deliberately left NULL (2026-09-19, 769
 * unmapped of 1346): US letter-suffix ("244C" — a DIFFERENT establishment
 * than 244), US "P"/"V" prefixes (poultry/other inspection id spaces), NZ
 * S/PH/CS/DSP/ICE… series (non-ME establishment types). None of these can
 * join a numeric title-extracted plant number, and mapping them onto the
 * numeric convention would invent equivalences. Revisit only with evidence
 * (e.g. listings actually carrying alphanumeric plant codes).
 */
export function registryFactoryCode(iso2: string, approvalNo: string): string | null {
	const v = approvalNo.trim();
	if (v === "") return null;
	if (iso2 === "BR") {
		// "SIF 1184" (observed, spaced) and "SIF1184"/"1184" are the same
		// federal plant id.
		const m = v.match(/^SIF\s*(\d{1,5})$/i) ?? v.match(/^(\d{1,5})$/);
		return m ? `BR-SIF${m[1]}` : null;
	}
	if (iso2 === "NZ") {
		const m = v.match(/^(?:ME)?(\d{1,5})$/i);
		return m ? `NZ-${m[1]}` : null;
	}
	const m = v.match(/^(\d{1,5})$/);
	return m ? `${iso2}-${m[1]}` : null;
}

/** One normalized registry row, country attached from the scan map. */
export interface RegistryEntry {
	country: string;
	approvalNo: string;
	factoryCode: string | null;
	name: string | null;
	activities: string | null;
	address: string | null;
	sourceUrl: string | null;
	entryType: string | null;
	registryId: number | null;
	status: number;
	/** Mirror-side audit extras (response gid name, updatetime) → metadata. */
	mirrorCountry: string | null;
	mirrorUpdateTime: string | null;
}

/** Raw row shape of the getlist response (subset — live-verified fields). */
interface RawRegistryRow {
	id?: number;
	gid?: string;
	approvalno?: string;
	qiyename?: string;
	activities?: string;
	address?: string;
	laiyuan?: string;
	type?: string;
	status?: number;
	updatetime?: string | null;
}

/**
 * Parse one getlist page for a known country. Pure. Returns [] on an
 * error/empty payload (the caller decides stop-vs-abort); individual rows
 * with a missing/blank approvalNo are skipped (no unique key to store under).
 */
export function parseRegistryPage(json: unknown, iso2: string): RegistryEntry[] {
	const root = json as { code?: number; data?: RawRegistryRow[] } | null;
	if (!root || root.code !== 0 || !Array.isArray(root.data)) return [];
	const entries: RegistryEntry[] = [];
	for (const row of root.data) {
		const approvalNo = (row.approvalno ?? "").trim();
		if (approvalNo === "") continue;
		entries.push({
			country: iso2,
			approvalNo,
			factoryCode: registryFactoryCode(iso2, approvalNo),
			name: row.qiyename?.trim() || null,
			activities: row.activities?.trim() || null,
			address: row.address?.trim() || null,
			sourceUrl: row.laiyuan?.trim() || null,
			entryType: row.type?.trim() || null,
			registryId: typeof row.id === "number" ? row.id : null,
			status: typeof row.status === "number" ? row.status : 1,
			mirrorCountry: row.gid?.trim() || null,
			mirrorUpdateTime: row.updatetime ?? null,
		});
	}
	return entries;
}

// ---------------------------------------------------------------------------
// Persistence — upsert-by-key with insert/changed/touch semantics.
// ---------------------------------------------------------------------------

export interface RegistryPersistReport {
	inserted: number;
	/** Rows with ≥1 changed payload field (NOT the lastSeenAt touch). */
	updated: number;
	/** Identical rows — still written, to advance lastSeenAt (weekly gate). */
	unchanged: number;
	/** Rows whose approvalNo has no known format → factoryCode NULL. */
	unmappedFactoryCode: number;
}

function entryData(e: RegistryEntry) {
	return {
		factoryCode: e.factoryCode,
		name: e.name,
		activities: e.activities,
		address: e.address,
		sourceUrl: e.sourceUrl,
		entryType: e.entryType,
		registryId: e.registryId,
		status: e.status,
		metadata: {
			mirror: "jwqyp.foodmate.net",
			category: CATEGORY,
			...(e.mirrorCountry ? { mirrorCountry: e.mirrorCountry } : {}),
			...(e.mirrorUpdateTime ? { mirrorUpdateTime: e.mirrorUpdateTime } : {}),
		},
	};
}

const CHANGED_FIELDS = [
	"factoryCode",
	"name",
	"activities",
	"address",
	"sourceUrl",
	"entryType",
	"registryId",
	"status",
] as const;

/**
 * Persist a full snapshot. Existing rows are diffed field-by-field: changed
 * rows update payload fields, identical rows are touched (lastSeenAt only)
 * so the weekly freshness gate sees the scan without it counting as change.
 * Exported for integration tests.
 */
export async function persistRegistryEntries(
	entries: RegistryEntry[],
	now: Date = new Date(),
): Promise<RegistryPersistReport> {
	const report: RegistryPersistReport = {
		inserted: 0,
		updated: 0,
		unchanged: 0,
		unmappedFactoryCode: 0,
	};
	const countries = [...new Set(entries.map((e) => e.country))];
	const existing = await prisma.factoryRegistryEntry.findMany({
		where: countries.length > 0 ? { country: { in: countries } } : undefined,
		select: {
			id: true,
			country: true,
			approvalNo: true,
			factoryCode: true,
			name: true,
			activities: true,
			address: true,
			sourceUrl: true,
			entryType: true,
			registryId: true,
			status: true,
		},
	});
	const byKey = new Map(existing.map((r) => [`${r.country}|${r.approvalNo}`, r]));

	for (const e of entries) {
		if (e.factoryCode === null) report.unmappedFactoryCode++;
		const prev = byKey.get(`${e.country}|${e.approvalNo}`);
		if (!prev) {
			await prisma.factoryRegistryEntry.create({
				data: { country: e.country, approvalNo: e.approvalNo, ...entryData(e), lastSeenAt: now },
			});
			report.inserted++;
			continue;
		}
		const data = entryData(e);
		const changed = CHANGED_FIELDS.some((f) => prev[f] !== data[f]);
		await prisma.factoryRegistryEntry.update({
			where: { id: prev.id },
			data: changed ? { ...data, lastSeenAt: now } : { lastSeenAt: now },
		});
		if (changed) report.updated++;
		else report.unchanged++;
	}
	return report;
}

// ---------------------------------------------------------------------------
// Factory 转正 — promote title-attributed plants the registry confirms.
// ---------------------------------------------------------------------------

export interface FactoryPromotionReport {
	/** gacc-plant-unverified factories whose code now matches the registry. */
	promoted: number;
	/** Still unverified (no registry row with that factoryCode). */
	stillUnverified: number;
}

/**
 * round-168 attributed Roujiaosuo listing prefixes to {ISO2}-{plant}
 * factories marked kind=gacc-plant-unverified. After a registry snapshot,
 * any factory whose code matches a registry entry is promoted to
 * gacc-plant-verified with the registry name attached — the identity claim
 * now rests on the GACC mirror, not a listing title. Species-agnostic
 * (registry certifies "meat plant", see header). Runs after each scan;
 * exported for tests and the initial backfill.
 */
export async function promoteVerifiedFactories(
	now: Date = new Date(),
): Promise<FactoryPromotionReport> {
	const pending = await prisma.factory.findMany({
		where: { metadata: { path: ["kind"], equals: "gacc-plant-unverified" } },
		select: { id: true, code: true, metadata: true },
	});
	const report: FactoryPromotionReport = { promoted: 0, stillUnverified: 0 };
	for (const factory of pending) {
		const hit = await prisma.factoryRegistryEntry.findFirst({
			where: { factoryCode: factory.code },
			select: { name: true, country: true, approvalNo: true, sourceUrl: true },
		});
		if (!hit) {
			report.stillUnverified++;
			continue;
		}
		const prev = (factory.metadata ?? {}) as Record<string, unknown>;
		await prisma.factory.update({
			where: { id: factory.id },
			data: {
				metadata: {
					...prev,
					kind: "gacc-plant-verified",
					registryName: hit.name,
					registryCountry: hit.country,
					registryApprovalNo: hit.approvalNo,
					registrySourceUrl: hit.sourceUrl,
					verifiedBy: "gacc-mirror (foodmate jwqyp)",
					verifiedAt: now.toISOString(),
					note: `Plant identity confirmed by the GACC foreign-establishment registry mirror: ${hit.name ?? hit.approvalNo}. Registry entry is species-agnostic (registered meat establishment).`,
				},
			},
		});
		report.promoted++;
		logger.info(
			`[GACC_REGISTRY] factory ${factory.code} promoted to gacc-plant-verified (${hit.name ?? hit.approvalNo})`,
		);
	}
	return report;
}

// ---------------------------------------------------------------------------
// Scraper entry — weekly-gated scan of the 6 countries.
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRegistryPage(gid: number, page: number): Promise<unknown> {
	const body = new URLSearchParams({
		page: String(page),
		limit: String(PAGE_LIMIT),
		pname: CATEGORY,
		gid: String(gid),
	}).toString();
	const res = await scraperFetch(GETLIST_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"X-Requested-With": "XMLHttpRequest",
			"User-Agent": "MT/1.0 (beef price platform data ingestion; contact: github.com/Zouksw/MT)",
			// Live-bisected 2026-09-19: the mirror's PHP stack 500s on
			// `Accept-Language: *` — which undici's fetch sends UNLESS a real
			// value is set explicitly (curl/node:http never send it and always
			// 200). A concrete language list is required, not cosmetic.
			"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
		},
		body,
		timeoutMs: 20_000,
		retries: 2,
	});
	if (!res.ok) throw new Error(`getlist gid=${gid} page=${page} HTTP ${res.status}`);
	return res.json();
}

/** Scan one country to exhaustion. Throws on any page failure (the caller
 * aborts the whole scan — all-countries-or-nothing, see header). */
async function scanCountry(iso2: string, gid: number): Promise<RegistryEntry[]> {
	const entries: RegistryEntry[] = [];
	for (let page = 1; page <= PAGE_CAP_PER_COUNTRY; page++) {
		if (page > 1) await sleep(PAGE_DELAY_MS);
		const rows = parseRegistryPage(await fetchRegistryPage(gid, page), iso2);
		if (rows.length === 0) break;
		entries.push(...rows);
		if (rows.length < PAGE_LIMIT) break; // last page
	}
	return entries;
}

async function fetchGaccRegistry(): Promise<ScraperResult> {
	const newest = await prisma.factoryRegistryEntry.findFirst({
		orderBy: { lastSeenAt: "desc" },
		select: { lastSeenAt: true },
	});
	if (newest && Date.now() - newest.lastSeenAt.getTime() < REFRESH_INTERVAL_MS) {
		logger.info(
			`[GACC_REGISTRY] snapshot fresh (${newest.lastSeenAt.toISOString()}), weekly gate skips this run`,
		);
		return { inserted: 0, updated: 0, noChange: true };
	}

	const all: RegistryEntry[] = [];
	for (const c of COUNTRIES) {
		try {
			const rows = await scanCountry(c.iso2, c.gid);
			logger.info(`[GACC_REGISTRY] ${c.iso2}: ${rows.length} registry entries scanned`);
			all.push(...rows);
		} catch (err) {
			// All-or-nothing: a partial snapshot would advance the weekly gate
			// while missing a country. Abort unprinted; next daily run retries.
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn(
				`[GACC_REGISTRY] country ${c.iso2} scan failed — snapshot aborted, nothing persisted: ${msg}`,
			);
			return { inserted: 0, updated: 0 };
		}
	}

	if (all.length === 0) {
		logger.warn("[GACC_REGISTRY] zero entries across all countries (mirror reformat or block?)");
		return { inserted: 0, updated: 0 };
	}

	const report = await persistRegistryEntries(all);
	const promotion = await promoteVerifiedFactories();
	logger.info(
		`[GACC_REGISTRY] ${all.length} entries → ${report.inserted} inserted, ${report.updated} updated, ${report.unchanged} unchanged (touched), ${report.unmappedFactoryCode} unmapped codes; factories promoted ${promotion.promoted}/${promotion.promoted + promotion.stillUnverified}`,
	);
	return report.inserted + report.updated === 0
		? { inserted: 0, updated: 0, noChange: true }
		: { inserted: report.inserted, updated: report.updated };
}

export const gaccRegistryScraper: Scraper = {
	name: SOURCE_ID,
	fetch: fetchGaccRegistry,
};
