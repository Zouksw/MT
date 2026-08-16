/**
 * /api/inference/models status honesty (round-106).
 *
 * When the inference service is unreachable, the listing used to report
 * every model as status:"available" and /models/:id answered "available"
 * for any valid id without probing anything — fabricated availability
 * (the /train endpoint was retired for exactly this class of fabrication).
 * Both must report "unknown" when nothing can be probed.
 */

import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

describe("GET /api/inference/models — status honesty when service unreachable", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("inference-models-status");
		token = await getAdminToken(app);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("lists status 'unknown' (never 'available') when the service is down", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

		const res = await request(app)
			.get("/api/inference/models")
			.set({ Authorization: `Bearer ${token}` });

		expect(res.status).toBe(200);
		expect(res.body.models.length).toBeGreaterThan(0);
		for (const m of res.body.models) {
			expect(m.status).toBe("unknown");
		}
	});

	it("/models/:id reports 'unknown' when the probe fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

		const res = await request(app)
			.get("/api/inference/models/chronos_tiny")
			.set({ Authorization: `Bearer ${token}` });

		expect(res.status).toBe(200);
		expect(res.body.status).toBe("unknown");
	});
});
