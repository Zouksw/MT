/**
 * upsertPrice — count-accuracy regression test.
 *
 * Pins the fix for the "updated" count inflation: a no-op re-scrape of the
 * same row (identical OHLCV) must report NEITHER inserted NOR updated.
 * Before the fix, any existing row returned {updated:1} even when no value
 * changed, which made FRED's 7-day re-fetch look like 246K updates while
 * zero real data changed.
 *
 * Uses real PostgreSQL (same convention as datasetService.idor.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { upsertPrice } from "@/services/dataIngestion/helpers";

// Fixture state ---------------------------------------------------------

let commodityId: string;
const createdCommodityIds: string[] = [];

const BASE = {
	commodityId: "" as string,
	date: new Date("2026-07-01T00:00:00Z"),
	interval: "daily",
	source: "test-src",
	open: 100,
	high: 110,
	low: 95,
	close: 105,
	volume: 1000,
};

beforeEach(async () => {
	const c = await prisma.commodity.create({
		data: {
			name: `upsert-test-${Date.now()}`,
			slug: `upsert-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			category: "test",
			unit: "USD",
		},
	});
	commodityId = c.id;
	createdCommodityIds.push(c.id);
	BASE.commodityId = commodityId;
});

afterEach(async () => {
	// Clean prices then commodities (FK order).
	await prisma.commodityPrice
		.deleteMany({
			where: { commodityId: { in: createdCommodityIds } },
		})
		.catch(() => {});
	await prisma.commodity.deleteMany({ where: { id: { in: createdCommodityIds } } }).catch(() => {});
	createdCommodityIds.length = 0;
});

// Tests -----------------------------------------------------------------

describe("upsertPrice — count accuracy", () => {
	it("first write of a row reports {inserted:1, updated:0}", async () => {
		const r = await upsertPrice(BASE);
		expect(r).toEqual({ inserted: 1, updated: 0 });
	});

	it("re-writing the SAME values reports {inserted:0, updated:0} (no inflation)", async () => {
		// THIS IS THE REGRESSION TEST. Before the fix, the second call returned
		// {updated:1} even though nothing changed — inflating ingestion metrics.
		await upsertPrice(BASE);
		const r = await upsertPrice(BASE); // identical OHLCV
		expect(r).toEqual({ inserted: 0, updated: 0 });
	});

	it("writing CHANGED values reports {inserted:0, updated:1}", async () => {
		await upsertPrice(BASE);
		const r = await upsertPrice({ ...BASE, close: 106 }); // close changed
		expect(r).toEqual({ inserted: 0, updated: 1 });
	});

	it("changing only volume reports an update (volume is part of equality)", async () => {
		await upsertPrice(BASE);
		const r = await upsertPrice({ ...BASE, volume: 2000 });
		expect(r).toEqual({ inserted: 0, updated: 1 });
	});

	it("null volume both sides is treated as equal (no update)", async () => {
		await prisma.commodityPrice.create({
			data: {
				commodityId,
				date: BASE.date,
				interval: "daily",
				source: BASE.source,
				open: 100,
				high: 110,
				low: 95,
				close: 105,
				volume: null,
			},
		});
		const r = await upsertPrice({ ...BASE, volume: null });
		expect(r).toEqual({ inserted: 0, updated: 0 });
	});
});
