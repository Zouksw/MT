/**
 * Dataset Route Integration Tests
 *
 * Drives the in-process Express app via supertest. Uses real PostgreSQL.
 * Automatically skipped if database is unavailable.
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

const TEST_PREFIX = `ds-${Date.now()}`;

let app: Express;
const prisma = getPrisma();
let dbAvailable = false;
let token: string;

describe("Dataset Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	afterAll(async () => {
		if (!dbAvailable) return;
		try {
			await prisma.dataset.deleteMany({
				where: { slug: { startsWith: TEST_PREFIX } },
			});
		} catch {
			/* ignore cleanup errors */
		}
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/datasets", () => {
		it("should return datasets list with pagination", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/datasets")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data)).toBe(true);
			expect(res.body.pagination).toHaveProperty("total");
			expect(typeof res.body.pagination.total).toBe("number");
		});

		it("should paginate correctly", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/datasets?page=1&limit=2")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.data.length).toBeLessThanOrEqual(2);
			expect(res.body.pagination.limit).toBe(2);
		});
	});

	describe("POST /api/datasets", () => {
		it("should create a dataset", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Integration Test Dataset",
					slug: `${TEST_PREFIX}-dataset`,
					description: "Created by integration test",
					storageFormat: "CSV",
				});

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.name).toBe("Integration Test Dataset");
			expect(res.body.data.slug).toBe(`${TEST_PREFIX}-dataset`);
		});

		it("should reject duplicate slug", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Duplicate",
					slug: `${TEST_PREFIX}-dataset`,
					storageFormat: "CSV",
				});

			expect(res.status).toBe(400);
		});

		it("should reject missing required fields", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({ description: "Missing name and slug" });

			expect(res.status).toBeGreaterThanOrEqual(400);
		});
	});

	describe("GET /api/datasets/:id", () => {
		it("should return 404 for missing dataset", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/datasets/nonexistent-id")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(404);
		});

		it("should return dataset by ID", async () => {
			if (!dbAvailable) return;
			// First create one
			const createRes = await request(app)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Get By ID Test",
					slug: `${TEST_PREFIX}-getbyid`,
					storageFormat: "CSV",
				});

			const datasetId = createRes.body.data.id;

			const res = await request(app)
				.get(`/api/datasets/${datasetId}`)
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.id).toBe(datasetId);
			expect(res.body.data.name).toBe("Get By ID Test");
		});
	});

	describe("PATCH /api/datasets/:id", () => {
		it("should update dataset", async () => {
			if (!dbAvailable) return;
			const createRes = await request(app)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Update Test",
					slug: `${TEST_PREFIX}-update`,
					storageFormat: "CSV",
				});

			const datasetId = createRes.body.data.id;

			const res = await request(app)
				.patch(`/api/datasets/${datasetId}`)
				.set("Authorization", `Bearer ${token}`)
				.send({ description: "Updated by integration test" });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.description).toBe("Updated by integration test");
		});
	});

	describe("DELETE /api/datasets/:id", () => {
		it("should delete dataset and return 404 on re-fetch", async () => {
			if (!dbAvailable) return;
			const createRes = await request(app)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Delete Test",
					slug: `${TEST_PREFIX}-delete`,
					storageFormat: "CSV",
				});

			const datasetId = createRes.body.data.id;

			const delRes = await request(app)
				.delete(`/api/datasets/${datasetId}`)
				.set("Authorization", `Bearer ${token}`);

			expect(delRes.status).toBe(200);
			expect(delRes.body.success).toBe(true);

			const getRes = await request(app)
				.get(`/api/datasets/${datasetId}`)
				.set("Authorization", `Bearer ${token}`);

			expect(getRes.status).toBe(404);
		});
	});
});
