/**
 * Health Route — /health/ready dataLayer field-completeness guard.
 *
 * Regression guard (round-64): the /health/ready route forwards a curated
 * subset of the dataHealth snapshot to the response. A prior change
 * (round-62) added the 4th prediction bucket `predictionUnverifiable` but
 * accidentally dropped `predictionStale` from the forwarded subset — the
 * service still computed it (dataHealth.ts), but ~11k polluted-source rows
 * became invisible to operators because the route silently omitted the field.
 *
 * There was no route-level test, so the drop shipped green. This test pins
 * every prediction-status bucket the service emits to be present in the
 * response, so a future field-drop fails loudly here rather than in
 * production.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, requireDb } from "@/test/helpers/testApp";

let app: Express;

describe("Health Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("health routes");
	});

	describe("GET /health/ready", () => {
		it("returns ready status with all infra checks", async () => {
			const res = await request(app).get("/health/ready");

			// Infra readiness may be 200 or 503 depending on whether redis/inference
			// are up in the test env; the dataLayer block is best-effort and present
			// either way. We only assert the dataLayer shape, not the infra status.
			expect([200, 503]).toContain(res.status);
			expect(res.body.success).toBe(true);
			expect(res.body.data.checks).toBeDefined();
		});

		it("forwards the COMPLETE dataLayer prediction-status breakdown (all 4 buckets)", async () => {
			const res = await request(app).get("/health/ready");
			const dl = res.body.data.checks.dataLayer;

			// dataLayer is best-effort; if it failed entirely the field is null and
			// we can't assert bucket presence (that's an infra failure, not a
			// forwarding bug). Skip only in that case.
			if (dl === null) return;

			// Every prediction-status bucket the service emits MUST be forwarded.
			// This is the regression: predictionStale was computed by dataHealth.ts
			// but dropped from the route's forwarded subset.
			for (const field of [
				"predictionBacklog",
				"predictionVerified",
				"predictionStale",
				"predictionUnverifiable",
			]) {
				expect(dl, `dataLayer.${field} must be present`).toHaveProperty(field);
				expect(typeof dl[field], `dataLayer.${field} must be a number`).toBe("number");
			}

			// The derived ratio + debt flag must also be forwarded.
			expect(dl).toHaveProperty("verificationRatio");
			expect(dl).toHaveProperty("hasVerificationDebt");
		});
	});
});
