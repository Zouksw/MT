/**
 * Inference Route Integration Tests
 *
 * Regression coverage for the slug/UUID resolution bug: callers (frontend,
 * API clients) pass a commodity slug such as "crude_oil_cme", but the price
 * table is keyed on the commodity UUID. Before the fix the route forwarded
 * the slug straight to getCommodityPriceValues → "Insufficient price data:
 * 0 points" → 500 SERVER_ERROR. Now resolveCommodityId() maps slug→UUID.
 *
 * Drives the in-process Express app via supertest against the real DB.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, isDbAvailable } from "@/test/helpers/testApp";

let app: Express;
let dbAvailable = false;
let token: string;

// crude_oil_cme is a seeded commodity with >10k daily price points, so a
// prediction request against it exercises the full slug→UUID→inference path.
const TEST_SLUG = "crude_oil_cme";

describe("Inference Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	describe("POST /api/inference/predict — slug/UUID resolution", () => {
		it("accepts a commodity SLUG and returns a prediction (regression)", async () => {
			if (!dbAvailable) return;

			const res = await request(app)
				.post("/api/inference/predict")
				.set("Authorization", `Bearer ${token}`)
				.send({ commodityId: TEST_SLUG, horizon: 5, algorithm: "arima" });

			// Before the fix this was 500 SERVER_ERROR ("Insufficient price data:
			// 0 points"). The regression assertion is 200 + values.
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.values)).toBe(true);
			expect(res.body.data.values.length).toBeGreaterThan(0);
			// The caller's input slug is echoed back unchanged.
			expect(res.body.data.commodityId).toBe(TEST_SLUG);
		});

		it("still accepts a raw UUID (no resolution needed)", async () => {
			if (!dbAvailable) return;

			// Look up the UUID for the slug so the test does not hardcode an id
			// that may drift across reseeds.
			const slugRes = await request(app)
				.get("/api/signals/commodities")
				.set("Authorization", `Bearer ${token}`);
			const commodity = slugRes.body.data.find(
				(c: { slug: string; id: string }) => c.slug === TEST_SLUG,
			);
			if (!commodity) return;

			const res = await request(app)
				.post("/api/inference/predict")
				.set("Authorization", `Bearer ${token}`)
				.send({
					commodityId: commodity.id,
					horizon: 5,
					algorithm: "arima",
				});

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.values.length).toBeGreaterThan(0);
		});

		it("returns 400 for an unknown commodity slug", async () => {
			if (!dbAvailable) return;

			const res = await request(app)
				.post("/api/inference/predict")
				.set("Authorization", `Bearer ${token}`)
				.send({ commodityId: "nonexistent_slug_xyz", horizon: 5 });

			// Unknown id must surface as a 400 (not a 500 leak of the internal
			// "Insufficient price data" error, and not a 404 that would let
			// callers enumerate which ids exist).
			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it("accepts a slug in /predict/visualize and returns historical + prediction", async () => {
			if (!dbAvailable) return;

			const res = await request(app)
				.post("/api/inference/predict/visualize")
				.set("Authorization", `Bearer ${token}`)
				.send({
					commodityId: TEST_SLUG,
					horizon: 5,
					algorithm: "arima",
					historyPoints: 20,
				});

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.historical)).toBe(true);
			// A seeded commodity with price data must yield history rows.
			expect(res.body.data.historical.length).toBeGreaterThan(0);
		});

		it("accepts a slug in /anomalies and returns anomaly statistics", async () => {
			if (!dbAvailable) return;

			const res = await request(app)
				.post("/api/inference/anomalies")
				.set("Authorization", `Bearer ${token}`)
				.send({ commodityId: TEST_SLUG, threshold: 3 });

			expect(res.status).toBe(200);
			expect(res.body.statistics).toBeDefined();
			expect(typeof res.body.statistics.total).toBe("number");
		});
	});
});
