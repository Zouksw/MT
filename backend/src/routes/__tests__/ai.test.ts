/**
 * Signals/AI Route Integration Tests
 *
 * Drives the in-process Express app via supertest (no running server needed).
 * Verifies model listing, signal generation, accuracy, and correlation.
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

describe("Signals/AI Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		dbAvailable = await isDbAvailable();
		if (!dbAvailable) return;
		token = await getAdminToken(app);
	});

	beforeEach(() => {
		if (!dbAvailable) return;
	});

	it("should return real model list (7 models)", async () => {
		if (!dbAvailable) return;
		const res = await request(app)
			.get("/api/signals/models")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.models.length).toBe(7);
		expect(res.body.data.count).toBe(7);

		// Models are string IDs (e.g. "arima", "holtwinters")
		expect(typeof res.body.data.models[0]).toBe("string");
	});

	it("should return accuracy data from real MAPE tracking", async () => {
		if (!dbAvailable) return;
		const res = await request(app)
			.get("/api/signals/models/accuracy")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("accuracy");
		expect(res.body.data).toHaveProperty("days");
	});

	it("should generate real signal for a commodity", async () => {
		if (!dbAvailable) return;
		const res = await request(app)
			.get(
				"/api/signals/wheat_cme?timeseriesPath=root.trading.wheat_cme.price&horizon=10",
			)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("type");
		expect(["BUY", "SELL", "HOLD"]).toContain(res.body.data.type);
		expect(res.body.data).toHaveProperty("confidence");
		expect(res.body.data).toHaveProperty("individualSignals");
		expect(res.body.data.individualSignals).toHaveLength(7);
	});

	it("should return model accuracy for specific model", async () => {
		if (!dbAvailable) return;
		const modelsRes = await request(app)
			.get("/api/signals/models")
			.set("Authorization", `Bearer ${token}`);

		const modelId = modelsRes.body.data.models[0];

		const res = await request(app)
			.get(`/api/signals/models/${modelId}/accuracy`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
	});

	it("should return correlation matrix", async () => {
		if (!dbAvailable) return;
		const res = await request(app)
			.get(
				"/api/signals/correlation/matrix?commodities=wheat_cme,corn_cme,gold_cme&window=30",
			)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
	});

	it("should return backtest results", async () => {
		if (!dbAvailable) return;
		const modelsRes = await request(app)
			.get("/api/signals/models")
			.set("Authorization", `Bearer ${token}`);

		const modelId = modelsRes.body.data.models[0];

		const res = await request(app)
			.get(`/api/signals/models/${modelId}/backtest`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
	});

	it("should return predictions with pagination", async () => {
		if (!dbAvailable) return;
		const modelsRes = await request(app)
			.get("/api/signals/models")
			.set("Authorization", `Bearer ${token}`);

		const modelId = modelsRes.body.data.models[0];

		const res = await request(app)
			.get(`/api/signals/models/${modelId}/predictions?limit=10`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("predictions");
		expect(res.body.data).toHaveProperty("total");
	});
});
