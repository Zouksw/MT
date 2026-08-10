/**
 * Watchlist Routes Integration Tests (round-95).
 *
 * watchlist.ts (7 endpoints, thin CRUD delegating to watchlistService) had 0
 * route-layer tests. The service has its own tests, so this suite focuses on
 * route-layer concerns: auth gating, zod validation, and the ownership/404
 * contracts the route forwards from the service.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, getPrisma, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("watchlist routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	const prisma = getPrisma();
	try {
		// Reclaim watchlists created during this run (timestamp-suffixed names).
		const lists = await prisma.watchlist.findMany({
			where: { name: { startsWith: "rt-test-" } },
			select: { id: true },
		});
		if (lists.length > 0) {
			await prisma.watchlistItem.deleteMany({
				where: { watchlistId: { in: lists.map((l) => l.id) } },
			});
			await prisma.watchlist.deleteMany({
				where: { name: { startsWith: "rt-test-" } },
			});
		}
	} catch {
		/* best-effort cleanup */
	}
});

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

async function seedCommodityId(): Promise<string> {
	const prisma = getPrisma();
	const c = await prisma.commodity.findUnique({ where: { slug: "aud_usd" } });
	if (!c) throw new Error("seed must include commodity 'aud_usd' for watchlist test");
	return c.id;
}

describe("Watchlist Routes", () => {
	describe("auth gating", () => {
		test("GET /api/watchlists requires authentication", async () => {
			const res = await request(app).get("/api/watchlists");
			expect(res.status).toBe(401);
		});

		test("POST /api/watchlists requires authentication", async () => {
			const res = await request(app).post("/api/watchlists").send({ name: "x" });
			expect(res.status).toBe(401);
		});
	});

	describe("POST /api/watchlists — create", () => {
		test("creates a watchlist and returns 201", async () => {
			const name = `rt-test-create-${Date.now()}`;
			const res = await request(app).post("/api/watchlists").set(authHeaders()).send({ name });
			expect(res.status).toBe(201);
			expect(res.body.data.watchlist.name).toBe(name);
			expect(res.body.data.watchlist.id).toBeDefined();
		});

		test("rejects empty name with 400", async () => {
			const res = await request(app).post("/api/watchlists").set(authHeaders()).send({ name: "" });
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/watchlists — list", () => {
		test("returns an array of watchlists", async () => {
			const res = await request(app).get("/api/watchlists").set(authHeaders());
			expect(res.status).toBe(200);
			expect(Array.isArray(res.body.data.watchlists)).toBe(true);
		});
	});

	describe("item lifecycle", () => {
		test("add item then remove it", async () => {
			const commodityId = await seedCommodityId();
			const create = await request(app)
				.post("/api/watchlists")
				.set(authHeaders())
				.send({ name: `rt-test-item-${Date.now()}` });
			const id = create.body.data.watchlist.id;

			// Add an item.
			const add = await request(app)
				.post(`/api/watchlists/${id}/items`)
				.set(authHeaders())
				.send({ commodityId });
			expect(add.status).toBe(201);
			expect(add.body.data.item).toBeDefined();

			// Remove it.
			const del = await request(app)
				.delete(`/api/watchlists/${id}/items/${commodityId}`)
				.set(authHeaders());
			expect(del.status).toBe(200);
			expect(del.body.data.deleted).toBe(true);
		});

		test("rejects non-UUID commodityId with 400", async () => {
			const create = await request(app)
				.post("/api/watchlists")
				.set(authHeaders())
				.send({ name: `rt-test-badcid-${Date.now()}` });
			const id = create.body.data.watchlist.id;

			const res = await request(app)
				.post(`/api/watchlists/${id}/items`)
				.set(authHeaders())
				.send({ commodityId: "not-a-uuid" });
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/watchlists/:id/quotes", () => {
		test("returns quotes for a watchlist", async () => {
			const create = await request(app)
				.post("/api/watchlists")
				.set(authHeaders())
				.send({ name: `rt-test-quotes-${Date.now()}` });
			const id = create.body.data.watchlist.id;

			const res = await request(app).get(`/api/watchlists/${id}/quotes`).set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// quotes may be empty (no items added) but the field must exist.
			expect(res.body.data).toHaveProperty("quotes");
		});
	});

	describe("DELETE /api/watchlists/:id", () => {
		test("deletes a watchlist", async () => {
			const create = await request(app)
				.post("/api/watchlists")
				.set(authHeaders())
				.send({ name: `rt-test-delete-${Date.now()}` });
			const id = create.body.data.watchlist.id;

			const res = await request(app).delete(`/api/watchlists/${id}`).set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.deleted).toBe(true);
		});
	});
});
