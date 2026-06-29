/**
 * Auth Route Integration Tests
 *
 * Drives the in-process Express app via supertest (no running server needed).
 * Uses real PostgreSQL (seed data) + Redis. Creates test users with unique
 * prefixes and cleans up after. Skips automatically if the DB is unavailable.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	SEED_ADMIN,
	createTestApp,
	getPrisma,
	isDbAvailable,
} from "@/test/helpers/testApp";

const TEST_PREFIX = `auth-${Date.now()}`;

let app: Express;
let dbAvailable = false;
const prisma = getPrisma();

describe("Auth Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
	});

	afterAll(async () => {
		if (!dbAvailable) return;
		try {
			await prisma.user.deleteMany({
				where: { email: { startsWith: TEST_PREFIX } },
			});
		} catch {
			/* ignore */
		}
	});

	describe("POST /api/auth/register", () => {
		it("should register a new user with real DB and real bcrypt", async () => {
			if (!dbAvailable) return;
			const email = `${TEST_PREFIX}-new@test.com`;
			const res = await request(app).post("/api/auth/register").send({
				email,
				password: "SecurePass123!",
				name: "Integration Test User",
			});

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("token");
			expect(res.body.data).toHaveProperty("refreshToken");
			expect(res.body.data.user.email).toBe(email);
		});

		it("should reject duplicate email", async () => {
			if (!dbAvailable) return;
			const email = `${TEST_PREFIX}-dup@test.com`;
			// Register first
			await request(app)
				.post("/api/auth/register")
				.send({ email, password: "SecurePass123!", name: "Dup User" });

			// Try again with same email
			const res = await request(app)
				.post("/api/auth/register")
				.send({ email, password: "AnotherPass456!", name: "Dup User 2" });

			expect(res.status).toBe(409);
		});

		it("should reject invalid email", async () => {
			if (!dbAvailable) return;
			const res = await request(app).post("/api/auth/register").send({
				email: "not-an-email",
				password: "SecurePass123!",
				name: "Test",
			});

			expect(res.status).toBe(400);
		});

		it("should reject missing password", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/auth/register")
				.send({ email: `${TEST_PREFIX}-nopass@test.com`, name: "Test" });

			expect(res.status).toBe(400);
		});
	});

	describe("POST /api/auth/login", () => {
		it("should login admin with correct credentials", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/auth/login")
				.send({ email: SEED_ADMIN.email, password: SEED_ADMIN.password });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("token");
			expect(res.body.data).toHaveProperty("refreshToken");
		});

		it("should reject wrong password", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/auth/login")
				.send({ email: SEED_ADMIN.email, password: "WrongPassword123!" });

			expect(res.status).toBe(401);
			expect(res.body.success).toBe(false);
		});

		it("should reject non-existent user", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.post("/api/auth/login")
				.send({ email: "nonexistent@nowhere.com", password: "Whatever123!" });

			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/auth/me", () => {
		it("should return current user with valid token", async () => {
			if (!dbAvailable) return;
			const loginRes = await request(app)
				.post("/api/auth/login")
				.send({ email: SEED_ADMIN.email, password: SEED_ADMIN.password });

			const token = loginRes.body.data.token;

			const res = await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${token}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.user.email).toBe(SEED_ADMIN.email);
		});

		it("should reject request without token", async () => {
			if (!dbAvailable) return;
			const res = await request(app).get("/api/auth/me");
			expect(res.status).toBe(401);
		});

		it("should reject malformed JWT", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/auth/me")
				.set("Authorization", "Bearer invalid.jwt.token");

			expect(res.status).toBe(401);
		});
	});
});
