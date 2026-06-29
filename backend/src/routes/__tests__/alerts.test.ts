/**
 * Alerts Route Integration Tests
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import {
	createTestApp,
	getAdminToken,
	isDbAvailable,
} from "@/test/helpers/testApp";

let app: Express;
let dbAvailable = false;
let token: string;

describe("Alerts Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/alerts", () => {
		it("should return alerts list", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/alerts")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("alerts");
			expect(res.body.data).toHaveProperty("total");
			expect(typeof res.body.data.total).toBe("number");
		});

		it("should support limit param", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/alerts?limit=5")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.data.alerts.length).toBeLessThanOrEqual(5);
		});
	});

	describe("GET /api/alerts/stats", () => {
		it("should return alert statistics", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/alerts/stats")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	describe("PATCH /api/alerts/read-all", () => {
		it("should mark all alerts as read", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.patch("/api/alerts/read-all")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	it("should reject unauthenticated request", async () => {
		if (!dbAvailable) return;
		const res = await request(app).get("/api/alerts");
		expect(res.status).toBe(401);
	});
});
