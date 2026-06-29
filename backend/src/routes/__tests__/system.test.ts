/**
 * System Route Integration Tests
 *
 * Drives the in-process Express app via supertest.
 * Tests /health, /health/ready, /health/live. No authentication required.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "@/test/helpers/testApp";

let app: Express;

describe("System Routes (Integration)", () => {
	beforeAll(() => {
		app = createTestApp();
	});

	it("should return health status", async () => {
		const res = await request(app).get("/health");
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toMatchObject({ status: "ok" });
		expect(res.body.data).toHaveProperty("uptime");
		expect(res.body.data).toHaveProperty("timestamp");
	});

	it("should return readiness check with real service states", async () => {
		const res = await request(app).get("/health/ready");
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.checks).toHaveProperty("database");
	});

	it("should return liveness check", async () => {
		const res = await request(app).get("/health/live");
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("memory");
		expect(res.body.data).toHaveProperty("uptime");
	});
});
