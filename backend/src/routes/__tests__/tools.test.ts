/**
 * Tools route integration tests (v3.2.0 批 3) — GET /api/tools/landing-cost.
 *
 * Public endpoint (no auth, like /api/market/public/highlights). These tests
 * pin the HTTP contract: zod validation boundaries, the response envelope,
 * and the end-to-end numbers against deterministic price fixtures (source
 * `test:landing-cost`, cleaned up in afterAll). The math itself is pinned
 * precisely in services/__tests__/landingCost.test.ts; here we assert the
 * wiring (fixture row → unit conversion → formula → JSON) at 2dp tolerance.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { createTestApp, requireDb } from "@/test/helpers/testApp";

let app: Express;

const FIXTURE_SOURCE = "test:landing-cost";

/** Fixtures are dated slightly in the FUTURE so they dominate the seed's 180
 * synthetic daily rows regardless of when the seed last ran (CI seeds
 * minutes before tests; a stale local mt_test seeded weeks earlier). The
 * endpoint reads "latest row per slug" with no interval filter, so this is
 * the only date choice that is deterministic in both environments. */
const FUTURE_MS = Date.now() + 2 * 86_400_000;

/** Remove fixture rows: the FIXTURE_SOURCE-labeled ones plus the fred-labeled
 * FX fixtures (usd_cny/aud_usd are declared→fred, 批2) — the latter scoped by
 * the future date only fixtures use, never seed history. */
async function cleanupFixtures() {
	await prisma.commodityPrice.deleteMany({
		where: {
			OR: [{ source: FIXTURE_SOURCE }, { source: "fred", date: { gte: new Date(Date.now()) } }],
		},
	});
}

async function seedFixtures() {
	const beef = await prisma.commodity.findUnique({ where: { slug: "beef_carcass_us" } });
	const cny = await prisma.commodity.findUnique({ where: { slug: "usd_cny" } });
	const aud = await prisma.commodity.findUnique({ where: { slug: "aud_usd" } });
	if (!beef || !cny || !aud) {
		throw new Error(
			`seed commodities missing (beef_carcass_us=${!!beef}, usd_cny=${!!cny}, aud_usd=${!!aud}) — run prisma db seed`,
		);
	}
	// Beef identity comes from the seed itself since v3.3.0 批2 (§十七 fix):
	// beef_carcass_us is seeded as the IMF monthly benchmark, USC/lb — no
	// beforeAll unit patch needed anymore. The monthly window fixtures below
	// are FUTURE-dated so they still dominate the seeded monthly history.
	const monthAgo = (days: number) => new Date(FUTURE_MS - days * 86_400_000);
	for (const [date, close] of [
		[monthAgo(60), 300],
		[monthAgo(30), 310],
		[new Date(FUTURE_MS), 330],
	] as const) {
		await prisma.commodityPrice.create({
			data: {
				commodityId: beef.id,
				interval: "monthly",
				date,
				close,
				source: FIXTURE_SOURCE,
			},
		});
	}
	// USD/CNY fixture at a clean 7.0; aud reference at 0.72. Both dated to
	// dominate the synthetic seed rows. Source must be "fred" — both slugs are
	// declared authoritative→fred (v3.2.0 批2), so getLatestPrice filters to
	// fred rows and any other label would be invisible to the quote.
	await prisma.commodityPrice.create({
		data: {
			commodityId: cny.id,
			interval: "daily",
			date: new Date(FUTURE_MS - 86_400_000),
			close: 7,
			source: "fred",
		},
	});
	await prisma.commodityPrice.create({
		data: {
			commodityId: aud.id,
			interval: "daily",
			date: new Date(FUTURE_MS - 86_400_000),
			close: 0.72,
			source: "fred",
		},
	});
}

