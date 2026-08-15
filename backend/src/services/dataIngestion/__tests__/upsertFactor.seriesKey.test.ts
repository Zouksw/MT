/**
 * upsertFactor series-key regression (round-104 / audit C4).
 *
 * The old [type, region, date] unique key made every series sharing that
 * triple overwrite the previous one on write — 15 FRED "economic"/"US"
 * series and USDA-PSD commodity×attribute rows silently destroyed each
 * other per date. The widened [type, region, date, seriesKey] key must keep
 * them as separate rows, and the same-key path must still upsert in place.
 *
 * DB-backed: runs against the seeded scratch/test DB like the route
 * integration suites. Rows are created under a "r104" prefix and removed
 * in afterAll.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { upsertFactor } from "@/services/dataIngestion/helpers";
import { requireDb } from "@/test/helpers/testApp";

const TYPE = "r104_economic";
const REGION = "US";
const DATE = new Date("2026-08-01T00:00:00.000Z");

async function cleanup() {
	await prisma.marketFactor.deleteMany({
		where: { type: { startsWith: "r104_" } },
	});
}

beforeAll(async () => {
	await requireDb("upsertFactor seriesKey");
	await cleanup();
});

afterAll(async () => {
	await cleanup();
});

describe("upsertFactor — seriesKey disambiguation", () => {
	it("two series sharing type/region/date coexist as separate rows", async () => {
		const a = await upsertFactor({
			type: TYPE,
			region: REGION,
			date: DATE,
			value: 1.23,
			unit: "index",
			source: "r104-test",
			seriesKey: "CPIAUCSL",
			metadata: { seriesId: "CPIAUCSL" },
		});
		const b = await upsertFactor({
			type: TYPE,
			region: REGION,
			date: DATE,
			value: 4.56,
			unit: "percent",
			source: "r104-test",
			seriesKey: "T10Y2Y",
			metadata: { seriesId: "T10Y2Y" },
		});

		// Before the fix, the second write reported {updated:1} — it had just
		// overwritten the first series' value/unit.
		expect(a).toEqual({ inserted: 1, updated: 0 });
		expect(b).toEqual({ inserted: 1, updated: 0 });

		const rows = await prisma.marketFactor.findMany({
			where: { type: TYPE, region: REGION, date: DATE },
			orderBy: { seriesKey: "asc" },
		});
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.seriesKey).sort()).toEqual(["CPIAUCSL", "T10Y2Y"]);
		expect(rows.map((r) => Number(r.value)).sort()).toEqual([1.23, 4.56]);
	});

	it("same seriesKey upserts in place and the no-op short-circuit still works", async () => {
		const first = await upsertFactor({
			type: TYPE,
			region: REGION,
			date: DATE,
			value: 9.99,
			unit: "index",
			source: "r104-test",
			seriesKey: "CPIAUCSL",
		});
		expect(first).toEqual({ inserted: 0, updated: 1 });

		const noop = await upsertFactor({
			type: TYPE,
			region: REGION,
			date: DATE,
			value: 9.99,
			unit: "index",
			source: "r104-test",
			seriesKey: "CPIAUCSL",
		});
		expect(noop).toEqual({ inserted: 0, updated: 0 });

		const rows = await prisma.marketFactor.findMany({
			where: { type: TYPE, region: REGION, date: DATE },
		});
		expect(rows).toHaveLength(2); // still 2 — nothing collapsed
	});

	it('omitted seriesKey defaults to "" (legacy single-series callers)', async () => {
		const res = await upsertFactor({
			type: "r104_exchange_rate",
			region: "AUD/USD",
			date: DATE,
			value: 0.66,
			unit: "rate",
			source: "r104-test",
		});
		expect(res).toEqual({ inserted: 1, updated: 0 });
		const row = await prisma.marketFactor.findFirst({
			where: { type: "r104_exchange_rate" },
		});
		expect(row?.seriesKey).toBe("");
	});
});
