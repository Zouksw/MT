/**
 * getPricesBySource — newest-window semantics (round-106 regression).
 *
 * The query was `orderBy date asc + take limit`, so with limit=365 across
 * ALL sources combined the endpoint returned each source's EARLIEST history
 * — multi-source comparison charts showed years-old prices and silently
 * truncated the recent window. Now: desc + take (newest rows), reversed
 * back to chronological order for charting.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPricesBySource } from "@/services/marketService";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

describe("getPricesBySource — returns the newest window, chronological", () => {
	let ctx: TestContext;
	const slug = `by-source-${Date.now()}`;

	beforeAll(async () => {
		ctx = await createTestContext("bysource");
		if (!ctx.available)
			throw new Error(
				"marketService bySource: integration suite requires PostgreSQL+Redis. Start them or run unit tests only — a silent skip would report false-green.",
			);

		const commodity = await ctx.prisma.commodity.create({
			data: { slug, name: "BySource Fixture", category: "livestock", unit: "USD" },
		});

		// Two sources × (3 ancient 2020 rows + 3 recent rows). limit=3 must
		// return the 3 newest rows per the combined-source window semantics —
		// NOT the 2020 rows the old ascending order produced.
		const rows: Array<{ source: string; day: string; close: number }> = [];
		for (const source of ["src-a", "src-b"]) {
			for (const [day, close] of [
				["2020-01-01", 10],
				["2020-01-02", 11],
				["2020-01-03", 12],
				["2026-08-13", 90],
				["2026-08-14", 91],
				["2026-08-15", 92],
			] as const) {
				rows.push({ source, day, close });
			}
		}
		for (const r of rows) {
			await ctx.prisma.commodityPrice.create({
				data: {
					commodityId: commodity.id,
					date: new Date(`${r.day}T00:00:00Z`),
					interval: "daily",
					source: r.source,
					open: r.close,
					high: r.close,
					low: r.close,
					close: r.close,
				},
			});
		}
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("limit=3 returns the three NEWEST dates, not the 2020 rows", async () => {
		const { sources } = await getPricesBySource(slug, "daily", 3);

		const allDates = Object.values(sources)
			.flat()
			.map((p) => p.date);
		expect(allDates.length).toBeGreaterThan(0);
		for (const d of allDates) {
			expect(d.startsWith("2020")).toBe(false);
		}
		expect(new Set(allDates).size).toBeLessThanOrEqual(3);
	});

	it("each source's series is in chronological (ascending) order", async () => {
		const { sources } = await getPricesBySource(slug, "daily", 6);
		expect(Object.keys(sources)).toContain("src-a");

		for (const series of Object.values(sources)) {
			const iso = series.map((p) => p.date);
			const sorted = [...iso].sort();
			expect(iso).toEqual(sorted);
		}
	});
});
