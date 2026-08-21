/**
 * Cross-user access (IDOR) guards — round-106.
 *
 * Four mutation/read paths previously skipped ownership entirely, letting any
 * authenticated user act on other users' resources:
 *   - PATCH/DELETE /api/anomalies/:id — any user resolved/deleted any anomaly
 *   - POST /api/anomalies/bulk-resolve — empty body resolved EVERY unresolved
 *     anomaly in the database (global updateMany, no scope)
 *   - DELETE /api/models/:id/forecasts — any user wiped any model's forecasts
 *   - GET /api/timeseries/:id and /:id/data — series + points readable by id
 *     by users who cannot open the parent dataset
 *   - GET /api/datasets — listed every user's datasets (owner name/email)
 *
 * Each case: user B acting on user A's resource must fail with the same
 * status as a missing resource (404) or an explicit 403 where siblings use
 * one (models), and must not change the data; user A succeeds.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jwtUtils } from "@/lib/jwt";
import { createTestApp, getPrisma, requireDb } from "@/test/helpers/testApp";

let app: Express;
const prisma = getPrisma();
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let tokenA = "";
let tokenB = "";
let ids: {
	userA: string;
	userB: string;
	dataset: string;
	timeseries: string;
	anomaly: string;
	model: string;
};

describe("Cross-user ownership guards (IDOR)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("ownership-idor");

		const userA = await prisma.user.create({
			data: {
				email: `idor-a-${suffix}@test.local`,
				passwordHash: "x",
				name: "Owner A",
				role: "VIEWER",
			},
		});
		const userB = await prisma.user.create({
			data: {
				email: `idor-b-${suffix}@test.local`,
				passwordHash: "x",
				name: "Outsider B",
				role: "VIEWER",
			},
		});
		tokenA = jwtUtils.generateToken(userA.id);
		tokenB = jwtUtils.generateToken(userB.id);

		const dataset = await prisma.dataset.create({
			data: {
				name: `idor-ds-${suffix}`,
				slug: `idor-ds-${suffix}`,
				ownerId: userA.id,
				storageFormat: "TIMESERIES",
			},
		});
		const timeseries = await prisma.timeseries.create({
			data: {
				datasetId: dataset.id,
				name: `idor-ts-${suffix}`,
				slug: `idor-ts-${suffix}`,
				timezone: "UTC",
			},
		});
		const anomaly = await prisma.anomaly.create({
			data: {
				timeseriesId: timeseries.id,
				datapointId: null,
				severity: "MEDIUM",
				detectionMethod: "STATISTICAL",
				context: { z: 3.5 },
			},
		});
		const model = await prisma.forecastingModel.create({
			data: {
				timeseriesId: timeseries.id,
				trainedById: userA.id,
				algorithm: "ARIMA",
				hyperparameters: {},
			},
		});

		ids = {
			userA: userA.id,
			userB: userB.id,
			dataset: dataset.id,
			timeseries: timeseries.id,
			anomaly: anomaly.id,
			model: model.id,
		};
	});

	afterAll(async () => {
		// Dataset cascade removes timeseries/anomalies/models.
		await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB] } } }).catch(() => {});
	});

	describe("anomalies", () => {
		it("foreign PATCH /:id → 404 and does not modify", async () => {
			const res = await request(app)
				.patch(`/api/anomalies/${ids.anomaly}`)
				.set({ Authorization: `Bearer ${tokenB}` })
				.send({ isResolved: true });
			expect(res.status).toBe(404);

			const row = await prisma.anomaly.findUnique({ where: { id: ids.anomaly } });
			expect(row?.isResolved).toBe(false);
		});

		it("foreign DELETE /:id → 404 and deletes nothing", async () => {
			const res = await request(app)
				.delete(`/api/anomalies/${ids.anomaly}`)
				.set({ Authorization: `Bearer ${tokenB}` });
			expect(res.status).toBe(404);
			expect(await prisma.anomaly.findUnique({ where: { id: ids.anomaly } })).not.toBeNull();
		});

		it("foreign bulk-resolve with empty body resolves 0 (was: every anomaly in the DB)", async () => {
			const res = await request(app)
				.post("/api/anomalies/bulk-resolve")
				.set({ Authorization: `Bearer ${tokenB}` })
				.send({});
			expect(res.status).toBe(200);
			expect(res.body.data.count).toBe(0);

			const row = await prisma.anomaly.findUnique({ where: { id: ids.anomaly } });
			expect(row?.isResolved).toBe(false);
		});

		it("owner PATCH resolves the anomaly", async () => {
			const res = await request(app)
				.patch(`/api/anomalies/${ids.anomaly}`)
				.set({ Authorization: `Bearer ${tokenA}` })
				.send({ isResolved: true });
			expect(res.status).toBe(200);
			expect(res.body.data.anomaly.isResolved).toBe(true);
		});
	});

	describe("models", () => {
		it("foreign DELETE /:id/forecasts → 403 (sibling convention)", async () => {
			const res = await request(app)
				.delete(`/api/models/${ids.model}/forecasts`)
				.set({ Authorization: `Bearer ${tokenB}` });
			expect(res.status).toBe(403);
		});
	});

	describe("timeseries reads", () => {
		it("foreign GET /:id → 404 (was 200 with the full series)", async () => {
			const res = await request(app)
				.get(`/api/timeseries/${ids.timeseries}`)
				.set({ Authorization: `Bearer ${tokenB}` });
			expect(res.status).toBe(404);
		});

		it("foreign GET /:id/data → 404 (was 200 with datapoints)", async () => {
			const res = await request(app)
				.get(`/api/timeseries/${ids.timeseries}/data`)
				.set({ Authorization: `Bearer ${tokenB}` });
			expect(res.status).toBe(404);
		});

		it("owner GET /:id → 200", async () => {
			const res = await request(app)
				.get(`/api/timeseries/${ids.timeseries}`)
				.set({ Authorization: `Bearer ${tokenA}` });
			expect(res.status).toBe(200);
			expect(res.body.data.id).toBe(ids.timeseries);
		});
	});

	describe("datasets list", () => {
		it("lists only the caller's datasets (owner B sees none of A's)", async () => {
			const [resA, resB] = await Promise.all([
				request(app)
					.get("/api/datasets")
					.set({ Authorization: `Bearer ${tokenA}` }),
				request(app)
					.get("/api/datasets")
					.set({ Authorization: `Bearer ${tokenB}` }),
			]);

			expect(resA.status).toBe(200);
			expect(resB.status).toBe(200);
			const aIds = resA.body.data.map((d: { id: string }) => d.id);
			const bIds = resB.body.data.map((d: { id: string }) => d.id);
			expect(aIds).toContain(ids.dataset);
			expect(bIds).not.toContain(ids.dataset);
		});
	});
});
