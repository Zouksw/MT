/**
 * Beef Route Integration Tests (TD-6).
 *
 * `routes/beef.ts` was the last high-logic route with zero test coverage.
 * These tests drive the in-process Express app via supertest against the
 * real mt_db (where seed data — beef cuts, factories, BeefCutPrice rows —
 * lives), pinning the contracts that were previously unguarded.
 *
 * The /by-country aggregation was extracted to services/beefAggregation.ts
 * in the same change; these tests exercise it end-to-end through the route.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

function authHeaders(t?: string) {
	return t ? { Authorization: `Bearer ${t}` } : {};
}

describe("Beef Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("beef routes");
		token = await getAdminToken(app);
	});

	describe("GET /api/beef/factories", () => {
		it("lists active factories (public, no auth)", async () => {
			const res = await request(app).get("/api/beef/factories");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.factories)).toBe(true);
			expect(res.body.data.count).toBe(res.body.data.factories.length);
		});
	});

	describe("GET /api/beef/cuts", () => {
		it("lists beef cut taxonomy (public)", async () => {
			const res = await request(app).get("/api/beef/cuts");

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body.data.cuts)).toBe(true);
			expect(res.body.data.cuts.length).toBeGreaterThan(0);
		});

		it("groups cuts by primal", async () => {
			const res = await request(app).get("/api/beef/cuts/by-primal");

			expect(res.status).toBe(200);
			expect(typeof res.body.data).toBe("object");
			// Each key maps to an array of cuts.
			for (const cuts of Object.values(res.body.data) as unknown[][]) {
				expect(Array.isArray(cuts)).toBe(true);
			}
		});

		it("returns 404 for an unknown cut code", async () => {
			const res = await request(app).get("/api/beef/cuts/NO_SUCH_CUT_xyz");

			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/beef/by-country (aggregation — extracted logic)", () => {
		it("aggregates the latest BeefCutPrice snapshot by country", async () => {
			const res = await request(app).get("/api/beef/by-country");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			const { countries, date, count } = res.body.data;

			// Seed data has BeefCutPrice rows → the snapshot is non-empty.
			expect(date).not.toBeNull();
			expect(count).toBe(countries.length);
			expect(count).toBeGreaterThan(0);

			// Each country row carries the full aggregate contract.
			for (const c of countries) {
				expect(c).toHaveProperty("country");
				expect(c).toHaveProperty("avgPrice");
				expect(c).toHaveProperty("minPrice");
				expect(c).toHaveProperty("maxPrice");
				expect(c).toHaveProperty("cutCount");
				expect(c).toHaveProperty("factoryCount");
				expect(Array.isArray(c.topCuts)).toBe(true);
				// Numeric invariants: avg within [min, max].
				expect(c.minPrice).toBeLessThanOrEqual(c.avgPrice);
				expect(c.avgPrice).toBeLessThanOrEqual(c.maxPrice);
				// cutCount is the total distinct cuts in the country snapshot;
				// topCuts is the capped breakdown (≤ cutsLimit). The breakdown
				// can never exceed the distinct cut count.
				expect(typeof c.cutCount).toBe("number");
				expect(c.topCuts.length).toBeLessThanOrEqual(c.cutCount);
			}

			// Sort invariant: countries are in locale order (the aggregation
			// sorts by country name).
			const names = countries.map((c: { country: string }) => c.country);
			const sorted = [...names].sort((a, b) => a.localeCompare(b));
			expect(names).toEqual(sorted);
		});

		it("caps the per-cut breakdown at the requested limit", async () => {
			// Request cuts=2 → no country row should expose more than 2 topCuts.
			const res = await request(app).get("/api/beef/by-country?cuts=2");

			expect(res.status).toBe(200);
			for (const c of res.body.data.countries) {
				expect(c.topCuts.length).toBeLessThanOrEqual(2);
			}
		});
	});

	describe("GET /api/beef/prices", () => {
		it("returns paginated price rows with freshness + pagination metadata", async () => {
			const res = await request(app).get("/api/beef/prices?days=365");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("prices");
			expect(res.body.data).toHaveProperty("count");
			expect(res.body.data).toHaveProperty("total");
			expect(res.body.data).toHaveProperty("freshness");
			expect(res.body.data).toHaveProperty("pagination");
			expect(Array.isArray(res.body.data.prices)).toBe(true);
		});
	});

	describe("GET /api/beef/forecasts (auth required)", () => {
		it("rejects unauthenticated requests", async () => {
			const res = await request(app).get("/api/beef/forecasts");
			expect(res.status).toBe(401);
		});

		it("returns a forecasts map when authenticated", async () => {
			const res = await request(app).get("/api/beef/forecasts").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("forecasts");
			expect(typeof res.body.data.forecasts).toBe("object");
			expect(res.body.data).toHaveProperty("count");
			expect(res.body.data).toHaveProperty("horizon");
			// forecasts may be empty (D1: beef data stale) but the contract
			// (forecasts/count/horizon keys) must always be present.
		});
	});

	describe("GET /api/beef/forecasts/:cutCode (auth required)", () => {
		it("rejects unauthenticated requests", async () => {
			const res = await request(app).get("/api/beef/forecasts/some_cut");
			expect(res.status).toBe(401);
		});

		it("returns 404 for an unknown cut", async () => {
			const res = await request(app)
				.get("/api/beef/forecasts/NO_SUCH_CUT_xyz")
				.set(authHeaders(token));
			expect(res.status).toBe(404);
		});
	});
});
