/**
 * Shared helpers for data ingestion scrapers.
 *
 * Eliminates repeated upsert patterns across all scrapers.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib";

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
	return existed ? { inserted: 0, updated: 1 } : { inserted: 1, updated: 0 };
}

/** Upsert a MarketFactor row. Uses findUnique + upsert to track insert vs update counts. */
export async function upsertFactor(data: {
	type: string;
	region: string;
	date: Date;
	value: number;
	unit: string;
	source: string;
	metadata?: Record<string, unknown>;
}) {
	const existed = await prisma.marketFactor.findUnique({
		where: { type_region_date: { type: data.type, region: data.region, date: data.date } },
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
		where: { type_region_date: { type: data.type, region: data.region, date: data.date } },
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
