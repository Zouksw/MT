/**
 * Shared helpers for data ingestion scrapers.
 *
 * Eliminates repeated upsert patterns across all scrapers.
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import { authoritativeSourceWhere } from "@/services/inference/authoritativeSources";
import type { ScraperResult } from "./scraperManager";

/**
 * Latest USD-per-unit FX rate for a currency-pair commodity ("brl_usd",
 * "aud_usd"). The writer sources use opposite directions — fred DEX* series
 * quote foreign currency per USD (DEXBZUS ≈ 5.0), exchange_rate_api quotes
 * USD per unit (≈ 0.19) — so normalize by magnitude. Returns null when no
 * authoritative row exists; callers must skip the conversion (honest
 * absence), never fall back to a hardcoded rate — the old 0.65/0.18
 * constants in mlaNlrs/cepeaData silently mis-converted by up to ~8%
 * (audit finding, round-104).
 */
export async function latestUsdRate(slug: string): Promise<number | null> {
	const row = await prisma.commodityPrice.findFirst({
		where: { commodity: { slug }, ...authoritativeSourceWhere(slug) },
		orderBy: { date: "desc" },
		select: { close: true },
	});
	const v = row ? Number(row.close) : Number.NaN;
	if (!Number.isFinite(v) || v <= 0) return null;
	return v > 1 ? 1 / v : v;
}

/**
 * Classify a scraper run into an IngestionLog `status`.
 *
 * This is the single source of truth for the 0-row honesty contract: a run
 * that returned without throwing but wrote no rows (`inserted === 0 &&
 * updated === 0`) is `warning`, not `success`. Without this, scrapers that are
 * reachable enough to return but produce nothing (Cloudflare block, page
 * reformat, upstream empty, missing key surfaced as skipped) read as "healthy"
 * on the freshness board and inflate `successRate`. The same classifier is
 * shared by the scheduled path (server.ts), the manual single-source refresh,
 * and refresh-all so all writers agree on the contract.
 *
 * @returns status + optional errorMessage (for skipped/error cases)
 */
export function classifyIngestionStatus(
	result: Pick<ScraperResult, "inserted" | "updated" | "skipped" | "skipReason" | "error">,
): { status: string; errorMessage?: string } {
	if (result.skipped) {
		return { status: "error", errorMessage: result.skipReason ?? "skipped" };
	}
	if (result.error) {
		// Thrown source (caught by the caller) — hard failure.
		return { status: "error", errorMessage: result.error };
	}
	if (result.inserted === 0 && result.updated === 0) {
		return { status: "warning" };
	}
	return { status: "success" };
}

/**
 * Lazily import the commodity-prediction cache invalidator.
 *
 * Dynamic import (not a top-level import) breaks a would-be circular
 * dependency: helpers is imported by every scraper, and predictionCache
 * transitively reaches services that depend on the scraper layer. Resolving
 * it lazily at call time keeps the module-load graph acyclic. Invalidation
 * is best-effort — if the import or the Redis call fails, the cached
 * prediction simply lives out its TTL.
 */
async function invalidateCommodityCache(commodityId: string): Promise<number> {
	const mod = await import("@/services/predictionCache");
	return mod.invalidateCommodityCache(commodityId);
}

/** Prisma-safe JSON cast — single place to handle the InputJsonValue type. */
export function json(obj: Record<string, unknown>): Prisma.InputJsonValue {
	return obj as Prisma.InputJsonValue;
}

/** Find or create a Commodity by slug. */
export async function ensureCommodity(data: {
	slug: string;
	name: string;
	nameCn?: string;
	category: string;
	unit: string;
	currency?: string;
	metadata?: Record<string, unknown>;
}) {
	let commodity = await prisma.commodity.findUnique({
		where: { slug: data.slug },
	});
	if (!commodity) {
		commodity = await prisma.commodity.create({
			data: {
				slug: data.slug,
				name: data.name,
				nameCn: data.nameCn,
				category: data.category,
				unit: data.unit,
				currency: data.currency ?? "USD",
				isActive: true,
				metadata: data.metadata ? json(data.metadata) : undefined,
			},
		});
	}
	return commodity;
}

