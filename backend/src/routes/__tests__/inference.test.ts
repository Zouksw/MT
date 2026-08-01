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
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

// crude_oil_cme is a seeded commodity with >10k daily price points, so a
// prediction request against it exercises the full slug→UUID→inference path.
const TEST_SLUG = "crude_oil_cme";

describe("Inference Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("inference");
		token = await getAdminToken(app);
	});

	describe("POST /api/inference/predict — slug/UUID resolution", () => {
		it("accepts a commodity SLUG and returns a prediction (regression)", async () => {
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
			const res = await request(app)
				.post("/api/inference/anomalies")
				.set("Authorization", `Bearer ${token}`)
				.send({ commodityId: TEST_SLUG, threshold: 3 });

			expect(res.status).toBe(200);
			expect(res.body.statistics).toBeDefined();
			expect(typeof res.body.statistics.total).toBe("number");
		});
	});

	// Regression guard for round-41 authoritative-source filtering
	// (docs/KNOWN-ISSUES.md R2). brl_usd is written by two sources with
	// conflicting direction: exchange_rate_api ≈ 0.2 (inverted) vs fred
	// DEXBZUS ≈ 5.0 (correct). Without the filter, /predict/visualize and
	// /anomalies read by commodityId alone and mix both → training/anomaly
	// math on a Frankenstein series. These tests pin that only the fred
	// magnitude appears in the response, so removing the filter fails loudly.
	describe("authoritative-source filtering on conflict commodities (round-41)", () => {
		it("/predict/visualize returns ONLY fred-magnitude history for brl_usd (no 0.2 leak)", async () => {
			const res = await request(app)
				.post("/api/inference/predict/visualize")
				.set("Authorization", `Bearer ${token}`)
				.send({
					commodityId: "brl_usd",
					algorithm: "arima",
					horizon: 5,
					historyPoints: 20,
				});

			expect(res.status).toBe(200);
			const historical: Array<{ value: number }> = res.body.data.historical;
			expect(historical.length).toBeGreaterThan(0);
			// fred DEXBZUS values are ≈ 5.x; exchange_rate_api's inverted values
			// are ≈ 0.2. Every returned value must be ≥ 1.0 (fred magnitude) —
			// any value < 1.0 means the inverted source leaked in.
			for (const point of historical) {
				expect(point.value).toBeGreaterThanOrEqual(1.0);
			}
		});

		it("/anomalies does not flag spurious anomalies from mixed-source brl_usd values", async () => {
			const res = await request(app)
				.post("/api/inference/anomalies")
				.set("Authorization", `Bearer ${token}`)
				.send({ commodityId: "brl_usd", threshold: 2.5, historyPoints: 50 });

			expect(res.status).toBe(200);
			expect(res.body.statistics).toBeDefined();
			// With the filter, the series is a clean ~5.x line (low variance) →
			// few/no anomalies. WITHOUT the filter, mixing 0.2 and 5.0 produces
			// huge z-scores → many "anomalies" that are really just unit mixing.
			// Assert the anomaly count is small (< 50% of points) — if the filter
			// were removed this would spike near 100%.
			const total = res.body.statistics.total as number;
			expect(total).toBeLessThan(25);
		});
	});
});
