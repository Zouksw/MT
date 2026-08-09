/**
 * Models Route Integration Tests (round-84).
 *
 * `routes/models.ts` (520L, 8 routes) was one of 5 core routes with zero test
 * coverage (per the round-84 quality audit). These tests pin the HTTP-layer
 * contracts: auth gating, response shape, pagination metadata, and 404
 * behavior — guarding against regressions when the modelService or middleware
 * changes.
 *
 * Drives the in-process Express app via supertest against the real mt_db
 * (seed data: admin user exists; forecasting_models may be empty, which is a
 * valid state to test — the list endpoint must return a well-formed empty
 * page, not a 500).
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

function authHeaders(t?: string) {
	return t ? { Authorization: `Bearer ${t}` } : {};
}

describe("Models Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("models routes");
		token = await getAdminToken(app);
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	describe("GET /api/models (auth required)", () => {
		it("rejects unauthenticated requests", async () => {
			const res = await request(app).get("/api/models");
			expect(res.status).toBe(401);
		});

		it("returns a paginated model list when authenticated", async () => {
			const res = await request(app).get("/api/models").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// paginated() envelope: data is the array, pagination carries meta.
			expect(Array.isArray(res.body.data)).toBe(true);
			expect(res.body.pagination).toBeDefined();
			expect(res.body.pagination).toHaveProperty("page");
			expect(res.body.pagination).toHaveProperty("limit");
			expect(res.body.pagination).toHaveProperty("total");
			expect(res.body.pagination).toHaveProperty("totalPages");
		});

		it("respects limit query parameter", async () => {
			const res = await request(app).get("/api/models?limit=5").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.pagination.limit).toBe(5);
			// The returned array must not exceed the requested limit.
			expect(res.body.data.length).toBeLessThanOrEqual(5);
		});
	});

	describe("GET /api/models/:id (auth required)", () => {
		it("rejects unauthenticated requests", async () => {
			const res = await request(app).get("/api/models/some-id");
			expect(res.status).toBe(401);
		});

		it("returns 404 for a non-existent model id", async () => {
			const res = await request(app)
				.get("/api/models/nonexistent-model-id-xyz")
				.set(authHeaders(token));

			expect(res.status).toBe(404);
		});
	});

	describe("POST /api/models/train (deprecated → 410 Gone)", () => {
		it("rejects unauthenticated requests", async () => {
			const res = await request(app).post("/api/models/train").send({});
			expect(res.status).toBe(401);
		});

		it("returns 410 Gone for authenticated AI-access callers", async () => {
			// The train endpoint was a shell feature: it persisted a
			// "trained+deployed" model record without invoking any training.
			// Retired to 410 (matching the sibling /api/inference/models/train
			// retired in round-20). Auth + AI access gates still run first.
			const res = await request(app).post("/api/models/train").set(authHeaders(token)).send({
				timeseriesId: "00000000-0000-0000-0000-000000000000",
				algorithm: "ARIMA",
			});

			expect(res.status).toBe(410);
			expect(res.body.success).toBe(false);
			expect(res.body.error.code).toBe("GONE");
		});
	});
});
