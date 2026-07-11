/**
 * upsertFactor — count-accuracy regression test.
 *
 * Pins the fix for the "updated" count inflation on MarketFactor rows: a
 * no-op re-scrape of the same row (identical value+unit) must report NEITHER
 * inserted NOR updated. Before the fix, any existing row returned {updated:1}
 * even when nothing changed — same class of bug as the fixed upsertPrice,
 * affecting every factor source (FRED/USDA-PSD/SECEX/ABARES/shipping/weather).
 *
 * Uses real PostgreSQL (same convention as upsertPrice.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { upsertFactor } from "@/services/dataIngestion/helpers";

// Fixture state ---------------------------------------------------------

const createdFactorKeys: Array<{ type: string; region: string; date: Date }> = [];

const BASE = {
	type: `test-factor-${Date.now()}`,
	region: "global",
	date: new Date("2026-07-01T00:00:00Z"),
	value: 42.5,
	unit: "USD",
	source: "test-src",
};

beforeEach(() => {
	// Give each test a unique type to avoid cross-test collision.
	BASE.type = `test-factor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
});

afterEach(async () => {
	// Clean up the market factor rows we created.
	for (const key of createdFactorKeys) {
		await prisma.marketFactor
			.deleteMany({ where: { type: key.type, region: key.region, date: key.date } })
			.catch(() => {});
	}
	createdFactorKeys.length = 0;
});

// Tests -----------------------------------------------------------------

describe("upsertFactor — count accuracy", () => {
	it("first write of a row reports {inserted:1, updated:0}", async () => {
		const r = await upsertFactor(BASE);
		createdFactorKeys.push({ type: BASE.type, region: BASE.region, date: BASE.date });
		expect(r).toEqual({ inserted: 1, updated: 0 });
	});

	it("re-writing the SAME value+unit reports {inserted:0, updated:0} (no inflation)", async () => {
		// THIS IS THE REGRESSION TEST. Before the fix, the second call returned
		// {updated:1} even though nothing changed — inflating ingestion metrics
		// for every factor source on every re-scrape.
		await upsertFactor(BASE);
		createdFactorKeys.push({ type: BASE.type, region: BASE.region, date: BASE.date });
		const r = await upsertFactor(BASE); // identical value+unit
		expect(r).toEqual({ inserted: 0, updated: 0 });
	});

	it("writing a CHANGED value reports {inserted:0, updated:1}", async () => {
		await upsertFactor(BASE);
		createdFactorKeys.push({ type: BASE.type, region: BASE.region, date: BASE.date });
		const r = await upsertFactor({ ...BASE, value: 43.0 }); // value changed
		expect(r).toEqual({ inserted: 0, updated: 1 });
	});

	it("writing a CHANGED unit reports {inserted:0, updated:1}", async () => {
		await upsertFactor(BASE);
		createdFactorKeys.push({ type: BASE.type, region: BASE.region, date: BASE.date });
		const r = await upsertFactor({ ...BASE, unit: "EUR" }); // unit changed (unit conversion case)
		expect(r).toEqual({ inserted: 0, updated: 1 });
	});
});