/** Upsert a CommodityPrice row. Uses findUnique + upsert to track insert vs update counts. */
export async function upsertPrice(data: {
	commodityId: string;
	date: Date;
	interval?: string;
	source: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number | null;
	metadata?: Record<string, unknown>;
}) {
	const interval = data.interval ?? "daily";
	const existed = await prisma.commodityPrice.findUnique({
		where: {
			commodityId_interval_date_source: {
				commodityId: data.commodityId,
				interval,
				date: data.date,
				source: data.source,
			},
		},
		select: { id: true, open: true, high: true, low: true, close: true, volume: true },
	});

	// If the row exists with identical values, skip the write entirely and
	// report neither insert nor update — a no-op re-scrape of the same data
	// should not inflate the "updated" count (which previously made FRED's
	// 7-day re-fetch look like 246K updates when zero values actually changed).
	if (existed) {
		const samePrice =
			Number(existed.open) === data.open &&
			Number(existed.high) === data.high &&
			Number(existed.low) === data.low &&
			Number(existed.close) === data.close &&
			(existed.volume === null
				? data.volume == null
				: Number(existed.volume) === (data.volume ?? null));
		if (samePrice) {
			return { inserted: 0, updated: 0 };
		}
	}

	// Scale guard (round-115): a close more than 20× the series' recent
	// median is a unit mismatch, not a market move — wheat_cme mixed $/bu
	// closes (~6.8) with ¢/bu (~667) and the bad scale flowed all the way
	// into verified predictions at MAPE≈9500. Reject the write; the run then
	// reports 0 rows and classifyIngestionStatus marks it "warning" so the
	// freshness board surfaces the anomaly instead of silently storing it.
	// Skipped when the series has <5 points (a new series' first values have
	// no median to compare against) and on the samePrice no-op path above.
	const SCALE_GUARD_FACTOR = 20;
	const SCALE_GUARD_MIN_HISTORY = 5;
	const recent = await prisma.commodityPrice.findMany({
		where: { commodityId: data.commodityId, interval },
		orderBy: { date: "desc" },
		take: 30,
		select: { close: true },
	});
	const recentCloses = recent
		.map((r) => Number(r.close))
		.filter((v) => Number.isFinite(v) && v !== 0)
		.sort((a, b) => a - b);
	if (recentCloses.length >= SCALE_GUARD_MIN_HISTORY) {
		const median =
			recentCloses.length % 2 !== 0
				? recentCloses[Math.floor(recentCloses.length / 2)]
				: (recentCloses[recentCloses.length / 2 - 1] + recentCloses[recentCloses.length / 2]) / 2;
		if (Math.abs(data.close) > Math.abs(median) * SCALE_GUARD_FACTOR) {
			logger.warn(
				`[scale-guard] rejected ${data.source} price for ${data.commodityId} @ ${data.date.toISOString().slice(0, 10)}: close=${data.close} vs series median ${median.toFixed(4)} (>20× — likely unit mismatch)`,
			);
			return { inserted: 0, updated: 0, scaleGuarded: true };
		}
	}

	await prisma.commodityPrice.upsert({
		where: {
			commodityId_interval_date_source: {
				commodityId: data.commodityId,
				interval,
				date: data.date,
				source: data.source,
			},
		},
		update: {
			open: data.open,
			high: data.high,
			low: data.low,
			close: data.close,
			volume: data.volume ?? null,
			metadata: data.metadata ? json(data.metadata) : undefined,
		},
		create: {
			commodityId: data.commodityId,
			date: data.date,
			interval,
			open: data.open,
			high: data.high,
			low: data.low,
			close: data.close,
			volume: data.volume ?? null,
			source: data.source,
			metadata: data.metadata ? json(data.metadata) : undefined,
		},
	});

	// Honesty fix (round-45, symmetric to round-30's cut-series invalidation):
	// when a scraper actually wrote/changed a price, any cached prediction built
	// on the old series is now stale. Evict it so the next request recomputes
	// against fresh data instead of serving a stale forecast for up to the
	// 45-min TTL. Fire-and-forget + dynamic import to avoid a circular dep
	// (helpers → predictionCache → ... → helpers). Skipped on the samePrice
	// no-op path above because nothing changed there.
	void invalidateCommodityCache(data.commodityId).catch(() => {
		// Redis down / unavailable — the cache will expire on its own TTL.
		// Invalidation is best-effort; it must never break the price write.
	});

	return existed ? { inserted: 0, updated: 1 } : { inserted: 1, updated: 0 };
}

