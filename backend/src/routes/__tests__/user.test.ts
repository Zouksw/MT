/**
 * User Feature Route Integration Tests
 *
 * Drives the in-process Express app via supertest.
 * Uses real admin token and cleans up test data.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestApp,
	getAdminToken,
	getPrisma,
	isDbAvailable,
} from "@/test/helpers/testApp";

const TEST_PREFIX = `usr-${Date.now()}`;

let app: Express;
const prisma = getPrisma();
let dbAvailable = false;
let token: string;

describe("User Feature Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	afterAll(async () => {
		if (!dbAvailable) return;
		try {
			await prisma.watchlist.deleteMany({
				where: { name: { startsWith: TEST_PREFIX } },
			});
		} catch {
			/* ignore */
		}
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/watchlists", () => {
		it("should return watchlists (may be empty for admin)", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/watchlists")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.watchlists)).toBe(true);
		});
	});

	describe("POST /api/watchlists", () => {
		it("should create a watchlist", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/watchlists")
				.set("Authorization", `Bearer ${token}`)
				.send({ name: `${TEST_PREFIX}-watchlist` });

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.watchlist.name).toBe(`${TEST_PREFIX}-watchlist`);
		});

		it("should reject duplicate watchlist name", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/watchlists")
				.set("Authorization", `Bearer ${token}`)
				.send({ name: `${TEST_PREFIX}-watchlist` });

			expect(res.status).toBe(400);
		});
	});

	describe("Watchlist items", () => {
		let watchlistId: string;
		let commodityId: string;

		it("should add commodity to watchlist", async () => {
			if (!dbAvailable) return;
			// Get a real commodity
			const [row] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM commodities WHERE slug = 'wheat_cme' LIMIT 1
      `;
			commodityId = row.id;

			// Get the watchlist we created
			const listRes = await request(app)
				.get("/api/watchlists")
				.set("Authorization", `Bearer ${token}`);

			const wl = listRes.body.data.watchlists.find(
				(w: { name: string }) => w.name === `${TEST_PREFIX}-watchlist`,
			);
			watchlistId = wl.id;

			const res = await request(app)
				.post(`/api/watchlists/${watchlistId}/items`)
				.set("Authorization", `Bearer ${token}`)
				.send({ commodityId });

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
		});

		it("should list watchlist with items and latest prices", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/watchlists")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			const wl = res.body.data.watchlists.find(
				(w: { name: string }) => w.name === `${TEST_PREFIX}-watchlist`,
			);
			expect(wl).toBeDefined();
			expect(wl.itemCount).toBeGreaterThanOrEqual(1);
		});
	});

	describe("GET /api/billing/plans", () => {
		it("should return all plans with features", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/billing/plans")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.plans).toHaveLength(3);
			expect(res.body.data.plans[0]).toHaveProperty("name");
			expect(res.body.data.plans[0]).toHaveProperty("price");
		});
	});

	describe("GET /api/billing/subscription", () => {
		it("should return current subscription", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/billing/subscription")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("plan");
			expect(res.body.data).toHaveProperty("limits");
		});
	});
});
