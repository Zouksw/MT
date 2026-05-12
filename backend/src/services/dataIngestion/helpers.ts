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

/** Upsert a CommodityPrice row. Returns 1 inserted or 1 updated. */
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
	const existing = await prisma.commodityPrice.findUnique({
		where: {
			commodityId_interval_date_source: {
				commodityId: data.commodityId,
				interval,
				date: data.date,
				source: data.source,
			},
		},
	});

	const priceData = {
		open: data.open,
		high: data.high,
		low: data.low,
		close: data.close,
		volume: data.volume ?? null,
		source: data.source,
		metadata: data.metadata ? json(data.metadata) : undefined,
	};

	if (existing) {
		await prisma.commodityPrice.update({
			where: { id: existing.id },
			data: priceData,
		});
		return { inserted: 0, updated: 1 };
	}
	await prisma.commodityPrice.create({
		data: { commodityId: data.commodityId, date: data.date, interval, ...priceData },
	});
	return { inserted: 1, updated: 0 };
}

/** Upsert a MarketFactor row. Returns 1 inserted or 1 updated. */
export async function upsertFactor(data: {
	type: string;
	region: string;
	date: Date;
	value: number;
	unit: string;
	source: string;
	metadata?: Record<string, unknown>;
}) {
	const existing = await prisma.marketFactor.findUnique({
		where: { type_region_date: { type: data.type, region: data.region, date: data.date } },
	});

	const factorData = {
		value: data.value,
		unit: data.unit,
		source: data.source,
		metadata: data.metadata ? json(data.metadata) : undefined,
	};

	if (existing) {
		await prisma.marketFactor.update({
			where: { id: existing.id },
			data: factorData,
		});
		return { inserted: 0, updated: 1 };
	}
	await prisma.marketFactor.create({
		data: { type: data.type, region: data.region, date: data.date, ...factorData },
	});
	return { inserted: 1, updated: 0 };
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