/**
 * Upsert a MarketFactor row. Uses findUnique + upsert to track insert vs update counts.
 *
 * `seriesKey` disambiguates series that share type+region+date (FRED's 15
 * "economic"/"US" series, USDA-PSD's commodity×attribute rows). Callers that
 * already encode the series into type/region (weather, exchange_rate,
 * shipping, customs…) omit it and share the "" default.
 */
export async function upsertFactor(data: {
	type: string;
	region: string;
	date: Date;
	value: number;
	unit: string;
	source: string;
	seriesKey?: string;
	metadata?: Record<string, unknown>;
}) {
	const key = {
		type: data.type,
		region: data.region,
		date: data.date,
		seriesKey: data.seriesKey ?? "",
	};
	const existed = await prisma.marketFactor.findUnique({
		where: { type_region_date_seriesKey: key },
		select: { id: true, value: true, unit: true },
	});

	// If the row exists with identical value+unit, skip the write entirely and
	// report neither insert nor update — same no-op short-circuit as upsertPrice.
	// Without this, every re-scrape of unchanged factor data (FRED/USDA/SECEX/etc.)
	// reported {updated:1}, inflating ingestion metrics identically to the
	// fixed upsertPrice count bug.
	if (existed) {
		const sameFactor = Number(existed.value) === data.value && existed.unit === data.unit;
		if (sameFactor) {
			return { inserted: 0, updated: 0 };
		}
	}

	await prisma.marketFactor.upsert({
		where: { type_region_date_seriesKey: key },
		update: {
			value: data.value,
			unit: data.unit,
			source: data.source,
			metadata: data.metadata ? json(data.metadata) : undefined,
		},
		create: {
			type: data.type,
			region: data.region,
			date: data.date,
			value: data.value,
			unit: data.unit,
			source: data.source,
			seriesKey: data.seriesKey ?? "",
			metadata: data.metadata ? json(data.metadata) : undefined,
		},
	});
	return existed ? { inserted: 0, updated: 1 } : { inserted: 1, updated: 0 };
}

/** Date to YYYYMMDD for Stooq-style APIs. */
export function formatDateYMD(d: Date): string {
	return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse YYYYMM or YYYY-MM to Date (first of month, UTC). */
export function parseMonth(str: string): Date | null {
	const m = str.replace(/-/g, "").match(/^(\d{4})(\d{2})$/);
	if (!m) return null;
	return new Date(`${m[1]}-${m[2]}-01T00:00:00Z`);
}

/** Generate month list YYYYMM between two dates. */
export function monthRange(start: Date, end: Date): string[] {
	const months: string[] = [];
	const d = new Date(start);
	while (d <= end) {
		months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
		d.setMonth(d.getMonth() + 1);
	}
	return months;
}

/** Generate list of YYYYMMDD strings for last N days. */
export function lastNDays(n: number): { start: string; end: string } {
	const end = new Date();
	const start = new Date();
	start.setDate(start.getDate() - n);
	return { start: formatDateYMD(start), end: formatDateYMD(end) };
}
