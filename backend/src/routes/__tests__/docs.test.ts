/**
 * Docs Route Tests
 *
 * The route is thin (swagger-ui-express middleware + raw spec JSON), but a
 * suite still guards two real failure modes: the mount disappearing from
 * app.ts, and swaggerSpec generation throwing at import time (it reflects
 * over route annotations). Since v3.3.0 batch 3 the surface is
 * AUTHENTICATED (D12): the spec maps the full endpoint surface, which is
 * reconnaissance value for anonymous crawlers and none for users.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

describe("Docs Routes", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("docs routes");
		adminToken = await getAdminToken(app);
	});

	it("GET /api/docs requires authentication (401 without token)", async () => {
		const res = await request(app).get("/api/docs/");

		expect(res.status).toBe(401);
	});

	it("GET /api/docs serves the Swagger UI (HTML) when authenticated", async () => {
		const res = await request(app)
			.get("/api/docs/")
			.set("Authorization", `Bearer ${adminToken}`)
			.expect("Content-Type", /html/);

		expect(res.status).toBe(200);
	});

	it("GET /api/docs/json is gated too and returns the spec when authenticated", async () => {
		const anon = await request(app).get("/api/docs/json");
		expect(anon.status).toBe(401);

		const res = await request(app)
			.get("/api/docs/json")
			.set("Authorization", `Bearer ${adminToken}`);

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty("openapi");
		expect(res.body.info).toHaveProperty("title");
		// The spec must describe at least one real path — a broken reflection
		// pass would silently yield an empty document.
		expect(Object.keys(res.body.paths ?? {}).length).toBeGreaterThan(0);
	});

	it("spec advertises an auth scheme (bearer for the JWT flow)", async () => {
		const res = await request(app)
			.get("/api/docs/json")
			.set("Authorization", `Bearer ${adminToken}`);

		expect(res.status).toBe(200);
		expect(res.body.components?.securitySchemes).toBeDefined();
	});
});
