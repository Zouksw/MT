/**
 * Datasets Routes Integration Tests (round-100, D1).
 *
 * datasets.ts (6 endpoints: list/get/create/patch/delete/import) had 0
 * route-layer tests — only datasetService.idor.test.ts covers the service's
 * ownership checks. This suite focuses on route-layer concerns the route
 * forwards from the service: auth gating, zod validation, the 404 contract,
 * and the create→get→patch→delete lifecycle. Mirrors watchlist.test.ts.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, getPrisma, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("datasets routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	const prisma = getPrisma();
	try {
		// Reclaim datasets + their timeseries created during this run.
		const sets = await prisma.dataset.findMany({
			where: { slug: { startsWith: "rt-test-" } },
			select: { id: true },
		});
		if (sets.length > 0) {
			const ids = sets.map((d) => d.id);
			await prisma.datapoint.deleteMany({ where: { timeseries: { datasetId: { in: ids } } } });
			await prisma.timeseries.deleteMany({ where: { datasetId: { in: ids } } });
			await prisma.dataset.deleteMany({ where: { id: { in: ids } } });
		}
	} catch {
		/* best-effort cleanup */
	}
});

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

/** Create a throwaway dataset and return its id. */
async function createDataset(slug: string): Promise<string> {
	const res = await request(app)
		.post("/api/datasets")
		.set(authHeaders())
		.send({ name: slug, slug, storageFormat: "CSV" });
	expect(res.status).toBe(201);
	return res.body.data.id as string;
}

