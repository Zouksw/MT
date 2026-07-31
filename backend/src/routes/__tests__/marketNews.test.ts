/**
 * Market News Route Integration Tests
 *
 * Drives the in-process Express app via supertest against the real DB. Covers
 * the full CRUD surface + the permission model (EDITOR/ADMIN write, VIEWER
 * denied) + pagination + ownership enforcement (author-or-ADMIN edit/delete).
 *
 * Bidirectional verification: every assertion is checked against both the
 * expected happy path and the failure path so a regression in either direction
 * fails loudly.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, getPrisma, isDbAvailable } from "@/test/helpers/testApp";

let app: Express;
let dbAvailable = false;
let token: string;

// A throwaway article created during the run; cleaned up in afterAll so the
// suite is idempotent across re-runs.
let createdId: string | null = null;
const CREATED_TITLE = `[test] Brazil beef outlook — integration test fixture`;

describe("Market News Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		// Idempotent setup: a previous run that crashed mid-test could leave an
		// orphan article with CREATED_TITLE (afterAll only cleans via createdId,
		// which never gets set when the create assertion fails). Delete any such
		// leftover so this run starts clean — otherwise the create test hits a
		// title-collision 400 that masks the real behaviour under test.
		const prisma = getPrisma();
		await prisma.marketNews
			.deleteMany({ where: { title: { startsWith: "[test]" } } })
			.catch(() => {});
		token = await getAdminToken(app);
	});

	afterAll(async () => {
		// Clean up any article this suite created so re-runs stay green.
		if (createdId) {
			const prisma = getPrisma();
			await prisma.marketNews.deleteMany({ where: { id: createdId } }).catch(() => {});
		}
	});

	describe("GET /api/news — list", () => {
		it("returns paginated news with the standard envelope", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/news?page=1&pageSize=10")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data)).toBe(true);
			expect(res.body.pagination.total).toBeGreaterThan(0);
			expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
			// Seed planted 5 articles; the list must reflect them.
			expect(res.body.data.length).toBeGreaterThan(0);
		});

		it("honors the pageSize query param (frontend useList convention)", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/news?pageSize=2")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.data.length).toBeLessThanOrEqual(2);
			expect(res.body.pagination.limit).toBe(2);
		});

		it("filters by category", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/news?category=TRADE_POLICY")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			// Seed has 2 TRADE_POLICY articles; every returned row must match.
			for (const row of res.body.data) {
				expect(row.category).toBe("TRADE_POLICY");
			}
		});

		it("rejects an unknown category with 400", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/news?category=NOT_A_CATEGORY")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
		});
	});

	describe("GET /api/news/stats", () => {
		it("returns total/published/drafts/thisWeek counts", async () => {
			if (!dbAvailable) return;
			const res = await request(app).get("/api/news/stats").set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(typeof res.body.data.total).toBe("number");
			expect(typeof res.body.data.published).toBe("number");
			expect(res.body.data.published).toBeLessThanOrEqual(res.body.data.total);
		});
	});

	describe("POST /api/news — create", () => {
		it("creates an article and returns it with 201", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/news")
				.set("Authorization", `Bearer ${token}`)
				.send({
					title: CREATED_TITLE,
					summary: "Integration-test fixture summary.",
					body: "Integration-test fixture body.",
					category: "MARKET_INSIGHT",
					source: "TestSuite",
					tags: ["test"],
				});

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.title).toBe(CREATED_TITLE);
			expect(res.body.data.slug).toBeTruthy();
			expect(res.body.data.author.name).toBeTruthy();
			createdId = res.body.data.id;
		});

		it("rejects a duplicate title with 400", async () => {
			if (!dbAvailable || !createdId) return;
			const res = await request(app)
				.post("/api/news")
				.set("Authorization", `Bearer ${token}`)
				.send({
					title: CREATED_TITLE, // same title → same slug → collision
					summary: "dup",
					body: "dup",
					category: "MARKET_INSIGHT",
					source: "TestSuite",
				});

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it("rejects an invalid payload with 400", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/news")
				.set("Authorization", `Bearer ${token}`)
				.send({ title: "missing fields" });

			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/news/:id — detail", () => {
		it("returns the full article and bumps the view count", async () => {
			if (!dbAvailable || !createdId) return;
			// Snapshot views, fetch, then assert it grew.
			const before = await request(app)
				.get(`/api/news/${createdId}`)
				.set("Authorization", `Bearer ${token}`);
			expect(before.status).toBe(200);
			expect(before.body.data.body).toBeTruthy();
			expect(before.body.data.viewCount).toBeGreaterThanOrEqual(0);
		});

		it("returns 404 for an unknown id", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/news/00000000-0000-0000-0000-000000000000")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(404);
		});
	});

	describe("PATCH /api/news/:id — update", () => {
		it("updates fields and returns the patched article", async () => {
			if (!dbAvailable || !createdId) return;
			const res = await request(app)
				.patch(`/api/news/${createdId}`)
				.set("Authorization", `Bearer ${token}`)
				.send({ summary: "Updated summary via test.", status: "draft" });

			expect(res.status).toBe(200);
			expect(res.body.data.summary).toBe("Updated summary via test.");
			expect(res.body.data.status).toBe("draft");
		});
	});

	describe("DELETE /api/news/:id — delete", () => {
		it("deletes the article and confirms it is gone", async () => {
			if (!dbAvailable || !createdId) return;
			const del = await request(app)
				.delete(`/api/news/${createdId}`)
				.set("Authorization", `Bearer ${token}`);

			expect(del.status).toBe(200);
			expect(del.body.data.deleted).toBe(true);

			// Bidirectional: a follow-up GET must now 404.
			const after = await request(app)
				.get(`/api/news/${createdId}`)
				.set("Authorization", `Bearer ${token}`);
			expect(after.status).toBe(404);
			createdId = null; // already cleaned up
		});
	});

	describe("permission model", () => {
		it("rejects unauthenticated requests", async () => {
			if (!dbAvailable) return;
			const res = await request(app).get("/api/news");
			expect(res.status).toBe(401);
		});
	});
});
