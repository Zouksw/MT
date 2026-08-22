/**
 * AI tier-gate regression (round-104 / audit C6; contract updated round-119).
 *
 * Full-ensemble endpoints outside /api/inference previously carried only
 * `authenticate` — the gate now runs checkAIAccess (+ aiRateLimiter) on:
 *   GET  /api/signals/:commodityId   (ensemble consensus, cached 5 min)
 *   POST /api/signals/batch          (up to 50 ensembles per request)
 *   GET  /api/beef/forecasts         (one ensemble per forecastable cut)
 *   POST /api/inference/anomalies
 *
 * Round-119 contract: tier enforcement is DORMANT by default (registration
 * defaults to VIEWER and no upgrade path exists — PRODUCT-SPEC §九 defers
 * AI tiering), so a VIEWER passes the tier gate and proceeds to the
 * endpoint. With AI_TIER_ENFORCED=true the M7 gate fires: VIEWER gets the
 * upgrade 403 BEFORE any model call.
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
	delete process.env.AI_TIER_ENFORCED;
});

describe("AI tier gating — default: enforcement dormant, VIEWER passes the gate", () => {
	const auth = () => ({ Authorization: `Bearer ${viewerToken}` });

	test("GET /api/signals/:commodityId — not blocked by the tier gate for VIEWER", async () => {
		const res = await request(app).get("/api/signals/brl_usd").set(auth());
		// The gate must not 403/401 the VIEWER; whatever follows (200 with a
		// consensus, or a downstream error from a cold inference service) is
		// past the gate.
		expect([401, 403]).not.toContain(res.status);
	});

	test("GET /api/beef/forecasts — not blocked by the tier gate for VIEWER", async () => {
		const res = await request(app).get("/api/beef/forecasts").set(auth());
		expect([401, 403]).not.toContain(res.status);
	});

	test("unauthenticated stays 401 (gate ordering: auth before tier)", async () => {
		const res = await request(app).get("/api/signals/brl_usd");
		expect(res.status).toBe(401);
	});
});

describe("AI tier gating — AI_TIER_ENFORCED=true: the M7 gate fires", () => {
	const auth = () => ({ Authorization: `Bearer ${viewerToken}` });

	beforeAll(() => {
		process.env.AI_TIER_ENFORCED = "true";
	});
	afterAll(() => {
		delete process.env.AI_TIER_ENFORCED;
	});

	test("GET /api/signals/:commodityId → 403 for VIEWER", async () => {
		const res = await request(app).get("/api/signals/brl_usd").set(auth());
		expect(res.status).toBe(403);
		expect(res.body?.error?.message).toMatch(/Pro subscription/i);
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
});
