/**
 * Garbage-input regression guards (round-106).
 *
 * A family of query params reached Prisma unvalidated and produced 500s
 * (PrismaClientValidationError) or silently wrong responses:
 *   - NaN window on correlation endpoints (Invalid Date)
 *   - negative offset / page=0 (negative skip)
 *   - unknown factoryCode (filter silently dropped → unfiltered data)
 *   - invalid from/to dates on beef price history
 *   - repeated ?slugs=a&slugs=b (string[] .split TypeError)
 * All must now be 400/404 (or clamped 200) — never 500.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

describe("Input validation — garbage params must not 500", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("validation-400s");
		token = await getAdminToken(app);
	});

	it("correlation with window=abc is not a 500 (NaN clamped to default)", async () => {
		const res = await request(app)
			.get("/api/signals/correlation?a=brl_usd&b=brl_usd&window=abc")
			.set({ Authorization: `Bearer ${token}` });
		expect(res.status).toBeLessThan(500);
	});

	it("correlation/matrix with window=abc is not a 500", async () => {
		const res = await request(app)
			.get("/api/signals/correlation/matrix?window=abc")
			.set({ Authorization: `Bearer ${token}` });
		expect(res.status).toBeLessThan(500);
	});

	it("prediction history with negative offset is not a 500 (clamped to 0)", async () => {
		const res = await request(app)
			.get("/api/signals/history/chronos_tiny?offset=-50")
			.set({ Authorization: `Bearer ${token}` });
		expect([200, 404]).toContain(res.status);
	});

	it("news list with page=0 is not a 500 (clamped to 1)", async () => {
		const res = await request(app)
			.get("/api/news?page=0&pageSize=5")
			.set({ Authorization: `Bearer ${token}` });
		expect(res.status).toBe(200);
	});

	it("security audit list with page=abc&limit=-1 is not a 500", async () => {
		const res = await request(app)
			.get("/api/security/audit?page=abc&limit=-1")
			.set({ Authorization: `Bearer ${token}` });
		expect(res.status).toBe(200);
	});

	it("security audit POST with invalid timestamp is a 400, not 500", async () => {
		const res = await request(app)
			.post("/api/security/audit")
			.set({ Authorization: `Bearer ${token}` })
			.send({
				logs: [
					{
						event: "LOGOUT",
						sessionId: "validation-400s",
						severity: "low",
						timestamp: "not-a-date",
					},
				],
			});
		expect(res.status).toBe(400);
	});

	it("beef prices with unknown factoryCode → 404 (filter never silently dropped)", async () => {
		const res = await request(app)
			.get("/api/beef/prices?factoryCode=NO-SUCH-FACTORY-999")
			.set({ Authorization: `Bearer ${token}` });
		expect(res.status).toBe(404);
	});

	it("beef price history with from=abc → 400, not 500", async () => {
		const res = await request(app)
			.get("/api/beef/prices/history/BARBECUE?from=abc")
			.set({ Authorization: `Bearer ${token}` });
		expect(res.status).toBe(400);
	});

	it("analytics correlation with repeated slugs param is not a 500", async () => {
		const res = await request(app)
			.get("/api/analytics/correlation?slugs=brl_usd&slugs=wheat_cme")
			.set({ Authorization: `Bearer ${token}` });
		expect([200, 404]).toContain(res.status);
	});
});
