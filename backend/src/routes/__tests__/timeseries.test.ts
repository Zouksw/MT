/**
 * Timeseries Routes Integration Tests (round-89).
 *
 * The /api/timeseries routes (CRUD for time series + data points) had zero
 * direct route-layer tests. This file covers: auth gating, listing with
 * pagination, 404 for non-existent IDs.
 *
 * round-104: cross-user ownership suites for the mutating endpoints. Before
 * the fix, DELETE /:id had no ownership check (any authenticated user could
 * destroy any series) and POST /:id/data neither checked ownership nor
 * validated the body (a missing `value` silently fabricated a 0 data point).
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { jwtUtils, prisma } from "@/lib";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("timeseries routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// No persistent state — read-only tests + a non-existent-ID 404 probe.
});

describe("Timeseries Routes (Integration)", () => {
	describe("GET /api/timeseries", () => {
		test("requires authentication", async () => {
			const res = await request(app).get("/api/timeseries");
			expect(res.status).toBe(401);
		});

		test("returns paginated timeseries list", async () => {
			const res = await request(app)
				.get("/api/timeseries?page=1&limit=10")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// The response shape may use pagination or data key — verify one.
			expect(res.body.data ?? res.body.pagination).toBeDefined();
		});
	});

	describe("GET /api/timeseries/:id", () => {
		test("returns 404 for a non-existent timeseries", async () => {
			const res = await request(app)
				.get("/api/timeseries/00000000-0000-0000-0000-000000000000")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(404);
		});

		test("requires authentication", async () => {
			const res = await request(app).get("/api/timeseries/00000000-0000-0000-0000-000000000000");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/timeseries/:id/data", () => {
		test("returns 404 for a non-existent timeseries", async () => {
			const res = await request(app)
				.get("/api/timeseries/00000000-0000-0000-0000-000000000000/data")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(404);
		});

		test("requires authentication", async () => {
			const res = await request(app).get(
				"/api/timeseries/00000000-0000-0000-0000-000000000000/data",
			);
			expect(res.status).toBe(401);
		});
	});
});

// ---------------------------------------------------------------------------
// Cross-user ownership (round-104). Two real users; A owns the series, B is
// an unrelated authenticated user. Mutating endpoints must treat B exactly
// like a missing id (404, no existence disclosure) — mirrors the dataset IDOR
// fix pinned in datasetService.idor.test.ts.
// ---------------------------------------------------------------------------
describe("Timeseries ownership (cross-user)", () => {
	const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	let tokenA = "";
	let tokenB = "";
	let seriesA = { id: "" };
	let seriesForDelete = { id: "" };
	let orgId = "";
	const userIds: string[] = [];

	beforeAll(async () => {
		const userA = await prisma.user.create({
			data: {
				email: `ts-owner-a-${stamp}@test`,
				name: "TS Owner A",
				passwordHash: "test-hash-not-real",
				role: "EDITOR",
			},
		});
		const userB = await prisma.user.create({
			data: {
				email: `ts-owner-b-${stamp}@test`,
				name: "TS Owner B",
				passwordHash: "test-hash-not-real",
				role: "EDITOR",
			},
		});
		userIds.push(userA.id, userB.id);
		tokenA = jwtUtils.generateToken(userA.id);
		tokenB = jwtUtils.generateToken(userB.id);

		const org = await prisma.organizations.create({
			data: {
				id: `ts-org-${stamp}`,
				owner_id: userA.id,
				name: `TS ownership org ${stamp}`,
				slug: `ts-org-${stamp}`,
			},
		});
		orgId = org.id;

		const dataset = await prisma.dataset.create({
			data: {
				name: "TS ownership dataset",
				slug: `ts-ds-${stamp}`,
				storageFormat: "CSV",
				ownerId: userA.id,
				organization_id: org.id,
			},
		});
		seriesA = await prisma.timeseries.create({
			data: { datasetId: dataset.id, name: "A's series", slug: `a-series-${stamp}` },
		});
		seriesForDelete = await prisma.timeseries.create({
			data: { datasetId: dataset.id, name: "A's delete target", slug: `a-del-${stamp}` },
		});
	});

	afterAll(async () => {
		// FK-safe order: datasets cascade timeseries/datapoints → orgs → users.
		await prisma.dataset.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
		await prisma.organizations.deleteMany({ where: { id: orgId } }).catch(() => {});
		await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
	});

	describe("POST /api/timeseries/:id/data", () => {
		test("non-owner gets 404 (indistinguishable from missing)", async () => {
			const res = await request(app)
				.post(`/api/timeseries/${seriesA.id}/data`)
				.set("Authorization", `Bearer ${tokenB}`)
				.send({ value: 99 });
			expect(res.status).toBe(404);
		});

		test("missing value is 400, not a fabricated 0 point", async () => {
			const res = await request(app)
				.post(`/api/timeseries/${seriesA.id}/data`)
				.set("Authorization", `Bearer ${tokenA}`)
				.send({});
			expect(res.status).toBe(400);
		});

		test("garbage timestamp is 400, not an Invalid Date 500", async () => {
			const res = await request(app)
				.post(`/api/timeseries/${seriesA.id}/data`)
				.set("Authorization", `Bearer ${tokenA}`)
				.send({ timestamp: "not-a-date", value: 1 });
			expect(res.status).toBe(400);
		});

		test("owner inserts a data point", async () => {
			const res = await request(app)
				.post(`/api/timeseries/${seriesA.id}/data`)
				.set("Authorization", `Bearer ${tokenA}`)
				.send({ value: 12.34 });
			expect(res.status).toBe(201);
			expect(res.body.data.valueJson).toBe("12.34");
		});
	});

	describe("DELETE /api/timeseries/:id", () => {
		test("non-owner gets 404 and the series survives", async () => {
			const res = await request(app)
				.delete(`/api/timeseries/${seriesA.id}`)
				.set("Authorization", `Bearer ${tokenB}`);
			expect(res.status).toBe(404);
			const survivor = await prisma.timeseries.findUnique({ where: { id: seriesA.id } });
			expect(survivor?.id).toBe(seriesA.id);
		});

		test("owner deletes their own series (cascade removes points)", async () => {
			await prisma.datapoint.create({
				data: { timeseriesId: seriesForDelete.id, timestamp: new Date(), valueJson: "1" },
			});
			const res = await request(app)
				.delete(`/api/timeseries/${seriesForDelete.id}`)
				.set("Authorization", `Bearer ${tokenA}`);
			expect(res.status).toBe(200);
			expect(await prisma.timeseries.findUnique({ where: { id: seriesForDelete.id } })).toBeNull();
			expect(await prisma.datapoint.count({ where: { timeseriesId: seriesForDelete.id } })).toBe(0);
		});
	});
});
