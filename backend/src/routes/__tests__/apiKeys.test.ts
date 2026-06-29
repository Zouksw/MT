/**
 * API Keys Route Integration Tests
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

const TEST_PREFIX = `ak-${Date.now()}`;

let app: Express;
const prisma = getPrisma();
let dbAvailable = false;
let token: string;
let createdKeyId: string;

describe("API Keys Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	afterAll(async () => {
		if (!dbAvailable) return;
		try {
			await prisma.apiKey.deleteMany({
				where: { name: { startsWith: TEST_PREFIX } },
			});
		} catch {
			/* ignore cleanup */
		}
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("POST /api/api-keys", () => {
		it("should create an API key", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/api-keys")
				.set({ Authorization: `Bearer ${token}` })
				.send({ name: `${TEST_PREFIX}-key-1` });

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("id");
			expect(res.body.data).toHaveProperty("apiKey");
			expect(res.body.data.apiKey).toMatch(/^iotd_/);
			createdKeyId = res.body.data.id;
		});

		it("should reject without name", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/api-keys")
				.set({ Authorization: `Bearer ${token}` })
				.send({});

			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/api-keys", () => {
		it("should list API keys", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/api-keys")
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.apiKeys)).toBe(true);
		});
	});

	describe("DELETE /api/api-keys/:id/revoke", () => {
		it("should revoke the created key", async () => {
			if (!dbAvailable) return;
			if (!createdKeyId) return;
			const res = await request(app)
				.delete(`/api/api-keys/${createdKeyId}/revoke`)
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	describe("DELETE /api/api-keys/:id", () => {
		it("should delete the created key", async () => {
			if (!dbAvailable) return;
			if (!createdKeyId) return;
			const res = await request(app)
				.delete(`/api/api-keys/${createdKeyId}`)
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	it("should reject unauthenticated request", async () => {
		if (!dbAvailable) return;
		const res = await request(app).get("/api/api-keys");
		expect(res.status).toBe(401);
	});
});
