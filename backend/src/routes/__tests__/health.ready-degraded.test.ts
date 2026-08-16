/**
 * /health/ready — degraded-dependency contract (round-106 regression).
 *
 * Previously only the database flipped allHealthy: with Redis down (or the
 * inference service not ready) the endpoint still returned 200
 * {status:"ready"} with checks.redis:false / checks.inference:false — load
 * balancers reading /ready kept routing traffic to degraded nodes. Both are
 * now hard dependencies: either down → 503 SERVICE_NOT_READY.
 *
 * Redis-down is simulated by mocking @/lib/redis to return no client. The
 * real inference service is expected to be reachable (it is in CI/dev); the
 * assertion pins that a healthy inference does NOT mask a dead Redis.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({
	getRedisClient: vi.fn().mockResolvedValue(null),
}));

import { createTestApp, requireDb } from "@/test/helpers/testApp";

let app: Express;

describe("GET /health/ready — degraded dependencies", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("health-degraded");
	});

	it("returns 503 when Redis is unavailable, even with DB+inference healthy", async () => {
		const res = await request(app).get("/health/ready");

		expect(res.status).toBe(503);
		expect(res.body.success).toBe(false);
		expect(res.body.error.code).toBe("SERVICE_NOT_READY");
		expect(res.body.error.details.checks.redis).toBe(false);
		expect(res.body.error.details.checks.database).toBe(true);
	});
});
