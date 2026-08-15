/**
 * Docs Route Tests
 *
 * The route is thin (swagger-ui-express middleware + raw spec JSON), but a
 * suite still guards two real failure modes: the mount disappearing from
 * app.ts, and swaggerSpec generation throwing at import time (it reflects
 * over route annotations). DEVELOPMENT-PLAN D2 evaluated simply documenting
 * a skip; a 3-case suite is cheaper than the argument and matches the
 * fail-loud route-suite pattern used everywhere else.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "@/test/helpers/testApp";

let app: Express;

describe("Docs Routes", () => {
	beforeAll(() => {
		app = createTestApp();
	});

	it("GET /api/docs serves the Swagger UI (HTML, no auth gate)", async () => {
		const res = await request(app).get("/api/docs/").expect("Content-Type", /html/);

		expect(res.status).toBe(200);
	});

	it("GET /api/docs/json returns the raw OpenAPI spec", async () => {
		const res = await request(app).get("/api/docs/json");

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty("openapi");
		expect(res.body.info).toHaveProperty("title");
		// The spec must describe at least one real path — a broken reflection
		// pass would silently yield an empty document.
		expect(Object.keys(res.body.paths ?? {}).length).toBeGreaterThan(0);
	});

	it("spec advertises an auth scheme (bearer for the JWT flow)", async () => {
		const res = await request(app).get("/api/docs/json");

		expect(res.status).toBe(200);
		expect(res.body.components?.securitySchemes).toBeDefined();
	});
});
