import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib";
import { aggregateOtsRows, type OtsRow, persistOtsMonths } from "../hmrcOts";

afterAll(async () => {
	await prisma.marketFactor.deleteMany({ where: { source: "hmrc_ots" } });
});

// ---------------------------------------------------------------------------
// aggregateOtsRows — pure chapter×month aggregation with derived unit price.
// ---------------------------------------------------------------------------
describe("aggregateOtsRows", () => {
	test("aggregates CN8 ids into HS4 chapters and derives GBP/ton", () => {
		const rows: OtsRow[] = [
			// 0201 chapter: two CN8 lines, same month → summed then priced.
			{ MonthId: 202607, CommodityId: 2011000, Value: 40000, NetMass: 8000 },
			{ MonthId: 202607, CommodityId: 2012020, Value: 10000, NetMass: 2000 },
			// 0202 chapter, different month.
			{ MonthId: 202606, CommodityId: 2023010, Value: 187611, NetMass: 45000 },
		];
		const months = aggregateOtsRows(rows);
		expect(months).toHaveLength(2);
		const frozen = months.find((m) => m.chapter === "0202");
		expect(frozen?.date.toISOString().slice(0, 7)).toBe("2026-06");
		// 187611 £ / 45000 kg × 1000 = 4169.133... £/t
		expect(frozen?.gbpPerTon).toBeCloseTo(4169.133333, 4);
		const fresh = months.find((m) => m.chapter === "0201");
		expect(fresh?.valueGbp).toBe(50000);
		expect(fresh?.gbpPerTon).toBeCloseTo(5000, 6);
	});

	test("suppressed (null) rows contribute zero; zero-value months are dropped", () => {
		const rows: OtsRow[] = [
			{ MonthId: 202605, CommodityId: 2021000, Value: null, NetMass: 1200 },
			{ MonthId: 202604, CommodityId: 2023010, Value: 0, NetMass: 0 },
		];
		expect(aggregateOtsRows(rows)).toEqual([]);
	});

	test("priced month with suppressed mass keeps totals but null price (no invented division)", () => {
		const rows: OtsRow[] = [{ MonthId: 202610, CommodityId: 2023010, Value: 4466, NetMass: null }];
		const months = aggregateOtsRows(rows);
		expect(months).toHaveLength(1);
		expect(months[0].gbpPerTon).toBeNull();
		expect(months[0].valueGbp).toBe(4466);
	});

	test("non-bovine commodity ids are ignored", () => {
		const rows: OtsRow[] = [{ MonthId: 202607, CommodityId: 3011000, Value: 99999, NetMass: 9999 }];
		expect(aggregateOtsRows(rows)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// persistOtsMonths — integration on the test DB (mt_test).
// ---------------------------------------------------------------------------
describe("persistOtsMonths", () => {
	test("lands chapter rows with mirror-family shape; re-run no-ops; revision updates", async () => {
		const months = aggregateOtsRows([
			{ MonthId: 202607, CommodityId: 2011000, Value: 40000, NetMass: 8000 },
			{ MonthId: 202607, CommodityId: 2023010, Value: 187611, NetMass: 45000 },
		]);

		const first = await persistOtsMonths(months);
		expect(first.inserted).toBe(2);

		const second = await persistOtsMonths(months);
		expect(second.inserted).toBe(0);
		expect(second.updated).toBe(0);

		const revised = months.map((m) => ({ ...m, gbpPerTon: (m.gbpPerTon ?? 0) + 10 }));
		const third = await persistOtsMonths(revised);
		expect(third.updated).toBe(2);

		const stored = await prisma.marketFactor.findMany({
			where: { source: "hmrc_ots" },
			orderBy: { type: "asc" },
		});
		expect(stored.map((f) => f.type).sort()).toEqual([
			"export_uk_to_cn_0201",
			"export_uk_to_cn_0202",
		]);
		expect(stored.every((f) => f.region === "GB→CN" && f.unit === "GBP/ton")).toBe(true);
		expect(stored[0].metadata?.valueGbp).toBe(40000);
	});

	test("null-price months are not persisted (no division invented)", async () => {
		const nullPrice = aggregateOtsRows([
			{ MonthId: 202610, CommodityId: 2023010, Value: 4466, NetMass: null },
		]);
		const r = await persistOtsMonths(nullPrice);
		expect(r.inserted).toBe(0);
	});
});
