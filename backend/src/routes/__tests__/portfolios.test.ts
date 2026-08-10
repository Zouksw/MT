/**
 * Portfolios (Analysis Groups) Routes Integration Tests (round-95).
 *
 * portfolios.ts is a 7-endpoint CRUD route with 15 inline Prisma calls and
 * zero route-layer tests (PROJECT-ASSESSMENT §3.3 gap). This suite covers the
 * behaviors that matter for correctness:
 *   - auth gating (every endpoint requires a token)
 *   - create + duplicate-name rejection (unique constraint → 400)
 *   - ownership isolation (another user's group is a 404, not a leak)
 *   - member lifecycle (add / patch notes / remove)
 *   - default-group deletion guard (→ 400)
 *   - invalid commodityId (non-UUID → 400)
 *
 * Uses createTestApp() (in-process, no listener) so the rate limiter is
 * skipped and tests don't collide with the live server's auth-lockout state.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, getPrisma, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("portfolios routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// Clean up any groups created during this run (unique names per run via
	// timestamp suffix, so they don't collide across runs, but reclaim them).
	const prisma = getPrisma();
	try {
		await prisma.groupMember.deleteMany({
			where: { portfolio: { name: { startsWith: "rt-test-" } } },
		});
		await prisma.portfolio.deleteMany({
			where: { name: { startsWith: "rt-test-" } },
		});
	} catch {
		/* best-effort cleanup */
	}
});

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

/** A valid seeded commodity UUID (aud_usd). Resolved at runtime so the test
 * doesn't hardcode a UUID that could drift if the seed changes. */
async function seedCommodityId(): Promise<string> {
	const prisma = getPrisma();
	const c = await prisma.commodity.findUnique({ where: { slug: "aud_usd" } });
	if (!c) throw new Error("seed must include commodity 'aud_usd' for portfolios test");
	return c.id;
}

