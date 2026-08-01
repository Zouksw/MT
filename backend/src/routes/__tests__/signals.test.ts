/**
 * Signals Route Integration Tests
 *
 * Drives the in-process Express app via supertest with real DB.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, isDbAvailable } from "@/test/helpers/testApp";

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
			const res = await request(app).get("/api/signals/models").set(authHeaders(token));

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
			const res = await request(app).get("/api/signals/models/accuracy").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toBeDefined();
		});

		// REGRESSION: the comparison page needs freshness + role metadata to
		// present MAPE honestly (sample-size gating, primary/baseline split).
		// These fields are forwarded by getAllModelAccuracy; the route must not
		// strip them. chronos_* rows are isPrimary=true.
		it("forwards lastVerifiedAt + isPrimary fields per model row", async () => {
			if (!dbAvailable) return;
			const res = await request(app).get("/api/signals/models/accuracy").set(authHeaders(token));

			expect(res.status).toBe(200);
			const rows = res.body.data.accuracy ?? res.body.data;
			expect(Array.isArray(rows)).toBe(true);
			expect(rows.length).toBeGreaterThan(0);
			for (const row of rows) {
				expect(row).toHaveProperty("lastVerifiedAt");
				expect(row).toHaveProperty("isPrimary");
				expect(typeof row.isPrimary).toBe("boolean");
			}
			const chronos = rows.filter((r: { modelId: string }) => r.modelId.startsWith("chronos_"));
			expect(chronos.length).toBeGreaterThan(0);
			expect(chronos.every((r: { isPrimary: boolean }) => r.isPrimary === true)).toBe(true);
		});
	});

	describe("GET /api/signals/models/:modelId/backtest", () => {
		it("should return backtest for a valid model", async () => {
			if (!dbAvailable) return;
			const modelsRes = await request(app).get("/api/signals/models").set(authHeaders(token));
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
			const res = await request(app).get("/api/signals/commodities").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data)).toBe(true);
		});
	});

	describe("GET /api/signals/correlation", () => {
		it("should compute correlation between two commodities", async () => {
			if (!dbAvailable) return;
			const commRes = await request(app).get("/api/signals/commodities").set(authHeaders(token));
			const commodities = commRes.body.data;
			if (commodities.length < 2) return;

			const res = await request(app)
				.get(`/api/signals/correlation?a=${commodities[0].slug}&b=${commodities[1].slug}`)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it("should reject missing params", async () => {
			if (!dbAvailable) return;
			const res = await request(app).get("/api/signals/correlation").set(authHeaders(token));

			expect(res.status).toBe(400);
		});
	});

	// ─── ai-specific endpoints (migrated from the removed ai.test.ts) ──────
	// ai.test.ts overlapped this file on model-list / accuracy / backtest /
	// correlation (all already covered above). These three cases are the ones
	// ai.test.ts uniquely covered: per-commodity signal generation, per-model
	// accuracy, and the predictions pagination endpoint. Migrated here so a
	// single file owns the whole /api/signals surface (no split coverage).
	describe("GET /api/signals/:commodity (per-commodity signal generation)", () => {
		it("should generate a real signal for a commodity", async () => {
			if (!dbAvailable) return;
			const res = await request(app)
				.get("/api/signals/wheat_cme?timeseriesPath=root.trading.wheat_cme.price&horizon=10")
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("direction");
			expect(["up", "down", "flat"]).toContain(res.body.data.direction);
			expect(res.body.data).toHaveProperty("confidence");
			expect(res.body.data).toHaveProperty("individualForecasts");
			expect(res.body.data.individualForecasts).toHaveLength(3);
		});
	});

	describe("GET /api/signals/models/:modelId/accuracy (per-model)", () => {
		it("should return accuracy for a specific model", async () => {
			if (!dbAvailable) return;
			const modelsRes = await request(app).get("/api/signals/models").set(authHeaders(token));
			const modelId = modelsRes.body.data.models[0];

			const res = await request(app)
				.get(`/api/signals/models/${modelId}/accuracy`)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});

	describe("GET /api/signals/models/:modelId/predictions", () => {
		it("should return predictions with pagination", async () => {
			if (!dbAvailable) return;
			const modelsRes = await request(app).get("/api/signals/models").set(authHeaders(token));
			const modelId = modelsRes.body.data.models[0];

			const res = await request(app)
				.get(`/api/signals/models/${modelId}/predictions?limit=10`)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("predictions");
			expect(res.body.data).toHaveProperty("total");
		});
	});
});
