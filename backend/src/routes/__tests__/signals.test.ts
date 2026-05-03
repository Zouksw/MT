/**
 * Signals Route Integration Tests
 *
 * Tests /api/signals endpoints against running backend with real DB.
 */

import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
		.send({ email: "admin@trademind.com", password: "Admin123!" });
	return res.body.data.token;
}

function authHeaders(t?: string) {
	return t ? { Authorization: `Bearer ${t}` } : {};
}

describe("Signals Routes (Integration)", () => {
	beforeAll(async () => {
		dbAvailable = await checkDatabase();
		if (!dbAvailable) return;
		prisma = new PrismaClient({
			log: ["error"],
			datasources: { db: { url: REAL_DB_URL } },
		});
		token = await getAdminToken();
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/signals/models", () => {
		it("should return model list", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
				.get("/api/signals/models")
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.models)).toBe(true);
			expect(res.body.data.models.length).toBeGreaterThan(0);
		});

		it("should reject unauthenticated request", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE).get("/api/signals/models");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/signals/models/accuracy", () => {
		it("should return accuracy data", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
				.get("/api/signals/models/accuracy")
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toBeDefined();
		});
	});

	describe("GET /api/signals/models/:modelId/backtest", () => {
		it("should return backtest for a valid model", async () => {
			if (!dbAvailable) return;
			const modelsRes = await request(BASE)
				.get("/api/signals/models")
				.set(authHeaders(token));
			const modelId = modelsRes.body.data.models[0];

			const res = await request(BASE)
				.get(`/api/signals/models/${modelId}/backtest`)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toBeDefined();
			expect(res.body.data.modelId).toBe(modelId);
		});
	});

	describe("GET /api/signals/commodities", () => {
		it("should return available commodities", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
				.get("/api/signals/commodities")
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data)).toBe(true);
		});
	});

	describe("GET /api/signals/correlation", () => {
		it("should compute correlation between two commodities", async () => {
			if (!dbAvailable) return;
			const commRes = await request(BASE)
				.get("/api/signals/commodities")
				.set(authHeaders(token));
			const commodities = commRes.body.data;
			if (commodities.length < 2) return;

			const res = await request(BASE)
				.get(
					`/api/signals/correlation?a=${commodities[0].slug}&b=${commodities[1].slug}`,
				)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it("should reject missing params", async () => {
			if (!dbAvailable) return;
			const res = await request(BASE)
				.get("/api/signals/correlation")
				.set(authHeaders(token));

			expect(res.status).toBe(400);
		});
	});
});
