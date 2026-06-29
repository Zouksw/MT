/**
 * Signals Route Integration Tests
 *
 * Drives the in-process Express app via supertest with real DB.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import {
	createTestApp,
	getAdminToken,
	isDbAvailable,
} from "@/test/helpers/testApp";

let app: Express;
let dbAvailable = false;
let token: string;

function authHeaders(t?: string) {
	return t ? { Authorization: `Bearer ${t}` } : {};
}

describe("Signals Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	describe("GET /api/signals/models", () => {
		it("should return model list", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/signals/models")
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.models)).toBe(true);
			expect(res.body.data.models.length).toBeGreaterThan(0);
		});

		it("should reject unauthenticated request", async () => {
			if (!dbAvailable) return;
			const res = await request(app).get("/api/signals/models");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/signals/models/accuracy", () => {
		it("should return accuracy data", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
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
			const modelsRes = await request(app)
				.get("/api/signals/models")
				.set(authHeaders(token));
			const modelId = modelsRes.body.data.models[0];

			const res = await request(app)
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
			const res = await request(app)
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
			const commRes = await request(app)
				.get("/api/signals/commodities")
				.set(authHeaders(token));
			const commodities = commRes.body.data;
			if (commodities.length < 2) return;

			const res = await request(app)
				.get(
					`/api/signals/correlation?a=${commodities[0].slug}&b=${commodities[1].slug}`,
				)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it("should reject missing params", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/signals/correlation")
				.set(authHeaders(token));

			expect(res.status).toBe(400);
		});
	});
});
