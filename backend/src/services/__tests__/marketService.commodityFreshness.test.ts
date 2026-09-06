/**
 * Cadence policy + interval-aware commodity freshness (round-129 batch 6a).
 *
 * getCommodityFreshness was daily-only: monthly-only series (beef_carcass_us
 * = IMF PBEEFUSDM, the world_bank group) showed lastUpdated null / stale true
 * regardless of how fresh their monthly points were, and the whole freshness
 * board misreported them. Now each commodity reports the cadence of its
 * newest point and goes stale on the cadence-aware threshold (7d daily /
 * 60d monthly).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stalenessWindowDays, stalenessWindowDaysForSeries } from "@/services/cadence";
import { getCommodityFreshness } from "@/services/marketService";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

describe("stalenessWindowDays — cadence policy", () => {
	it("daily keeps the historical 7-day window", () => {
		expect(stalenessWindowDays("daily")).toBe(7);
	});

	it("monthly uses 90 days (measured first-ingest lag 44–53d; healthy newest point ages to ~76d mid-cycle — round-132)", () => {
		expect(stalenessWindowDays("monthly")).toBe(90);
	});

	it("unknown/absent cadence falls back to the daily window (fail-closed to the short window)", () => {
		expect(stalenessWindowDays("weekly")).toBe(21);
		expect(stalenessWindowDays("")).toBe(7);
	});
});

describe("stalenessWindowDaysForSeries — publication-rhythm override (round-158 批C)", () => {
	it("H.10 FX trio: weekly-batched daily series get the 14d window at ANY point cadence", () => {
		expect(stalenessWindowDaysForSeries("daily", "usd_cny")).toBe(14);
		expect(stalenessWindowDaysForSeries("daily", "brl_usd")).toBe(14);
		expect(stalenessWindowDaysForSeries("daily", "eur_usd")).toBe(14);
	});

	it("unregistered slugs keep the cadence default (no accidental loosening)", () => {
		expect(stalenessWindowDaysForSeries("daily", "live_cattle_cme")).toBe(7);
		expect(stalenessWindowDaysForSeries("monthly", "beef_carcass_us")).toBe(90);
		expect(stalenessWindowDaysForSeries("daily", undefined)).toBe(7);
		expect(stalenessWindowDaysForSeries("daily", null)).toBe(7);
	});
});

describe("getCommodityFreshness — interval-aware (round-129 batch 6a)", () => {
	let ctx: TestContext;
	const monthlySlug = `fresh-monthly-${Date.now()}`;
	const dailySlug = `fresh-daily-${Date.now()}`;
	let monthlyId = "";
	let dailyId = "";

	beforeAll(async () => {
		ctx = await createTestContext("cadence");
		if (!ctx.available)
			throw new Error(
				"commodityFreshness: integration suite requires PostgreSQL+Redis. Start them or run unit tests only — a silent skip would report false-green.",
			);

		const monthly = await ctx.prisma.commodity.create({
			data: {
				slug: monthlySlug,
				name: "Fresh Monthly Fixture",
				category: "livestock",
				unit: "USD",
			},
		});
		monthlyId = monthly.id;
		// Monthly point ~53 days old — inside the 90d monthly window (and at
		// the measured first-ingest lag), far outside the 7d daily window.
		const mDate = new Date(Date.now() - 53 * 24 * 3600 * 1000);
		await ctx.prisma.commodityPrice.create({
			data: {
				commodityId: monthlyId,
				date: mDate,
				interval: "monthly",
				source: "src-cad",
				close: 331,
				open: 331,
				high: 331,
				low: 331,
			},
		});

		const daily = await ctx.prisma.commodity.create({
			data: { slug: dailySlug, name: "Stale Daily Fixture", category: "livestock", unit: "USD" },
		});
		dailyId = daily.id;
		// Daily point 10 days old — outside the 7d daily window.
		const dDate = new Date(Date.now() - 10 * 24 * 3600 * 1000);
		await ctx.prisma.commodityPrice.create({
			data: {
				commodityId: dailyId,
				date: dDate,
				interval: "daily",
				source: "src-cad",
				close: 100,
				open: 100,
				high: 100,
				low: 100,
			},
		});
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("monthly-only commodity reports its latest point, cadence, and NOT stale within 60d", async () => {
		const result = await getCommodityFreshness();
		const item = result.commodities.find((c) => c.slug === monthlySlug);

		// Pre-6a this was lastUpdated null + stale true (query saw no daily rows).
		expect(item).toBeDefined();
		expect(item?.interval).toBe("monthly");
		expect(item?.lastUpdated).not.toBeNull();
		expect(item?.stale).toBe(false);
	});

	it("daily commodity still goes stale after 7d (daily semantics unchanged)", async () => {
		const result = await getCommodityFreshness();
		const item = result.commodities.find((c) => c.slug === dailySlug);

		expect(item).toBeDefined();
		expect(item?.interval).toBe("daily");
		expect(item?.stale).toBe(true);
	});

	it("H.10 FX daily points 9d old are NOT stale (weekly batch release, round-158 批C), 15d still are", async () => {
		// Reuse the real slug so the publication override in cadence.ts is
		// exercised end-to-end; the seeded rows for it are removed first (test
		// DB is ephemeral) so the fixture fully owns the series.
		await ctx.prisma.commodity.deleteMany({ where: { slug: "eur_usd" } });
		const h10 = await ctx.prisma.commodity.create({
			data: { slug: "eur_usd", name: "H.10 Fixture", category: "macro", unit: "USD" },
		});
		try {
			for (const [days, expectStale] of [
				[9, false],
				[15, true],
			] as const) {
				await ctx.prisma.commodityPrice.deleteMany({ where: { commodityId: h10.id } });
				const d = new Date(Date.now() - days * 24 * 3600 * 1000);
				await ctx.prisma.commodityPrice.create({
					data: {
						commodityId: h10.id,
						date: d,
						interval: "daily",
						source: "src-cad",
						close: 100,
						open: 100,
						high: 100,
						low: 100,
					},
				});
				const result = await getCommodityFreshness();
				const item = result.commodities.find((c) => c.slug === "eur_usd");
				expect(item, `fixture ${days}d`).toBeDefined();
				expect(item?.stale, `fixture ${days}d old`).toBe(expectStale);
			}
		} finally {
			await ctx.prisma.commodity.delete({ where: { id: h10.id } }).catch(() => {});
		}
	});

	it("commodity with no prices at any cadence stays stale with null cadence", async () => {
		const empty = await ctx.prisma.commodity.create({
			data: {
				slug: `fresh-empty-${Date.now()}`,
				name: "Empty Fixture",
				category: "livestock",
				unit: "USD",
			},
		});
		try {
			const result = await getCommodityFreshness();
			const item = result.commodities.find((c) => c.id === empty.id);
			expect(item?.lastUpdated).toBeNull();
			expect(item?.interval).toBeNull();
			expect(item?.stale).toBe(true);
		} finally {
			await ctx.prisma.commodity.delete({ where: { id: empty.id } }).catch(() => {});
		}
	});
});
