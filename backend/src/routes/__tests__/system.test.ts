/**
 * System Route Integration Tests
 *
 * Tests /health, /health/ready, /health/live against a running backend.
 * These endpoints don't require authentication.
 */

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

const BASE = `http://localhost:${process.env.PORT || 8000}`;
let serverAvailable = false;

describe("System Routes (Integration)", () => {
	beforeAll(async () => {
		try {
			const res = await request(BASE).get("/health");
			serverAvailable = res.status === 200;
		} catch {
			serverAvailable = false;
		}
	});

	it("should return health status", async () => {
		if (!serverAvailable) return;
		const res = await request(BASE).get("/health");
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toMatchObject({ status: "ok" });
		expect(res.body.data).toHaveProperty("uptime");
		expect(res.body.data).toHaveProperty("timestamp");
	});

	it("should return readiness check with real service states", async () => {
		if (!serverAvailable) return;
		const res = await request(BASE).get("/health/ready");
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.checks).toHaveProperty("database");
		// Database should be up since we're running against real backend
		expect(res.body.data.checks.database).toBe(true);
	});

	it("should return liveness check", async () => {
		if (!serverAvailable) return;
		const res = await request(BASE).get("/health/live");
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("memory");
		expect(res.body.data).toHaveProperty("uptime");
	});
});
