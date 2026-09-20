import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib";
import { FAO_INDEX_SERIES, parseFaoIndices, persistFaoIndexPoints } from "../faoIndex";

const SLUGS = FAO_INDEX_SERIES.map((s) => s.slug);

/** Live-shaped CSV body: 3 junk lines before the header (title, base line,
 * blank), trailing empty columns, one unpublished cell, one future-blank row. */
const FIXTURE_CSV = [
	"FAO Food Price Index," + ",".repeat(60),
	"2014-2016=100," + ",".repeat(60),
	"Date,Food Price Index,Meat,Dairy,Cereals,Oils,Sugar," + ",".repeat(60),
	"," + ",".repeat(60),
	"2026-06,130.1,130.5,116.9,110.0,192.0,90.0," + ",".repeat(60),
	"2026-07,130.8,126.7,116.6,113.8,195.7,95.0," + ",".repeat(60),
	"2026-08,133.3,127.9,119.2,116.3,196.9,106.4," + ",".repeat(60),
	"2026-09,,," + ",".repeat(60), // nothing published yet — row ignored
].join("\n");

afterAll(async () => {
	// Commodities cascade-delete their prices, so slug-level cleanup suffices.
	await prisma.commodity.deleteMany({ where: { slug: { in: SLUGS } } });
});

// ---------------------------------------------------------------------------
// parseFaoIndices — pure parser against the live file shape.
// ---------------------------------------------------------------------------
describe("parseFaoIndices", () => {
	test("finds the header by its Date, prefix (not a fixed line number)", () => {
		const points = parseFaoIndices(FIXTURE_CSV);
		expect(points).toHaveLength(18); // 6 series × 3 published months
	});

	test("maps each column to its series slug with month-start dates", () => {
		const meat = parseFaoIndices(FIXTURE_CSV).filter((p) => p.slug === "fao_meat_index");
		expect(meat.map((p) => p.date.toISOString().slice(0, 7))).toEqual([
			"2026-06",
			"2026-07",
			"2026-08",
		]);
		expect(meat.map((p) => p.value)).toEqual([130.5, 126.7, 127.9]);
	});

	test("skips unpublished cells instead of zero-filling", () => {
		const points = parseFaoIndices(FIXTURE_CSV);
		expect(points.every((p) => p.value > 0)).toBe(true);
		expect(points.find((p) => p.date.toISOString().startsWith("2026-09"))).toBeUndefined();
	});

	test("returns [] when the header is missing (format change → honest empty)", () => {
		expect(parseFaoIndices("<html>302 moved</html>\nnothing,here")).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// persistFaoIndexPoints — integration on the test DB (mt_test).
// ---------------------------------------------------------------------------
describe("persistFaoIndexPoints", () => {
	test("first run backfills, re-run is a true no-op, tail window bounds later writes", async () => {
		const points = parseFaoIndices(FIXTURE_CSV);

		// Backfill: also feed older months so the incremental window is real.
		const older = points.map((p) => {
			const d = new Date(p.date);
			d.setUTCMonth(d.getUTCMonth() - 12);
			return { ...p, date: d };
		});
		const first = await persistFaoIndexPoints([...older, ...points]);
		expect(first.inserted).toBe(36); // 6 series × 6 months (12m old + recent 3)
		expect(first.touched).toBe(36);

		// Same data again → samePrice no-op everywhere (noChange contract).
		const second = await persistFaoIndexPoints([...older, ...points]);
		expect(second.inserted).toBe(0);
		expect(second.updated).toBe(0);

		// Tail window: once rows exist, only the newest 3 months per series are
		// touched — the 12-months-ago rows are outside the window even though
		// they are still in the parsed payload.
		const third = await persistFaoIndexPoints([...older, ...points]);
		expect(third.touched).toBe(18); // 6 series × 3 tail months
		expect(third.inserted).toBe(0);
		expect(third.updated).toBe(0);

		// A revised value in the tail window lands as an update.
		const revised = points.map((p) =>
			p.date.toISOString().startsWith("2026-08") ? { ...p, value: p.value + 0.1 } : p,
		);
		const fourth = await persistFaoIndexPoints([...older, ...revised]);
		expect(fourth.updated).toBe(6); // one revised row per series
	});

	test("rows land as flat monthly candles under the fao_index source", async () => {
		const commodity = await prisma.commodity.findUnique({
			where: { slug: "fao_meat_index" },
			include: { prices: true },
		});
		expect(commodity).not.toBeNull();
		expect(commodity?.category).toBe("price_index");
		expect(commodity?.unit).toBe("index (2014-2016=100)");
		expect(
			commodity?.prices.every((p) => p.interval === "monthly" && p.source === "fao_index"),
		).toBe(true);
		const aRow = commodity?.prices[0];
		expect(aRow && Number(aRow.open) === Number(aRow.close)).toBe(true);
	});
});
