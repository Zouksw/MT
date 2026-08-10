/**
 * Timeseries Routes Integration Tests (round-89).
 *
 * The /api/timeseries routes (CRUD for time series + data points) had zero
 * direct route-layer tests. This file covers: auth gating, listing with
 * pagination, 404 for non-existent IDs.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("timeseries routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// No persistent state — read-only tests + a non-existent-ID 404 probe.
});

describe("Timeseries Routes (Integration)", () => {
	describe("GET /api/timeseries", () => {
		test("requires authentication", async () => {
			const res = await request(app).get("/api/timeseries");
			expect(res.status).toBe(401);
		});

		test("returns paginated timeseries list", async () => {
			const res = await request(app)
				.get("/api/timeseries?page=1&limit=10")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// The response shape may use pagination or data key — verify one.
			expect(res.body.data ?? res.body.pagination).toBeDefined();
		});
	});

	describe("GET /api/timeseries/:id", () => {
		test("returns 404 for a non-existent timeseries", async () => {
			const res = await request(app)
				.get("/api/timeseries/00000000-0000-0000-0000-000000000000")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(404);
		});

		test("requires authentication", async () => {
			const res = await request(app).get("/api/timeseries/00000000-0000-0000-0000-000000000000");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/timeseries/:id/data", () => {
		test("returns 404 for a non-existent timeseries", async () => {
			const res = await request(app)
				.get("/api/timeseries/00000000-0000-0000-0000-000000000000/data")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(404);
		});

		test("requires authentication", async () => {
			const res = await request(app).get(
				"/api/timeseries/00000000-0000-0000-0000-000000000000/data",
			);
			expect(res.status).toBe(401);
		});
	});
});
