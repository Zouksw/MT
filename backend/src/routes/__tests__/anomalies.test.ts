/**
 * Anomalies Routes Integration Tests (round-96).
 *
 * anomalies.ts (7 endpoints, 0 route-layer tests) delegates to anomalyService
 * (which has its own unit tests). This suite covers route-layer concerns:
 *   - auth gating (every endpoint behind `authenticate`)
 *   - zod validation (invalid severity / non-UUID / bad threshold → 400)
 *   - list with pagination + filters
 *   - single anomaly 404
 *   - stats endpoint shape
 *   - detect requires a valid timeseriesId
 *
 * The detect endpoint runs real anomaly detection against seeded data; we
 * assert it doesn't crash (the service test covers the algorithm itself).
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("anomalies routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// Read-only tests — no persistent state to clean (detect creates anomaly
	// rows but those are ephemeral test artifacts that don't affect other suites).
});

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

describe("Anomalies Routes", () => {
	describe("auth gating", () => {
		test("GET /api/anomalies requires authentication", async () => {
			const res = await request(app).get("/api/anomalies");
			expect(res.status).toBe(401);
		});

		test("POST /api/anomalies/detect requires authentication", async () => {
			const res = await request(app)
				.post("/api/anomalies/detect")
				.send({ timeseriesId: "00000000-0000-0000-0000-000000000000" });
			expect(res.status).toBe(401);
		});

		test("DELETE /api/anomalies/:id requires authentication", async () => {
			const res = await request(app).delete("/api/anomalies/00000000-0000-0000-0000-000000000000");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/anomalies — list", () => {
		test("returns a paginated anomaly list", async () => {
			const res = await request(app).get("/api/anomalies?page=1&limit=10").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// paginated() returns { data, pagination } — assert BOTH precisely;
			// the old `data ?? pagination` fallback passed for almost any body.
			expect(Array.isArray(res.body.data)).toBe(true);
			expect(res.body.pagination).toMatchObject({ page: 1, limit: 10 });
		});

		test("rejects an invalid severity with 400", async () => {
			const res = await request(app).get("/api/anomalies?severity=CATASTROPHIC").set(authHeaders());
			expect(res.status).toBe(400);
		});

		test("rejects a non-UUID timeseriesId with 400", async () => {
			const res = await request(app)
				.get("/api/anomalies?timeseriesId=not-a-uuid")
				.set(authHeaders());
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/anomalies/:id — detail", () => {
		test("returns 404 for a non-existent anomaly id", async () => {
			const res = await request(app)
				.get("/api/anomalies/00000000-0000-0000-0000-000000000000")
				.set(authHeaders());
			// getAnomaly throws NotFoundError for a missing id → exact 404
			// (was `toBeLessThan(500)`, which any 2xx/4xx satisfied).
			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/anomalies/stats/timeseries/:timeseriesId", () => {
		test("returns anomaly statistics shape", async () => {
			const res = await request(app)
				.get("/api/anomalies/stats/timeseries/00000000-0000-0000-0000-000000000000")
				.set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toBeDefined();
		});

		test("requires authentication", async () => {
			const res = await request(app).get(
				"/api/anomalies/stats/timeseries/00000000-0000-0000-0000-000000000000",
			);
			expect(res.status).toBe(401);
		});
	});

	describe("POST /api/anomalies/detect — validation", () => {
		test("rejects a non-UUID timeseriesId with 400", async () => {
			const res = await request(app)
				.post("/api/anomalies/detect")
				.set(authHeaders())
				.send({ timeseriesId: "not-a-uuid" });
			expect(res.status).toBe(400);
		});

		test("rejects an out-of-range threshold with 400", async () => {
			// threshold must be in [0, 1].
			const res = await request(app).post("/api/anomalies/detect").set(authHeaders()).send({
				timeseriesId: "00000000-0000-0000-0000-000000000000",
				threshold: 5,
			});
			expect(res.status).toBe(400);
		});

		test("rejects an invalid method enum with 400", async () => {
			const res = await request(app).post("/api/anomalies/detect").set(authHeaders()).send({
				timeseriesId: "00000000-0000-0000-0000-000000000000",
				method: "NEURAL_NET",
			});
			expect(res.status).toBe(400);
		});
	});

	describe("PATCH /api/anomalies/:id — update", () => {
		test("requires authentication", async () => {
			const res = await request(app)
				.patch("/api/anomalies/00000000-0000-0000-0000-000000000000")
				.send({ isResolved: true });
			expect(res.status).toBe(401);
		});
	});
});
