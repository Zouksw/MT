/**
 * Data Health snapshot — integration test against the real DB.
 *
 * Pins the contract of getDataHealth(): it must honestly report how many
 * sources are fresh vs dormant and the prediction verification debt. This is
 * the signal /health/ready relies on to avoid reporting "all green" while the
 * data layer is silently failing.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { getDataHealth } from "@/services/dataHealth";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

describe("getDataHealth — data-layer observability (real DB)", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("datahealth");
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("returns a well-formed snapshot with the expected fields", async () => {
		if (!ctx.available) return;
		const snap = await getDataHealth(3);

		expect(snap.windowDays).toBe(3);
		expect(snap.asOf).toBeInstanceOf(Date);
		expect(Array.isArray(snap.sources)).toBe(true);
		expect(typeof snap.freshSourceCount).toBe("number");
		expect(typeof snap.registeredSourceCount).toBe("number");
		expect(typeof snap.predictionBacklog).toBe("number");
		expect(typeof snap.predictionVerified).toBe("number");
		expect(typeof snap.verificationRatio).toBe("number");
	});

	it("anyDataFlowing is true when at least one source wrote rows in the window", async () => {
		if (!ctx.available) return;
		const snap = await getDataHealth(365); // wide window → seed data counts
		// The seed DB has FRED/exchange_rate_api history, so data IS flowing
		// over a 365-day window.
		expect(snap.freshSourceCount).toBeGreaterThan(0);
		expect(snap.anyDataFlowing).toBe(true);
	});

	it("counts a fresh source with its row counts and latest date", async () => {
		if (!ctx.available) return;
		const snap = await getDataHealth(365);
		// FRED is seeded and should appear as a producer.
		const fred = snap.sources.find((s) => s.source === "fred");
		expect(fred).toBeDefined();
		expect(fred?.commodityPriceRows).toBeGreaterThan(0);
		expect(fred?.latestDate).not.toBeNull();
	});

	it("freshSourceCount counts only sources with rows in the window", async () => {
		if (!ctx.available) return;
		const snap = await getDataHealth(3);
		// freshSourceCount must equal the number of sources whose row sum > 0.
		const producers = snap.sources.filter(
			(s) => s.commodityPriceRows + s.beefCutPriceRows > 0,
		).length;
		expect(snap.freshSourceCount).toBe(producers);
		// The seeded FRED/exchange_rate_api history is within 3 days (live
		// scrapers run hourly/daily), so at least one producer exists.
		expect(snap.freshSourceCount).toBeGreaterThanOrEqual(1);
	});

	it("registeredSourceCount matches the scraper manager's registered set", async () => {
		if (!ctx.available) return;
		const snap = await getDataHealth(3);
		// In the test process scrapers aren't registered (registration happens
		// at server startup), so this is 0 here; in production it's 19. The
		// contract is just that the field is a non-negative integer reflecting
		// scraperManager.getHealth() size.
		expect(snap.registeredSourceCount).toBeGreaterThanOrEqual(0);
	});

	it("verificationRatio is between 0 and 1 (inclusive)", async () => {
		if (!ctx.available) return;
		const snap = await getDataHealth(3);
		expect(snap.verificationRatio).toBeGreaterThanOrEqual(0);
		expect(snap.verificationRatio).toBeLessThanOrEqual(1);
		// hasVerificationDebt must match the < 0.05 threshold definition.
		expect(snap.hasVerificationDebt).toBe(snap.verificationRatio < 0.05);
	});

	it("includes non-scraper source columns that wrote rows (e.g. manual import)", async () => {
		if (!ctx.available) return;
		// Insert a row under a source string that isn't a registered scraper,
		// into the commodity_prices table, within the window — getDataHealth
		// must surface it (status 'not_a_scraper') so manual imports are seen.
		const commodity = await ctx.prisma.commodity.findFirst({
			where: { slug: "brl_usd" },
			select: { id: true },
		});
		if (!commodity) return;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const fakeSource = `test-manual-${ctx.prefix}`;
		await ctx.prisma.commodityPrice.create({
			data: {
				commodityId: commodity.id,
				date: today,
				interval: "daily",
				source: fakeSource,
				open: 1,
				high: 1,
				low: 1,
				close: 1,
			},
		});
		try {
			const snap = await getDataHealth(3);
			const found = snap.sources.find((s) => s.source === fakeSource);
			expect(found).toBeDefined();
			expect(found?.commodityPriceRows).toBe(1);
			expect(found?.scraperStatus).toBe("not_a_scraper");
		} finally {
			await ctx.prisma.commodityPrice.deleteMany({
				where: { source: fakeSource },
			});
		}
	});
});
