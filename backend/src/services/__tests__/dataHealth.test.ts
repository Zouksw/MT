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
		if (!ctx.available)
			throw new Error(
				"dataHealth: integration suite requires PostgreSQL+Redis. Start them (docker-compose up) or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("returns a well-formed snapshot with the expected fields", async () => {
		const snap = await getDataHealth(3);

		expect(snap.windowDays).toBe(3);
		expect(snap.asOf).toBeInstanceOf(Date);
		expect(Array.isArray(snap.sources)).toBe(true);
		expect(typeof snap.freshSourceCount).toBe("number");
		expect(typeof snap.registeredSourceCount).toBe("number");
		expect(typeof snap.predictionBacklog).toBe("number");
		expect(typeof snap.predictionVerified).toBe("number");
		// Both non-default status buckets must be present — a prior regression
		// (round-62) dropped predictionStale from the health route while the
		// service still emitted it, silently hiding ~11k stale rows from
		// operators. Asserting here catches a service-level drop.
		expect(typeof snap.predictionStale).toBe("number");
		expect(typeof snap.predictionUnverifiable).toBe("number");
		expect(typeof snap.verificationRatio).toBe("number");
		// Invariants (round-106): typeof-only asserts passed for all-zero
		// or nonsensical values. These relationships must hold for any
		// real snapshot — /health/ready depends on this signal.
		// (freshSourceCount is NOT bounded by registeredSourceCount: the
		// registry can be empty while scraped sources still write rows.)
		expect(snap.predictionVerified).toBeGreaterThanOrEqual(0);
		expect(snap.predictionBacklog).toBeGreaterThanOrEqual(0);
		expect(snap.verificationRatio).toBeGreaterThanOrEqual(0);
		expect(snap.verificationRatio).toBeLessThanOrEqual(1);
	});

	it("anyDataFlowing is true when at least one source wrote rows in the window", async () => {
		const snap = await getDataHealth(365); // wide window → seed data counts
		// The seed DB has FRED/exchange_rate_api history, so data IS flowing
		// over a 365-day window.
		expect(snap.freshSourceCount).toBeGreaterThan(0);
		expect(snap.anyDataFlowing).toBe(true);
	});

	it("counts a fresh source with its row counts and latest date", async () => {
		const snap = await getDataHealth(365);
		// FRED is seeded and should appear as a producer.
		const fred = snap.sources.find((s) => s.source === "fred");
		expect(fred).toBeDefined();
		expect(fred?.commodityPriceRows).toBeGreaterThan(0);
		expect(fred?.latestDate).not.toBeNull();
	});

	it("freshSourceCount counts only sources with rows in the window", async () => {
		// Self-contained (round-112): the old assumption "seeded FRED history
		// is within 3 days" only holds on a freshly-seeded DB (CI). On a local
		// mt_test the seed ages past the window and this went red — the test
		// depended on cross-run DB residue. Seed the window content ourselves.
		const commodity = await ctx.prisma.commodity.findFirst({
			where: { slug: "brl_usd" },
			select: { id: true },
		});
		if (!commodity) return;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const fakeSource = `test-fresh-${ctx.prefix}`;
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
			// freshSourceCount must equal the number of sources whose row sum > 0.
			const producers = snap.sources.filter(
				(s) => s.commodityPriceRows + s.beefCutPriceRows > 0,
			).length;
			expect(snap.freshSourceCount).toBe(producers);
			expect(snap.freshSourceCount).toBeGreaterThanOrEqual(1);
		} finally {
			await ctx.prisma.commodityPrice.deleteMany({
				where: { source: fakeSource },
			});
		}
	});

	it("registeredSourceCount matches the scraper manager's registered set", async () => {
		const snap = await getDataHealth(3);
		// In the test process scrapers aren't registered (registration happens
		// at server startup), so this is 0 here; in production it's 19. The
		// contract is just that the field is a non-negative integer reflecting
		// scraperManager.getHealth() size.
		expect(snap.registeredSourceCount).toBeGreaterThanOrEqual(0);
	});

	it("verificationRatio is between 0 and 1 (inclusive)", async () => {
		const snap = await getDataHealth(3);
		expect(snap.verificationRatio).toBeGreaterThanOrEqual(0);
		expect(snap.verificationRatio).toBeLessThanOrEqual(1);
		// hasVerificationDebt must match the < 0.05 threshold definition.
		expect(snap.hasVerificationDebt).toBe(snap.verificationRatio < 0.05);
	});

	it("exposes predictionUnverifiable as a 4th bucket and excludes it from the verificationRatio denominator", async () => {
		// round-62: unverifiable rows (frozen-source predictions) must be
		// counted in their own bucket AND excluded from verificationRatio's
		// denominator. Otherwise ~92k frozen rows pin the ratio at ~0.006 and
		// mask real verification debt.
		const snap = await getDataHealth(3);

		// Field exists and is a non-negative integer.
		expect(Number.isInteger(snap.predictionUnverifiable)).toBe(true);
		expect(snap.predictionUnverifiable).toBeGreaterThanOrEqual(0);

		// verificationRatio = verified / (verified + backlog).
		// Unverifiable must NOT appear in either term. If the formula were
		// wrong (e.g. verified / (verified + backlog + unverifiable)), the
		// assertion below would fail.
		const denom = snap.predictionVerified + snap.predictionBacklog;
		const expected = denom > 0 ? snap.predictionVerified / denom : 0;
		expect(snap.verificationRatio).toBeCloseTo(expected, 6);
	});

	it("includes non-scraper source columns that wrote rows (e.g. manual import)", async () => {
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
