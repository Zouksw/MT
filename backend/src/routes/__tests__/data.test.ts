/**
 * Dataset Route Integration Tests
 *
 * Tests real /api/datasets endpoints against a running backend with real PostgreSQL.
 * Automatically skipped if database is unavailable.
 */

import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_PREFIX = `ds-${Date.now()}`;
const ADMIN_EMAIL = "admin@trademind.com";
const ADMIN_PASSWORD = "Admin123!";
const REAL_DB_URL =
	"postgresql://mt_user:mt_password@localhost:5432/mt_db";
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

describe("Dataset Routes (Integration)", () => {
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
			await prisma.dataset.deleteMany({
				where: { slug: { startsWith: TEST_PREFIX } },
			});
		} catch {
			/* ignore cleanup errors */
		}
		await prisma.$disconnect();
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/datasets", () => {
		it("should return datasets list with pagination", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
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
			const res = await request(BASE)
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
			const res = await request(BASE)
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
			const res = await request(BASE)
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
			const res = await request(BASE)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({ description: "Missing name and slug" });

			expect(res.status).toBeGreaterThanOrEqual(400);
		});
	});

	describe("GET /api/datasets/:id", () => {
		it("should return 404 for missing dataset", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
				.get("/api/datasets/nonexistent-id")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(404);
		});

		it("should return dataset by ID", async () => {
			if (!dbAvailable) return;
			// First create one
			const createRes = await request(BASE)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Get By ID Test",
					slug: `${TEST_PREFIX}-getbyid`,
					storageFormat: "CSV",
				});

			const datasetId = createRes.body.data.id;

			const res = await request(BASE)
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
			const createRes = await request(BASE)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Update Test",
					slug: `${TEST_PREFIX}-update`,
					storageFormat: "CSV",
				});

			const datasetId = createRes.body.data.id;

			const res = await request(BASE)
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
			const createRes = await request(BASE)
				.post("/api/datasets")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "Delete Test",
					slug: `${TEST_PREFIX}-delete`,
					storageFormat: "CSV",
				});

			const datasetId = createRes.body.data.id;

			const delRes = await request(BASE)
				.delete(`/api/datasets/${datasetId}`)
				.set("Authorization", `Bearer ${token}`);

			expect(delRes.status).toBe(200);
			expect(delRes.body.success).toBe(true);

			const getRes = await request(BASE)
				.get(`/api/datasets/${datasetId}`)
				.set("Authorization", `Bearer ${token}`);

			expect(getRes.status).toBe(404);
		});
	});
});
