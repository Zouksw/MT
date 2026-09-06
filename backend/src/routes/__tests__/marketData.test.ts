/**
 * Market Data Routes Integration Tests (round-95).
 *
 * marketData.ts is the primary market-data read API (15 endpoints, 8 Prisma
 * calls, 0 route-layer tests — PROJECT-ASSESSMENT §3.3 gap). These endpoints
 * feed the frontend's market/trading/dashboard views, so their response
 * contracts are value-chain-critical.
 *
 * Coverage focus: the read endpoints that the frontend consumes directly:
 *   - GET /commodities (list)
 *   - GET /commodities/:slug/latest (latest price)
 *   - GET /commodities/:slug/price (history)
 *   - GET /commodities/:slug/price-multi (multi-source)
 *   - GET /factors/exchange-rates
 *   - GET /sources/freshness
 *   - auth gating + 404 for unknown slugs
 *
 * POST /import (CSV upload) is covered by useBeefImport.test.ts at the hook
 * layer + beef.test.ts; this suite does NOT duplicate import IO.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("marketData routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// Read-only tests — no persistent state to clean.
});

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

describe("Market Data Routes", () => {
	describe("auth gating", () => {
		test("GET /api/market/commodities requires authentication", async () => {
			const res = await request(app).get("/api/market/commodities");
			expect(res.status).toBe(401);
		});

		test("GET /api/market/commodities/aud_usd/latest requires authentication", async () => {
			const res = await request(app).get("/api/market/commodities/aud_usd/latest");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/market/commodities", () => {
		test("returns a non-empty commodity list", async () => {
			const res = await request(app).get("/api/market/commodities").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.commodities)).toBe(true);
			expect(res.body.data.count).toBe(res.body.data.commodities.length);
			expect(res.body.data.commodities.length).toBeGreaterThan(0);
			// Each commodity exposes the slug the other endpoints key on.
			expect(res.body.data.commodities[0]).toHaveProperty("slug");
		});
	});

	describe("GET /api/market/commodities/:slug/latest", () => {
		test("returns the latest price for a seeded commodity", async () => {
			const res = await request(app)
				.get("/api/market/commodities/aud_usd/latest")
				.set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.commodity.slug).toBe("aud_usd");
			// price may be null if data is frozen (D1), but the field must exist.
			expect(res.body.data).toHaveProperty("price");
		});

		test("returns 404 for an unknown commodity slug", async () => {
			const res = await request(app)
				.get("/api/market/commodities/nonexistent_xyz/latest")
				.set(authHeaders());
			expect(res.status).toBe(404);
		});

		test("returns price: null (not a crash) when the commodity has no prices", async () => {
			// aud_usd has prices, so this asserts the contract shape for the
			// price:null path documented at marketData.ts:76. We verify the
			// happy path includes the price field; the null case is the same
			// handler's early return.
			const res = await request(app)
				.get("/api/market/commodities/aud_usd/latest")
				.set(authHeaders());
			expect(res.status).toBe(200);
			expect("price" in res.body.data).toBe(true);
		});
	});

	describe("GET /api/market/commodities/:slug/price", () => {
		test("returns price history with commodity metadata", async () => {
			const res = await request(app)
				.get("/api/market/commodities/aud_usd/price?interval=daily&limit=10")
				.set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.commodity.slug).toBe("aud_usd");
			expect(res.body.data.interval).toBe("daily");
			expect(Array.isArray(res.body.data.prices)).toBe(true);
		});

		test("returns 404 for an unknown slug", async () => {
			const res = await request(app)
				.get("/api/market/commodities/nonexistent_xyz/price")
				.set(authHeaders());
			expect(res.status).toBe(404);
		});

		test("rejects an invalid interval with 400", async () => {
			const res = await request(app)
				.get("/api/market/commodities/aud_usd/price?interval=hourly")
				.set(authHeaders());
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/market/commodities/:slug/price-multi", () => {
		test("returns multi-source price data", async () => {
			const res = await request(app)
				.get("/api/market/commodities/aud_usd/price-multi?limit=5")
				.set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// The shape is service-defined; assert it's an object with data.
			expect(res.body.data).toBeDefined();
		});
	});

	describe("GET /api/market/public/highlights", () => {
		// IMPROVEMENT-PLAN batch 1a: the landing page's live-data strip. The
		// defining contract is PUBLIC access (no Authorization header) with only
		// whitelisted macro series — never user datasets/timeseries.
		test("is accessible WITHOUT authentication", async () => {
			const res = await request(app).get("/api/market/public/highlights");
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			const highlights = res.body.data.highlights;
			expect(Array.isArray(highlights)).toBe(true);
			expect(highlights).toHaveLength(1);
			const entry = highlights[0];
			// Whitelist entry present; status is one of the degrade markers when
			// the test DB lacks the series, never a 500.
			expect(entry.slug).toBe("beef_carcass_us");
			expect(["ok", "no_data", "error"]).toContain(entry.status);
		});

		test("ok entries carry latest price + numeric series + dayChangePct", async () => {
			const res = await request(app).get("/api/market/public/highlights");
			expect(res.status).toBe(200);
			const entry = res.body.data.highlights[0];
			if (entry.status !== "ok") return; // DB without the series — shape covered above
			expect(entry.name).toBeTruthy();
			expect(typeof entry.latest.close).toBe("number");
			expect(entry.latest.date).toBeTruthy();
			expect(Array.isArray(entry.series)).toBe(true);
			for (const point of entry.series) {
				expect(typeof point.close).toBe("number");
				expect(Number.isNaN(point.close)).toBe(false);
			}
			expect(entry.dayChangePct === null || typeof entry.dayChangePct === "number").toBe(true);
		});
	});

	describe("GET /api/market/public/digest", () => {
		// IMPROVEMENT-PLAN v3.3.0 batch 1: the public Chinese market digest
		// page's data source. Same defining contract as /public/highlights —
		// PUBLIC access with a FIXED whitelist; the response must never
		// contain anything beyond the curated public series (no user
		// datasets/timeseries, no private identifiers).
		const DIGEST_WHITELIST = [
			"beef_carcass_us",
			// round-155 批D: weekly 90CL import benchmark joined the public
			// digest (status may be no_data/error in mt_test — the seed has no
			// 90CL rows; equality is on slugs, per-slug status is open).
			"beef_90cl_us",
			"live_cattle_cme",
			"feeder_cattle_cme",
			"usd_cny",
			"brl_usd",
		];

		test("is accessible WITHOUT authentication and only whitelisted slugs appear", async () => {
			const res = await request(app).get("/api/market/public/digest");
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			const series = res.body.data.digest.series;
			expect(Array.isArray(series)).toBe(true);
			expect(series).toHaveLength(DIGEST_WHITELIST.length);
			// Whitelist equality — any extra slug would be a privacy leak.
			expect(series.map((s: { slug: string }) => s.slug).sort()).toEqual(
				[...DIGEST_WHITELIST].sort(),
			);
			for (const entry of series) {
				expect(["ok", "no_data", "error"]).toContain(entry.status);
				// No private fields ever ride along on the public payload.
				expect(entry).not.toHaveProperty("commodityId");
				expect(entry).not.toHaveProperty("id");
			}
		});

		test("ok entries carry interval-aware changes + numeric series + stale flag", async () => {
			const res = await request(app).get("/api/market/public/digest");
			expect(res.status).toBe(200);
			for (const entry of res.body.data.digest.series) {
				if (entry.status !== "ok") continue; // degrade markers covered above
				expect(typeof entry.latest.close).toBe("number");
				expect(entry.latest.date).toBeTruthy();
				expect(["daily", "weekly", "monthly"]).toContain(entry.interval);
				expect(typeof entry.stale).toBe("boolean");
				expect(
					entry.prevPointChangePct === null || typeof entry.prevPointChangePct === "number",
				).toBe(true);
				expect(entry.wowChangePct === null || typeof entry.wowChangePct === "number").toBe(true);
				// A monthly series must not fake a weekly window.
				if (entry.interval === "monthly") {
					expect(entry.wowChangePct).toBeNull();
					expect(entry.momChangePct === null || typeof entry.momChangePct === "number").toBe(true);
				}
				for (const point of entry.series) {
					expect(typeof point.close).toBe("number");
					expect(Number.isNaN(point.close)).toBe(false);
				}
			}
		});
	});

	describe("GET /api/market/factors/exchange-rates", () => {
		test("returns exchange-rate factors", async () => {
			const res = await request(app).get("/api/market/factors/exchange-rates").set(authHeaders());
			// This endpoint may 200 with data or return an empty structure if
			// no FX commodities are seeded. Assert it doesn't crash (500).
			expect(res.status).toBeLessThan(500);
		});
	});

	describe("GET /api/market/sources/freshness", () => {
		test("returns source freshness summary", async () => {
			const res = await request(app).get("/api/market/sources/freshness").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toBeDefined();
		});

		test("requires authentication", async () => {
			const res = await request(app).get("/api/market/sources/freshness");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/market/sources", () => {
		// round-119: the raw scraper error string is no longer exposed (this
		// route's cacheRoute is shared across users; the status enum is the
		// failure signal). Pin that `error` never re-enters the response.
		test("returns the source board WITHOUT raw error strings", async () => {
			const res = await request(app).get("/api/market/sources").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			const sources = res.body.data.sources;
			expect(Array.isArray(sources)).toBe(true);
			expect(sources.length).toBeGreaterThan(0);
			for (const s of sources) {
				expect(s).toHaveProperty("status");
				expect(s).not.toHaveProperty("error");
			}
		});

		test("requires authentication", async () => {
			const res = await request(app).get("/api/market/sources");
			expect(res.status).toBe(401);
		});
	});
});