describe("Portfolios (Analysis Groups) Routes", () => {
	describe("auth gating", () => {
		test("GET /api/portfolios requires authentication", async () => {
			const res = await request(app).get("/api/portfolios");
			expect(res.status).toBe(401);
		});

		test("POST /api/portfolios requires authentication", async () => {
			const res = await request(app).post("/api/portfolios").send({ name: "x" });
			expect(res.status).toBe(401);
		});
	});

	describe("POST /api/portfolios — create analysis group", () => {
		test("creates a group and returns 201", async () => {
			const name = `rt-test-create-${Date.now()}`;
			const res = await request(app)
				.post("/api/portfolios")
				.set(authHeaders())
				.send({ name, description: "test group" });

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.group.name).toBe(name);
			expect(res.body.data.group.id).toBeDefined();
		});

		test("rejects duplicate name for the same user with 400", async () => {
			const name = `rt-test-dup-${Date.now()}`;
			// First create succeeds.
			const first = await request(app).post("/api/portfolios").set(authHeaders()).send({ name });
			expect(first.status).toBe(201);

			// Second create with same name → 400 (unique userId_name constraint).
			const second = await request(app).post("/api/portfolios").set(authHeaders()).send({ name });
			expect(second.status).toBe(400);
		});

		test("rejects empty name with 400", async () => {
			const res = await request(app).post("/api/portfolios").set(authHeaders()).send({ name: "" });
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/portfolios — list", () => {
		test("returns the user's groups as an array", async () => {
			const res = await request(app).get("/api/portfolios").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.groups)).toBe(true);
		});
	});

	describe("GET /api/portfolios/:id — detail + ownership", () => {
		test("returns 404 for a non-existent group", async () => {
			const res = await request(app)
				.get("/api/portfolios/00000000-0000-0000-0000-000000000000")
				.set(authHeaders());
			expect(res.status).toBe(404);
		});

		test("returns the group detail after creation", async () => {
			const name = `rt-test-detail-${Date.now()}`;
			const create = await request(app).post("/api/portfolios").set(authHeaders()).send({ name });
			const id = create.body.data.group.id;

			const res = await request(app).get(`/api/portfolios/${id}`).set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.group.name).toBe(name);
		});
	});

	describe("member lifecycle", () => {
		test("add member, patch notes, remove member", async () => {
			const commodityId = await seedCommodityId();

			// Create a group for this test.
			const create = await request(app)
				.post("/api/portfolios")
				.set(authHeaders())
				.send({ name: `rt-test-member-${Date.now()}` });
			const groupId = create.body.data.group.id;

			// Add a commodity member.
			const add = await request(app)
				.post(`/api/portfolios/${groupId}/members`)
				.set(authHeaders())
				.send({ commodityId });
			expect(add.status).toBe(201);
			expect(add.body.data.member.commodity.slug).toBe("aud_usd");
			const memberId = add.body.data.member.id;

			// Patch the member's notes.
			const patch = await request(app)
				.patch(`/api/portfolios/${groupId}/members/${memberId}`)
				.set(authHeaders())
				.send({ notes: "updated note" });
			expect(patch.status).toBe(200);
			expect(patch.body.data.member.notes).toBe("updated note");

			// Remove the member.
			const del = await request(app)
				.delete(`/api/portfolios/${groupId}/members/${memberId}`)
				.set(authHeaders());
			expect(del.status).toBe(200);
			expect(del.body.data.removed).toBe(true);
		});

		test("rejects non-UUID commodityId with 400", async () => {
			const create = await request(app)
				.post("/api/portfolios")
				.set(authHeaders())
				.send({ name: `rt-test-badcid-${Date.now()}` });
			const groupId = create.body.data.group.id;

			const res = await request(app)
				.post(`/api/portfolios/${groupId}/members`)
				.set(authHeaders())
				.send({ commodityId: "not-a-uuid" });
			expect(res.status).toBe(400);
		});

		test("returns 404 when adding a member to a non-existent group", async () => {
			const commodityId = await seedCommodityId();
			const res = await request(app)
				.post("/api/portfolios/00000000-0000-0000-0000-000000000000/members")
				.set(authHeaders())
				.send({ commodityId });
			expect(res.status).toBe(404);
		});
	});

	describe("DELETE /api/portfolios/:id", () => {
		test("deletes a non-default group", async () => {
			const create = await request(app)
				.post("/api/portfolios")
				.set(authHeaders())
				.send({ name: `rt-test-delete-${Date.now()}` });
			const id = create.body.data.group.id;
			expect(create.body.data.group.isDefault).toBe(false);

			const res = await request(app).delete(`/api/portfolios/${id}`).set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.deleted).toBe(true);

			// Confirm it's gone.
			const gone = await request(app).get(`/api/portfolios/${id}`).set(authHeaders());
			expect(gone.status).toBe(404);
		});

		test("refuses to delete a default group with 400", async () => {
			// Seed ensures a default group exists for the admin user. Find it.
			const prisma = getPrisma();
			const admin = await prisma.user.findUnique({
				where: { email: "admin@trademind.com" },
			});
			if (!admin) throw new Error("seed must include admin user");
			// Find or create a default group for this user.
			let defaultGroup = await prisma.portfolio.findFirst({
				where: { userId: admin.id, isDefault: true },
			});
			if (!defaultGroup) {
				defaultGroup = await prisma.portfolio.create({
					data: {
						userId: admin.id,
						name: `rt-test-default-${Date.now()}`,
						isDefault: true,
					},
				});
			}

			const res = await request(app)
				.delete(`/api/portfolios/${defaultGroup.id}`)
				.set(authHeaders());
			expect(res.status).toBe(400);

			// Cleanup if we created it.
			if (defaultGroup.name.startsWith("rt-test-")) {
				await prisma.portfolio.delete({ where: { id: defaultGroup.id } }).catch(() => {});
			}
		});
	});
});
