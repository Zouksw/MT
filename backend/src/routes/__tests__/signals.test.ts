/**
 * Signals Route Integration Tests
 *
 * Drives the in-process Express app via supertest with real DB.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { redis } from "@/lib/redis";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

function authHeaders(t?: string) {
	return t ? { Authorization: `Bearer ${t}` } : {};
}

// The /:commodityId and /batch routes cache responses in Redis (cacheRoute).
// Without clearing, a prior (fixed) run's cached response masks a regression
// in a later (mutated) run — the test passes on stale cache. Clear the cache
// before authoritative-source regression assertions so the test exercises the
// live code path every time.
async function clearSignalsCache(): Promise<void> {
	try {
		const client = await redis();
		// cacheDecorator prefixes keys with "cache:"; signals:commodity is the
		// route's cache namespace. Clear the whole namespace (small set).
		for (const key of await client.keys("*signals:commodity*")) {
			await client.del(key);
		}
	} catch {
		// Redis optional in some test envs — cache miss just hits the handler.
	}
}

describe("Signals Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("signals");
		token = await getAdminToken(app);
	});

	describe("GET /api/signals/models", () => {
		it("should return model list", async () => {
			const res = await request(app).get("/api/signals/models").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.models)).toBe(true);
			expect(res.body.data.models.length).toBeGreaterThan(0);
		});

		it("should reject unauthenticated request", async () => {
			const res = await request(app).get("/api/signals/models");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/signals/models/accuracy", () => {
		it("should return accuracy data", async () => {
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
			const res = await request(app).get("/api/signals/commodities").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data)).toBe(true);
		});
	});

	describe("GET /api/signals/correlation", () => {
		it("should compute correlation between two commodities", async () => {
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

		// REGRESSION (round-67): brl_usd has a multi-source conflict —
		// exchange_rate_api writes the INVERTED value (~0.197, BRL→USD) and is
		// the most recently written source, while fred writes the correct ~5.0
		// (USD→BRL) and is the authoritative source. Without authoritative-
		// source filtering on the currentPrice lookup, the signal returns
		// currentPrice≈0.197 while the forecast/range is computed on fred's
		// ~5.0 scale — producing a nonsensical predictedChange (~2400).
		// The fix makes currentPrice read fred (~5.0). This test pins it.
		it("brl_usd currentPrice reads the authoritative source (fred ~5.0, not exchange_rate_api ~0.197)", async () => {
			await clearSignalsCache();
			const res = await request(app).get("/api/signals/brl_usd").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			const price = res.body.data.currentPrice;
			// fred scale (~5.0), NOT exchange_rate_api scale (~0.197).
			expect(price).toBeGreaterThan(4);
			expect(price).toBeLessThan(6);
		});

		// REGRESSION (round-67): the batch endpoint has the same conflict —
		// its latestPrice fetch must also apply authoritative-source resolution.
		it("POST /batch resolves brl_usd currentPrice via the authoritative source", async () => {
			await clearSignalsCache();
			const res = await request(app)
				.post("/api/signals/batch")
				.set(authHeaders(token))
				.send({ slugs: ["brl_usd"], horizon: 7 });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			const fc = res.body.data.forecasts.find((f: { slug: string }) => f.slug === "brl_usd");
			expect(fc).toBeDefined();
			expect(fc.ok).toBe(true);
			// currentPrice lives inside the generated forecast; the consensus
			// is built on fred's ~5.0 scale, so the range bounds are ~5.0
			// (not ~0.2). Sanity-check the upper bound is in the fred band.
			expect(fc.forecast.range.upper).toBeGreaterThan(4);
		});
	});

	describe("GET /api/signals/models/:modelId/accuracy (per-model)", () => {
		it("should return accuracy for a specific model", async () => {
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
