/**
 * Billing Route Integration Tests
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

describe("Billing Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("billing");
		token = await getAdminToken(app);
	});

	describe("GET /api/billing/plans", () => {
		it("should return available plans", async () => {
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

		it("plan copy matches the open-phase reality (round-119)", async () => {
			// AI tier gating is dormant (AI_TIER_ENFORCED, default off): every
			// registered user can currently run all 9 model ids. The free tier
			// must not claim a 3-model restriction that does not exist, and the
			// pro tier must not carry the stale "7 models" count.
			const res = await request(app)
				.get("/api/billing/plans")
				.set({ Authorization: `Bearer ${token}` });

			const [free, pro] = res.body.data.plans;
			expect(free.features.some((f: string) => f.includes("All 9 AI prediction models"))).toBe(
				true,
			);
			expect(pro.features.some((f: string) => f.includes("All 9 AI models"))).toBe(true);
			const allFeatures = res.body.data.plans.flatMap((p: { features: string[] }) => p.features);
			for (const f of allFeatures) {
				expect(f).not.toMatch(/7 AI|3 AI prediction/);
			}
		});
	});

	describe("GET /api/billing/subscription", () => {
		it("should return current subscription", async () => {
			const res = await request(app)
				.get("/api/billing/subscription")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("plan");
			expect(res.body.data).toHaveProperty("limits");
		});
	});

	describe("POST /api/billing/cancel", () => {
		it("rejects cancel with 400 when the user has no paid subscription", async () => {
			// Previously this test was a tautology — it accepted BOTH the success
			// branch (200 + message) and the failure branch (400), so it could
			// never fail. The seed creates no Subscription row for the admin
			// user, so the cancel route's `!sub` guard reliably fires and throws
			// BadRequestError → 400. Assert that deterministically.
			const res = await request(app)
				.post("/api/billing/cancel")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
		});
	});

	it("should reject unauthenticated request", async () => {
		const res = await request(app).get("/api/billing/plans");
		expect(res.status).toBe(401);
	});
});
