/**
 * Analytics Routes Integration Tests (round-95).
 *
 * analytics.ts (2 endpoints: seasonality + correlation matrix, 0 route tests)
 * sits directly on the analysis value chain. The seasonality endpoint uses
 * authoritative-source filtering (round-41 R2 conflict-commodity defense); the
 * correlation endpoint computes a pairwise Pearson matrix from daily returns.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("analytics routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// Read-only tests — no persistent state to clean.
});

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

describe("Analytics Routes", () => {
	describe("auth gating", () => {
		test("GET /api/analytics/seasonality requires authentication", async () => {
			const res = await request(app).get("/api/analytics/seasonality/aud_usd");
			expect(res.status).toBe(401);
		});

		test("GET /api/analytics/correlation requires authentication", async () => {
			const res = await request(app).get("/api/analytics/correlation");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/analytics/seasonality/:commoditySlug", () => {
		test("returns monthly seasonality for a seeded commodity", async () => {
			const res = await request(app).get("/api/analytics/seasonality/aud_usd").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.commodity.slug).toBe("aud_usd");
			expect(Array.isArray(res.body.data.seasonality)).toBe(true);
		});

		test("returns 404 for an unknown commodity slug", async () => {
			const res = await request(app)
				.get("/api/analytics/seasonality/nonexistent_xyz")
				.set(authHeaders());
			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/analytics/correlation", () => {
		test("returns empty correlations when no slugs provided", async () => {
			const res = await request(app).get("/api/analytics/correlation").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.correlations).toEqual([]);
		});

		test("computes a correlation matrix for two commodities", async () => {
			// aud_usd and usd_cny both have deep daily history (seeded).
			const res = await request(app)
				.get("/api/analytics/correlation?slugs=aud_usd,usd_cny")
				.set(authHeaders());
			expect(res.status).toBe(200);
			expect(Array.isArray(res.body.data.correlations)).toBe(true);
			// Two commodities → 3 pairs (aud-aud, aud-cny, cny-cny).
			expect(res.body.data.correlations.length).toBe(3);
			// Self-correlation must be 1 (or near-1).
			const selfCorr = res.body.data.correlations.find(
				(c: { a: string; b: string }) => c.a === "aud_usd" && c.b === "aud_usd",
			);
			expect(selfCorr).toBeDefined();
			expect(selfCorr.corr).toBeCloseTo(1, 1);
			// All correlations in [-1, 1].
			for (const c of res.body.data.correlations) {
				expect(c.corr).toBeGreaterThanOrEqual(-1);
				expect(c.corr).toBeLessThanOrEqual(1);
			}
		});
	});
});
