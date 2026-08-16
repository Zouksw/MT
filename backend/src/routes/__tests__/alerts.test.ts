/**
 * Alerts Route Integration Tests
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jwtUtils } from "@/lib/jwt";
import { createTestApp, getAdminToken, getPrisma, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

describe("Alerts Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("alerts");
		token = await getAdminToken(app);
	});

	describe("GET /api/alerts", () => {
		it("should return alerts list", async () => {
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
			const res = await request(app)
				.get("/api/alerts?limit=5")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.data.alerts.length).toBeLessThanOrEqual(5);
		});
	});

	describe("GET /api/alerts/stats", () => {
		it("should return alert statistics", async () => {
			const res = await request(app)
				.get("/api/alerts/stats")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	describe("PATCH /api/alerts/read-all", () => {
		it("should mark all alerts as read", async () => {
			const res = await request(app)
				.patch("/api/alerts/read-all")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	it("should reject unauthenticated request", async () => {
		const res = await request(app).get("/api/alerts");
		expect(res.status).toBe(401);
	});

	describe("Alert rules CRUD — GET/PATCH/DELETE /api/alerts/rules", () => {
		// The rules page reads GET /rules; before round-106 it listed from
		// user.preferences.alertRules (never written) and PATCH/DELETE went to
		// endpoints that did not exist. These pin the wiring + ownership.
		const prisma = getPrisma();
		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		let ownerToken = "";
		let otherToken = "";
		let ownerId = "";
		let otherId = "";
		let ruleId = "";

		const ruleBody = {
			timeseriesId: "11111111-1111-4111-8111-111111111111",
			name: `crud-rule-${suffix}`,
			type: "ANOMALY",
			condition: { type: "threshold", operator: ">", value: 100 },
			severity: "WARNING",
			notificationChannels: [{ type: "email", config: {} }],
			cooldownMinutes: 10,
		};

		beforeAll(async () => {
			const owner = await prisma.user.create({
				data: {
					email: `rules-owner-${suffix}@test.local`,
					passwordHash: "x",
					name: "Rules Owner",
					role: "VIEWER",
				},
			});
			const other = await prisma.user.create({
				data: {
					email: `rules-other-${suffix}@test.local`,
					passwordHash: "x",
					name: "Rules Other",
					role: "VIEWER",
				},
			});
			ownerId = owner.id;
			otherId = other.id;
			ownerToken = jwtUtils.generateToken(ownerId);
			otherToken = jwtUtils.generateToken(otherId);

			const res = await request(app)
				.post("/api/alerts/rules")
				.set({ Authorization: `Bearer ${ownerToken}` })
				.send(ruleBody);
			expect(res.status).toBe(201);
			ruleId = res.body.data.id;
		});

		afterAll(async () => {
			// User cascade removes their rules.
			await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
		});

		it("rejects condition types with no evaluator (anomaly/pattern/forecast can never fire)", async () => {
			const res = await request(app)
				.post("/api/alerts/rules")
				.set({ Authorization: `Bearer ${ownerToken}` })
				.send({ ...ruleBody, name: `dead-type-${suffix}`, condition: { type: "anomaly" } });

			expect(res.status).toBe(400);
			expect(res.body.error.message).toContain("no evaluator");
		});

		it("GET /rules returns the created rule in the frontend shape", async () => {
			const res = await request(app)
				.get("/api/alerts/rules")
				.set({ Authorization: `Bearer ${ownerToken}` });

			expect(res.status).toBe(200);
			const rules = res.body.data.rules;
			expect(Array.isArray(rules)).toBe(true);
			const mine = rules.find((r: { id: string }) => r.id === ruleId);
			expect(mine).toBeDefined();
			// Frontend contract: condition/notificationChannels (mapped from the
			// prisma conditions/channels columns), not the raw column names.
			expect(mine.condition).toEqual({ type: "threshold", operator: ">", value: 100 });
			expect(mine.notificationChannels).toEqual([{ type: "email", config: {} }]);
			expect(mine.timeseriesId).toBe(ruleBody.timeseriesId);
		});

		it("GET /rules is scoped to the requesting user", async () => {
			const res = await request(app)
				.get("/api/alerts/rules")
				.set({ Authorization: `Bearer ${otherToken}` });

			expect(res.status).toBe(200);
			expect(res.body.data.rules.some((r: { id: string }) => r.id === ruleId)).toBe(false);
		});

		it("PATCH /rules/:id toggles enabled (the UI switch path)", async () => {
			const res = await request(app)
				.patch(`/api/alerts/rules/${ruleId}`)
				.set({ Authorization: `Bearer ${ownerToken}` })
				.send({ enabled: false });

			expect(res.status).toBe(200);
			expect(res.body.data.enabled).toBe(false);
		});

		it("PATCH /rules/:id by another user is a 404, not a leak", async () => {
			const res = await request(app)
				.patch(`/api/alerts/rules/${ruleId}`)
				.set({ Authorization: `Bearer ${otherToken}` })
				.send({ enabled: true });

			expect(res.status).toBe(404);
		});

		it("DELETE /rules/:id by another user is a 404 and deletes nothing", async () => {
			const res = await request(app)
				.delete(`/api/alerts/rules/${ruleId}`)
				.set({ Authorization: `Bearer ${otherToken}` });

			expect(res.status).toBe(404);
			const stillThere = await prisma.alertRule.findUnique({ where: { id: ruleId } });
			expect(stillThere).not.toBeNull();
		});

		it("DELETE /rules/:id by the owner removes the rule", async () => {
			const res = await request(app)
				.delete(`/api/alerts/rules/${ruleId}`)
				.set({ Authorization: `Bearer ${ownerToken}` });

			expect(res.status).toBe(200);
			expect(res.body.data.deleted).toBe(true);
			const gone = await prisma.alertRule.findUnique({ where: { id: ruleId } });
			expect(gone).toBeNull();
		});
	});
});