describe("Tools Routes — GET /api/tools/landing-cost (public)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("tools routes");
		await cleanupFixtures();
		await seedFixtures();
	});

	afterAll(async () => {
		await cleanupFixtures();
	});

	it("defaults (all-zero params): landed = base, CNY = base × fx", async () => {
		const res = await request(app).get("/api/tools/landing-cost");

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		const q = res.body.data;
		expect(q.status).toBe("ok");
		expect(q.base.slug).toBe("beef_carcass_us");
		expect(q.base.unit).toBe("USC/lb");
		expect(q.base.latestClose).toBe(330);
		// 330 USC/lb = 3.3 USD/lb ≈ 7.2753 USD/kg
		expect(q.base.usdPerKg).toBeCloseTo(7.2753, 3);
		expect(q.fx.usdCny.rate).toBeCloseTo(7, 6);
		expect(q.landed.mid.landedUsdPerKg).toBeCloseTo(7.2753, 3);
		expect(q.landed.mid.cnyPerKg).toBeCloseTo(50.93, 1);
		expect(q.landed.low.baseUsdPerKg).toBeLessThan(q.landed.high.baseUsdPerKg);
		expect(Array.isArray(q.notes) && q.notes.length > 0).toBe(true);
	});

	it("full parameter set: duty on cost base, VAT on (base+duty), loss last", async () => {
		const res = await request(app).get(
			"/api/tools/landing-cost?tariffPct=10&vatPct=9&freightUsdPerKg=0.5&feesUsdPerKg=0.25&lossPct=5",
		);

		expect(res.status).toBe(200);
		const mid = res.body.data.landed.mid;
		// base ≈ 7.27525, cost base ≈ 8.02525
		expect(mid.costBaseUsdPerKg).toBeCloseTo(8.0253, 3);
		expect(mid.dutyUsdPerKg).toBeCloseTo(0.8025, 3);
		// vat = (8.02525 + 0.80253) × 9% ≈ 0.7945
		expect(mid.vatUsdPerKg).toBeCloseTo(0.7945, 3);
		// landed ≈ 10.1034 USD/kg; × 7.0 ≈ 70.72 CNY/kg
		expect(mid.landedUsdPerKg).toBeCloseTo(10.1034, 3);
		expect(mid.cnyPerKg).toBeCloseTo(70.72, 1);
	});

	it("originFx reference is surfaced without entering the math", async () => {
		const res = await request(app).get("/api/tools/landing-cost?originFx=aud_usd");

		expect(res.status).toBe(200);
		const q = res.body.data;
		expect(q.fx.originRef).not.toBeNull();
		expect(q.fx.originRef.slug).toBe("aud_usd");
		expect(q.fx.originRef.rate).toBeCloseTo(0.72, 4);
		// Reference FX must not change the landed math (prices are USD-denominated).
		expect(q.landed.mid.landedUsdPerKg).toBeCloseTo(7.2753, 3);
	});

	it("rejects unknown base series (whitelist, not free text)", async () => {
		const res = await request(app).get("/api/tools/landing-cost?baseSeries=gold_lbma");
		expect(res.status).toBe(400);
	});

	it("rejects non-numeric and out-of-range parameters", async () => {
		expect((await request(app).get("/api/tools/landing-cost?tariffPct=abc")).status).toBe(400);
		expect((await request(app).get("/api/tools/landing-cost?tariffPct=150")).status).toBe(400);
		expect((await request(app).get("/api/tools/landing-cost?freightUsdPerKg=-1")).status).toBe(400);
	});

	it("degrades honestly when the requested series has no data", async () => {
		const res = await request(app).get("/api/tools/landing-cost?baseSeries=feeder_cattle_cme");

		expect(res.status).toBe(200);
		const q = res.body.data;
		// mt_test may or may not carry feeder rows — both outcomes must keep the
		// contract: either full numbers, or insufficient_data WITH a reason.
		if (q.status === "insufficient_data") {
			expect(typeof q.reason).toBe("string");
			expect(q.reason.length).toBeGreaterThan(0);
			expect(q.landed).toBeUndefined();
		} else {
			expect(q.landed.mid.landedUsdPerKg).toBeGreaterThan(0);
		}
	});
});
