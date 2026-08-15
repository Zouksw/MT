/**
 * AI tier-gate regression (round-104 / audit C6).
 *
 * Full-ensemble endpoints outside /api/inference previously carried only
 * `authenticate` — a free-tier VIEWER blocked from POST /api/inference/predict
 * could run the identical (or heavier) inference through:
 *   GET  /api/signals/:commodityId   (ensemble consensus, cached 5 min)
 *   POST /api/signals/batch          (up to 50 ensembles per request)
 *   GET  /api/beef/forecasts         (one ensemble per forecastable cut)
 *   POST /api/inference/anomalies    (missing its aiRateLimiter sibling)
 * All four now run checkAIAccess (+ aiRateLimiter) — these tests pin the
 * 403 for VIEWER without touching the inference service (the gate fires
 * before any model call).
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { jwtUtils, prisma } from "@/lib";
import { createTestApp, requireDb } from "@/test/helpers/testApp";

let app: Express;
let viewerToken = "";
let viewerId = "";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("AI tier gating");
	const viewer = await prisma.user.create({
		data: {
			email: `viewer-gate-${stamp}@test`,
			name: "Viewer Gate",
			passwordHash: "test-hash-not-real",
			role: "VIEWER",
		},
	});
	viewerId = viewer.id;
	viewerToken = jwtUtils.generateToken(viewer.id);
});

afterAll(async () => {
	await prisma.user.deleteMany({ where: { id: viewerId } }).catch(() => {});
});

describe("AI tier gating — ensemble endpoints (audit C6)", () => {
	const auth = () => ({ Authorization: `Bearer ${viewerToken}` });

	test("GET /api/signals/:commodityId → 403 for VIEWER", async () => {
		const res = await request(app).get("/api/signals/brl_usd").set(auth());
		expect(res.status).toBe(403);
	});

	test("POST /api/signals/batch → 403 for VIEWER", async () => {
		const res = await request(app)
			.post("/api/signals/batch")
			.set(auth())
			.send({ slugs: ["brl_usd"] });
		expect(res.status).toBe(403);
	});

	test("GET /api/beef/forecasts → 403 for VIEWER", async () => {
		const res = await request(app).get("/api/beef/forecasts").set(auth());
		expect(res.status).toBe(403);
	});

	test("GET /api/beef/forecasts/:cutCode → 403 for VIEWER", async () => {
		const res = await request(app).get("/api/beef/forecasts/RIB").set(auth());
		expect(res.status).toBe(403);
	});

	test("POST /api/inference/anomalies → 403 for VIEWER", async () => {
		const res = await request(app)
			.post("/api/inference/anomalies")
			.set(auth())
			.send({ commodityId: "brl_usd" });
		expect(res.status).toBe(403);
	});

	test("unauthenticated stays 401 (gate ordering: auth before tier)", async () => {
		const res = await request(app).get("/api/signals/brl_usd");
		expect(res.status).toBe(401);
	});
});
