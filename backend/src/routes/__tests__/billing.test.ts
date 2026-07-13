/**
 * Billing Route Integration Tests
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, isDbAvailable } from "@/test/helpers/testApp";

let app: Express;
let dbAvailable = false;
let token: string;

describe("Billing Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/billing/plans", () => {
		it("should return available plans", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/billing/plans")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.plans).toHaveLength(3);
			expect(res.body.data.plans[0]).toHaveProperty("id");
			expect(res.body.data.plans[0]).toHaveProperty("name");
			expect(res.body.data.plans[0]).toHaveProperty("price");
			expect(res.body.data.plans[0]).toHaveProperty("features");
		});
	});

	describe("GET /api/billing/subscription", () => {
		it("should return current subscription", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/billing/subscription")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("plan");
			expect(res.body.data).toHaveProperty("limits");
		});
	});

	describe("GET /api/billing/usage", () => {
		it("should return usage stats", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/billing/usage")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	describe("POST /api/billing/cancel", () => {
		it("rejects cancel with 400 when the user has no paid subscription", async () => {
			// Previously this test was a tautology — it accepted BOTH the success
			// branch (200 + message) and the failure branch (400), so it could
			// never fail. The seed creates no Subscription row for the admin
			// user, so the cancel route's `!sub` guard reliably fires and throws
			// BadRequestError → 400. Assert that deterministically.
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/billing/cancel")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
		});
	});

	it("should reject unauthenticated request", async () => {
		if (!dbAvailable) return;
		const res = await request(app).get("/api/billing/plans");
		expect(res.status).toBe(401);
	});
});
