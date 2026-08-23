/**
 * getPriceHistory — newest-window semantics (round-119 regression).
 *
 * Same bug class getPricesBySource fixed in round-106: `orderBy date asc +
 * take limit` returned the OLDEST `limit` rows, so a rangeless request (the
 * frontend CommodityPriceChart calls `?interval=daily`) rendered 2020-era
 * prices for any series with more history than `limit`. Now: desc + take,
 * reversed back to chronological order.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { batchLatestPrices } from "@/services/inference/authoritativeSources";
import { getPriceHistory } from "@/services/marketService";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

describe("getPriceHistory — returns the newest window, chronological", () => {
	let ctx: TestContext;
	const slug = `price-history-${Date.now()}`;

	beforeAll(async () => {
		ctx = await createTestContext("pricehistory");
		if (!ctx.available)
			throw new Error(
				"marketService priceHistory: integration suite requires PostgreSQL+Redis. Start them or run unit tests only — a silent skip would report false-green.",
			);

		const commodity = await ctx.prisma.commodity.create({
			data: { slug, name: "PriceHistory Fixture", category: "livestock", unit: "USD" },
		});

		// 3 ancient 2020 rows + 3 recent rows. limit=3 must return the recent
		// window — NOT the 2020 rows the old ascending order produced.
		for (const [day, close] of [
			["2020-01-01", 10],
			["2020-01-02", 11],
			["2020-01-03", 12],
			["2026-08-19", 90],
			["2026-08-20", 91],
			["2026-08-21", 92],
		] as const) {
			await ctx.prisma.commodityPrice.create({
				data: {
					commodityId: commodity.id,
					date: new Date(`${day}T00:00:00Z`),
					interval: "daily",
					source: "src-h",
					open: close,
					high: close,
					low: close,
					close,
				},
			});
		}
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("limit=3 returns the three NEWEST dates, not the 2020 rows", async () => {
		const { prices } = await getPriceHistory(slug, { interval: "daily", limit: 3 });

		expect(prices.length).toBe(3);
		for (const p of prices) {
			expect(p.date.getFullYear()).toBe(2026);
		}
	});

	it("returns the window in chronological (ascending) order", async () => {
		const { prices } = await getPriceHistory(slug, { interval: "daily", limit: 3 });
		const iso = prices.map((p) => p.date.toISOString());
		expect(iso).toEqual([...iso].sort());
	});
});

describe("getPriceHistory + batchLatestPrices — monthly fallback (round-129 batch 7)", () => {
	let ctx: TestContext;
	const slug = `monthly-fb-${Date.now()}`;

	beforeAll(async () => {
		ctx = await createTestContext("monthlyfb");
		if (!ctx.available)
			throw new Error(
				"marketService monthly fallback: integration suite requires PostgreSQL+Redis. Start them or run unit tests only — a silent skip would report false-green.",
			);

		const commodity = await ctx.prisma.commodity.create({
			data: { slug, name: "Monthly Fallback Fixture", category: "livestock", unit: "USD" },
		});
		// Monthly-only series (the beef_carcass_us / world_bank shape): no
		// daily rows exist at all.
		for (const [month, close] of [
			["2026-05-01", 100],
			["2026-06-01", 101],
			["2026-07-01", 102],
		] as const) {
			await ctx.prisma.commodityPrice.create({
				data: {
					commodityId: commodity.id,
					date: new Date(`${month}T00:00:00Z`),
					interval: "monthly",
					source: "src-mf",
					open: close,
					high: close,
					low: close,
					close,
				},
			});
		}
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("daily request on a monthly-only series returns monthly rows instead of []", async () => {
		const { prices } = await getPriceHistory(slug, { interval: "daily", limit: 10 });

		expect(prices.length).toBe(3);
		// Monthly rows land on month-start dates.
		for (const p of prices) expect(p.date.getUTCDate()).toBe(1);
	});

	it("explicit monthly request is unaffected", async () => {
		const { prices } = await getPriceHistory(slug, { interval: "monthly", limit: 2 });

		expect(prices.length).toBe(2);
		expect(prices[1].date.toISOString().startsWith("2026-07")).toBe(true);
	});

	it("batchLatestPrices resolves monthly-only commodities with their cadence", async () => {
		const { commodity } = await getPriceHistory(slug, { interval: "monthly", limit: 1 });
		const map = await batchLatestPrices([{ id: commodity.id, slug }]);
		const row = map.get(commodity.id);

		// Previously monthly-only ids resolved to "no row" — consumers showed
		// them as price-less. Now the monthly close arrives with its cadence.
		expect(row).toBeDefined();
		expect(row?.interval).toBe("monthly");
		expect(Number(row?.close)).toBe(102);
	});
});