describe("Datasets Routes", () => {
	describe("auth gating", () => {
		test("GET /api/datasets requires authentication", async () => {
			const res = await request(app).get("/api/datasets");
			expect(res.status).toBe(401);
		});

		test("POST /api/datasets requires authentication", async () => {
			const res = await request(app).post("/api/datasets").send({ name: "x", slug: "x" });
			expect(res.status).toBe(401);
		});
	});

	describe("POST /api/datasets — create", () => {
		test("creates a dataset and returns 201", async () => {
			const slug = `rt-test-create-${Date.now()}`;
			const res = await request(app)
				.post("/api/datasets")
				.set(authHeaders())
				.send({ name: slug, slug, storageFormat: "CSV" });
			expect(res.status).toBe(201);
			expect(res.body.data.slug).toBe(slug);
			expect(res.body.data.id).toBeDefined();
			expect(res.body.data.storageFormat).toBe("CSV");
		});

		test("rejects missing slug with 400", async () => {
			const res = await request(app)
				.post("/api/datasets")
				.set(authHeaders())
				.send({ name: "no-slug" });
			expect(res.status).toBe(400);
		});

		test("rejects duplicate slug with 400/409", async () => {
			const slug = `rt-test-dup-${Date.now()}`;
			const first = await request(app)
				.post("/api/datasets")
				.set(authHeaders())
				.send({ name: slug, slug, storageFormat: "CSV" });
			expect(first.status).toBe(201);
			const second = await request(app)
				.post("/api/datasets")
				.set(authHeaders())
				.send({ name: slug, slug, storageFormat: "CSV" });
			expect([400, 409]).toContain(second.status);
		});
	});

	describe("GET /api/datasets — list", () => {
		test("returns a paginated array", async () => {
			const res = await request(app).get("/api/datasets").set(authHeaders());
			expect(res.status).toBe(200);
			expect(Array.isArray(res.body.data)).toBe(true);
			expect(res.body.pagination).toBeDefined();
		});

		test("search filter narrows results", async () => {
			const slug = `rt-test-search-${Date.now()}`;
			await createDataset(slug);
			const res = await request(app)
				.get("/api/datasets")
				.query({ search: "rt-test-search" })
				.set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.some((d: { slug: string }) => d.slug === slug)).toBe(true);
		});
	});

	describe("GET /api/datasets/:id", () => {
		test("returns the dataset by id", async () => {
			const id = await createDataset(`rt-test-get-${Date.now()}`);
			const res = await request(app).get(`/api/datasets/${id}`).set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.id).toBe(id);
		});

		test("returns 404 for an unknown id", async () => {
			const res = await request(app).get("/api/datasets/nonexistent-id").set(authHeaders());
			expect(res.status).toBe(404);
		});
	});

	describe("PATCH /api/datasets/:id", () => {
		test("updates name and returns the updated dataset", async () => {
			const id = await createDataset(`rt-test-patch-${Date.now()}`);
			const res = await request(app)
				.patch(`/api/datasets/${id}`)
				.set(authHeaders())
				.send({ name: "rt-test-patched-name" });
			expect(res.status).toBe(200);
			expect(res.body.data.name).toBe("rt-test-patched-name");
		});
	});

	describe("DELETE /api/datasets/:id", () => {
		test("deletes the dataset", async () => {
			const id = await createDataset(`rt-test-delete-${Date.now()}`);
			const res = await request(app).delete(`/api/datasets/${id}`).set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);

			// Confirm it's gone.
			const after = await request(app).get(`/api/datasets/${id}`).set(authHeaders());
			expect(after.status).toBe(404);
		});
	});

	describe("POST /api/datasets/:id/import", () => {
		test("imports CSV data and returns import stats", async () => {
			const id = await createDataset(`rt-test-import-${Date.now()}`);
			const csv = "date,price\n2026-01-01,100\n2026-01-02,101\n";
			const res = await request(app)
				.post(`/api/datasets/${id}/import`)
				.set(authHeaders())
				.send({ format: "csv", data: csv });
			expect(res.status).toBe(200);
			expect(res.body.data.importStats).toBeDefined();
		});
	});

	// Ported verbatim (semantics kept) from the misnamed legacy file
	// data.test.ts — merged round-100 so every route maps to a test file of
	// the same name. Zero cases dropped; asserts may overlap the blocks above.
	describe("legacy data.test.ts cases (merged round-100)", () => {
		test("list returns pagination with a numeric total", async () => {
			const res = await request(app).get("/api/datasets").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data)).toBe(true);
			expect(typeof res.body.pagination.total).toBe("number");
		});

		test("list honours the limit query param", async () => {
			const res = await request(app).get("/api/datasets?page=1&limit=2").set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.data.length).toBeLessThanOrEqual(2);
			expect(res.body.pagination.limit).toBe(2);
		});

		test("create echoes name and slug for a full body", async () => {
			const slug = `rt-test-full-${Date.now()}`;
			const res = await request(app).post("/api/datasets").set(authHeaders()).send({
				name: "Integration Test Dataset",
				slug,
				description: "Created by integration test",
				storageFormat: "CSV",
			});
			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.name).toBe("Integration Test Dataset");
			expect(res.body.data.slug).toBe(slug);
		});

		test("create rejects a duplicate slug with 400", async () => {
			const slug = `rt-test-dup2-${Date.now()}`;
			const first = await request(app)
				.post("/api/datasets")
				.set(authHeaders())
				.send({ name: slug, slug, storageFormat: "CSV" });
			expect(first.status).toBe(201);
			const second = await request(app)
				.post("/api/datasets")
				.set(authHeaders())
				.send({ name: "Duplicate", slug, storageFormat: "CSV" });
			expect(second.status).toBe(400);
		});

		test("create rejects a body missing name and slug", async () => {
			const res = await request(app)
				.post("/api/datasets")
				.set(authHeaders())
				.send({ description: "no name, no slug" });
			expect(res.status).toBeGreaterThanOrEqual(400);
		});

		test("get by id returns 404 for a nonexistent id", async () => {
			const res = await request(app).get("/api/datasets/nonexistent-id").set(authHeaders());
			expect(res.status).toBe(404);
		});

		test("get by id returns the created dataset", async () => {
			const id = await createDataset(`rt-test-name-${Date.now()}`);
			const res = await request(app).get(`/api/datasets/${id}`).set(authHeaders());
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.id).toBe(id);
		});

		test("patch updates the description", async () => {
			const id = await createDataset(`rt-test-desc-${Date.now()}`);
			const res = await request(app)
				.patch(`/api/datasets/${id}`)
				.set(authHeaders())
				.send({ description: "Updated by integration test" });
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.description).toBe("Updated by integration test");
		});

		test("delete then re-fetch returns 404", async () => {
			const id = await createDataset(`rt-test-gone-${Date.now()}`);
			const del = await request(app).delete(`/api/datasets/${id}`).set(authHeaders());
			expect(del.status).toBe(200);
			expect(del.body.success).toBe(true);
			const after = await request(app).get(`/api/datasets/${id}`).set(authHeaders());
			expect(after.status).toBe(404);
		});
	});
});
