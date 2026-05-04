/**
 * User Feature Route Integration Tests
 *
 * Tests watchlists and billing endpoints against a running backend.
 * Uses real admin token and cleans up test data.
 */

import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_PREFIX = `usr-${Date.now()}`;
const ADMIN_EMAIL = "admin@trademind.com";
const ADMIN_PASSWORD = "Admin123!";
const REAL_DB_URL =
	"postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced";
const BASE = `http://localhost:${process.env.PORT || 8000}`;

let prisma: PrismaClient;
let dbAvailable = false;
let token: string;

async function checkDatabase(): Promise<boolean> {
	try {
		const res = await fetch(
			`http://localhost:${process.env.PORT || 8000}/health`,
			{ signal: AbortSignal.timeout(3000) },
		);
		if (!res.ok) return false;
		const p = new PrismaClient({
			log: [],
			datasources: { db: { url: REAL_DB_URL } },
		});
		await p.$connect();
		await p.$executeRaw`SELECT 1`;
		await p.$disconnect();
		return true;
	} catch {
		return false;
	}
}

async function getAdminToken(): Promise<string> {
	const res = await request(BASE)
		.post("/api/auth/login")
		.send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
	return res.body.data.token;
}

describe("User Feature Routes (Integration)", () => {
	beforeAll(async () => {
		dbAvailable = await checkDatabase();
		if (!dbAvailable) return;
		prisma = new PrismaClient({
			log: ["error"],
			datasources: { db: { url: REAL_DB_URL } },
		});
		token = await getAdminToken();
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
		await prisma.$disconnect();
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/watchlists", () => {
		it("should return watchlists (may be empty for admin)", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
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
			const res = await request(BASE)
				.post("/api/watchlists")
				.set("Authorization", `Bearer ${token}`)
				.send({ name: `${TEST_PREFIX}-watchlist` });

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.watchlist.name).toBe(`${TEST_PREFIX}-watchlist`);
		});

		it("should reject duplicate watchlist name", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
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
			const listRes = await request(BASE)
				.get("/api/watchlists")
				.set("Authorization", `Bearer ${token}`);

			const wl = listRes.body.data.watchlists.find(
				(w: { name: string }) => w.name === `${TEST_PREFIX}-watchlist`,
			);
			watchlistId = wl.id;

			const res = await request(BASE)
				.post(`/api/watchlists/${watchlistId}/items`)
				.set("Authorization", `Bearer ${token}`)
				.send({ commodityId });

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
		});

		it("should list watchlist with items and latest prices", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
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
			const res = await request(BASE)
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
			const res = await request(BASE)
				.get("/api/billing/subscription")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("plan");
			expect(res.body.data).toHaveProperty("limits");
		});
	});
});
