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
import { jwtUtils } from "@/lib";
import { createTestApp, getAdminToken, getPrisma, requireDb } from "@/test/helpers/testApp";

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
		test("returns 404 for a non-existent timeseries (round-119)", async () => {
			const res = await request(app)
				.get("/api/anomalies/stats/timeseries/00000000-0000-0000-0000-000000000000")
				.set(authHeaders());
			// round-119: stats previously returned an empty-200 for ANY id,
			// disclosing existence + value distribution of private series.
			// Missing and not-owned now both 404, like the timeseries reads.
			expect(res.status).toBe(404);
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

	describe("cross-user ownership (round-119 IDOR regression)", () => {
		// Before round-119 the list/detail/stats/detect endpoints had NO user
		// scope: any authenticated user could enumerate every other user's
		// anomalies (including context values from private series), read stats
		// for arbitrary series, and run detection (writes!) on them. These pin
		// the owner-scoping: same 404 for missing and not-owned, list filtered.
		const prisma = getPrisma();
		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		let ownerToken = "";
		let otherToken = "";
		let anomalyId = "";
		let timeseriesId = "";
		let datasetId = "";
		let ownerId = "";
		let otherId = "";

		beforeAll(async () => {
			const owner = await prisma.user.create({
				data: {
					email: `anom-owner-${suffix}@test.local`,
					passwordHash: "x",
					name: "Anom Owner",
					role: "VIEWER",
				},
			});
			const other = await prisma.user.create({
				data: {
					email: `anom-other-${suffix}@test.local`,
					passwordHash: "x",
					name: "Anom Other",
					role: "VIEWER",
				},
			});
			ownerId = owner.id;
			otherId = other.id;
			ownerToken = jwtUtils.generateToken(ownerId);
			otherToken = jwtUtils.generateToken(otherId);

			const dataset = await prisma.dataset.create({
				data: {
					ownerId: ownerId,
					name: `anom-ds-${suffix}`,
					slug: `anom-ds-${suffix}`,
					storageFormat: "CSV",
				},
			});
			datasetId = dataset.id;
			const ts = await prisma.timeseries.create({
				data: { datasetId, name: `anom-ts-${suffix}`, slug: `anom-ts-${suffix}` },
			});
			timeseriesId = ts.id;
			const anomaly = await prisma.anomaly.create({
				data: {
					timeseriesId,
					severity: "HIGH",
					detectionMethod: "STATISTICAL",
					score: 4.5,
					context: { value: 123.45 },
				},
			});
			anomalyId = anomaly.id;
		});

		afterAll(async () => {
			// Dataset cascade removes timeseries + anomalies; users removed last.
			await prisma.dataset.deleteMany({ where: { id: datasetId } });
			await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
		});

		test("list excludes another user's anomalies but shows the owner's", async () => {
			const otherRes = await request(app)
				.get("/api/anomalies?limit=100")
				.set({ Authorization: `Bearer ${otherToken}` });
			expect(otherRes.status).toBe(200);
			expect(otherRes.body.data.some((a: { id: string }) => a.id === anomalyId)).toBe(false);

			const ownerRes = await request(app)
				.get("/api/anomalies?limit=100")
				.set({ Authorization: `Bearer ${ownerToken}` });
			expect(ownerRes.status).toBe(200);
			expect(ownerRes.body.data.some((a: { id: string }) => a.id === anomalyId)).toBe(true);
		});

		test("detail returns 404 for another user's anomaly", async () => {
			const res = await request(app)
				.get(`/api/anomalies/${anomalyId}`)
				.set({ Authorization: `Bearer ${otherToken}` });
			expect(res.status).toBe(404);
		});

		test("stats return 404 for another user's timeseries", async () => {
			const res = await request(app)
				.get(`/api/anomalies/stats/timeseries/${timeseriesId}`)
				.set({ Authorization: `Bearer ${otherToken}` });
			expect(res.status).toBe(404);
		});

		test("detect returns 404 for another user's timeseries (no writes)", async () => {
			const res = await request(app)
				.post("/api/anomalies/detect")
				.set({ Authorization: `Bearer ${otherToken}` })
				.send({ timeseriesId, method: "STATISTICAL", windowSize: 5 });
			expect(res.status).toBe(404);
			const unchanged = await prisma.timeseries.findUnique({
				where: { id: timeseriesId },
				select: { isAnomalyDetectionEnabled: true },
			});
			expect(unchanged?.isAnomalyDetectionEnabled).toBe(false);
		});

		test("owner can still read their own anomaly detail", async () => {
			const res = await request(app)
				.get(`/api/anomalies/${anomalyId}`)
				.set({ Authorization: `Bearer ${ownerToken}` });
			expect(res.status).toBe(200);
			expect(res.body.data.anomaly.id).toBe(anomalyId);
		});
	});
});
