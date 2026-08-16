/**
 * Metrics Routes Integration Tests (round-96).
 *
 * metrics.ts (7 endpoints, 0 route tests) is the ops/observability layer:
 * server metrics, per-endpoint breakdown, web-vitals ingest + summary +
 * history, API latency percentiles, and dashboard summary.
 *
 * Coverage focus: auth gating, validation rejection (invalid web-vital name,
 * negative value, empty path, invalid period/interval), and response-shape
 * contracts. The POST /web-vitals endpoint is intentionally unauthenticated
 * (browser beacon) — verified here.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("metrics routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// Read-only tests — no persistent state to clean.
});

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

describe("Metrics Routes", () => {
	describe("auth gating", () => {
		test("GET /api/metrics requires authentication", async () => {
			const res = await request(app).get("/api/metrics");
			expect(res.status).toBe(401);
		});

		test("GET /api/metrics/endpoints requires authentication", async () => {
			const res = await request(app).get("/api/metrics/endpoints");
			expect(res.status).toBe(401);
		});

		test("GET /api/metrics/api-latency requires authentication", async () => {
			const res = await request(app).get("/api/metrics/api-latency");
			expect(res.status).toBe(401);
		});

		test("GET /api/metrics/summary requires authentication", async () => {
			const res = await request(app).get("/api/metrics/summary");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/metrics — server metrics", () => {
		test("returns memory/cpu/uptime/request metrics", async () => {
			const res = await request(app).get("/api/metrics").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.memory).toBeDefined();
			expect(res.body.data.cpu).toBeDefined();
			expect(res.body.data.uptime).toBeDefined();
			expect(res.body.data.requests).toBeDefined();
		});
	});

	describe("GET /api/metrics/endpoints — per-endpoint breakdown", () => {
		test("returns an endpoints object", async () => {
			const res = await request(app).get("/api/metrics/endpoints").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.endpoints).toBeDefined();
		});
	});

	describe("GET /api/metrics/api-latency — latency percentiles", () => {
		test("returns overall + per-endpoint latency stats", async () => {
			const res = await request(app).get("/api/metrics/api-latency").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.overall).toBeDefined();
			expect(res.body.data.overall).toHaveProperty("p95");
		});
	});

	describe("POST /api/metrics/web-vitals — ingest (unauthenticated beacon)", () => {
		test("accepts a valid web-vital report WITHOUT authentication", async () => {
			// This endpoint is intentionally public — the browser beacon has no
			// auth token. It must not 401.
			const res = await request(app)
				.post("/api/metrics/web-vitals")
				.send({ name: "LCP", value: 2.5, path: "/dashboard" });
			// Pin the exact contract (was not-401 + <500 — a regression to
			// 400 for valid vitals still passed, round-106).
			expect(res.status).toBe(200);
		});

		test("rejects an invalid metric name with 400", async () => {
			const res = await request(app)
				.post("/api/metrics/web-vitals")
				.send({ name: "BOGUS", value: 1.0, path: "/" });
			expect(res.status).toBe(400);
		});

		test("rejects a negative value with 400", async () => {
			const res = await request(app)
				.post("/api/metrics/web-vitals")
				.send({ name: "LCP", value: -1, path: "/" });
			expect(res.status).toBe(400);
		});

		test("rejects an empty path with 400", async () => {
			const res = await request(app)
				.post("/api/metrics/web-vitals")
				.send({ name: "LCP", value: 1.0, path: "" });
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/metrics/web-vitals — summary", () => {
		test("returns a summary for the default period", async () => {
			const res = await request(app).get("/api/metrics/web-vitals?period=24h").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		test("rejects an invalid period with 400", async () => {
			const res = await request(app).get("/api/metrics/web-vitals?period=99h").set(authHeaders());
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/metrics/web-vitals/history", () => {
		test("rejects an invalid metric with 400", async () => {
			const res = await request(app)
				.get("/api/metrics/web-vitals/history?metric=BOGUS")
				.set(authHeaders());
			expect(res.status).toBe(400);
		});

		test("rejects an invalid interval with 400", async () => {
			const res = await request(app)
				.get("/api/metrics/web-vitals/history?metric=LCP&interval=99m")
				.set(authHeaders());
			expect(res.status).toBe(400);
		});
	});
});
