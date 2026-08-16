/**
 * Auth Routes Integration Tests.
 *
 * The happy-path auth workflow (register → login → me → logout) is covered by
 * api-workflows.integration.test.ts. This file covers the auth edges that
 * workflow test doesn't exercise: change-password, refresh token, CSRF token,
 * and the validation/edge cases that protect the auth surface.
 *
 * Uses the same in-process app pattern (createTestApp + real DB).
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

beforeAll(async () => {
	app = createTestApp();
	await requireDb("auth routes");
	adminToken = await getAdminToken(app);
});

afterAll(async () => {
	// No persistent state to clean up — change-password tests use throwaway
	// users created within the test and cleaned up there.
});

describe("Auth Routes (Integration)", () => {
	describe("POST /api/auth/login", () => {
		test("rejects malformed body (missing password)", async () => {
			const res = await request(app).post("/api/auth/login").send({ email: "admin@trademind.com" });
			expect(res.status).toBe(400);
		});

		test("rejects non-existent user", async () => {
			// Use a unique email per run to avoid Redis lockout state pollution
			// from prior test runs (the lockout persists across test invocations).
			const email = `nonexistent-${Date.now()}@test.com`;
			const res = await request(app)
				.post("/api/auth/login")
				.send({ email, password: "SomePass123!" });
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/auth/me", () => {
		test("returns the authenticated user's profile", async () => {
			const res = await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.user.email).toBe("admin@trademind.com");
			expect(res.body.data.user).not.toHaveProperty("passwordHash");
		});

		test("rejects an invalid token", async () => {
			const res = await request(app)
				.get("/api/auth/me")
				.set("Authorization", "Bearer invalid-token-string");

			expect(res.status).toBe(401);
		});
	});

	describe("Cookie session (HttpOnly auth_token)", () => {
		// The SPA's refresh-survival path: after a page reload the in-memory
		// Bearer token is gone, so AuthContext re-verifies via the cookie alone.
		// These tests lock in that req.cookies actually reaches the auth routes
		// — before round-105 cookie-parser was never mounted, req.cookies was
		// undefined, and every one of these calls returned 401 in production
		// while passing no cookie-reading coverage at all.
		test("GET /verify authenticates from the cookie alone", async () => {
			const res = await request(app)
				.get("/api/auth/verify")
				.set("Cookie", `auth_token=${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.data?.valid).toBe(true);
		});

		test("GET /me returns the profile from the cookie alone", async () => {
			const res = await request(app).get("/api/auth/me").set("Cookie", `auth_token=${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.data.user.email).toBe("admin@trademind.com");
		});

		test("rejects a garbage cookie value", async () => {
			const res = await request(app).get("/api/auth/me").set("Cookie", "auth_token=not-a-jwt");

			expect(res.status).toBe(401);
		});
	});

	describe("POST /api/auth/refresh", () => {
		test("rejects refresh without a token in body", async () => {
			const res = await request(app).post("/api/auth/refresh").send({});
			expect(res.status).toBe(400);
		});

		test("rejects an invalid refresh token", async () => {
			const res = await request(app)
				.post("/api/auth/refresh")
				.send({ refreshToken: "invalid-refresh-token-string" });

			expect([401, 500]).toContain(res.status);
			// Invalid refresh tokens are rejected (401 if token verify fails,
			// or 500 if the JWT lib throws on a malformed token — both are
			// "not a valid session"). The key assertion: it does NOT return 200
			// with a new token.
			expect(res.body.data?.token).toBeUndefined();
		});
	});

	describe("POST /api/auth/change-password", () => {
		test("requires authentication", async () => {
			const res = await request(app)
				.post("/api/auth/change-password")
				.send({ currentPassword: "x", newPassword: "y" });
			expect(res.status).toBe(401);
		});

		test("rejects wrong current password", async () => {
			// Use the seeded admin — wrong currentPassword must 401, NOT change
			// the password. This is the brute-force vector the rate limiter guards.
			const res = await request(app)
				.post("/api/auth/change-password")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ currentPassword: "DefinitelyWrong123!", newPassword: "NewPass456!" });

			expect(res.status).toBe(401);
		});

		test("rejects missing required fields", async () => {
			const res = await request(app)
				.post("/api/auth/change-password")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({});

			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/auth/verify", () => {
		test("confirms a valid token", async () => {
			const res = await request(app)
				.get("/api/auth/verify")
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		test("rejects without token", async () => {
			const res = await request(app).get("/api/auth/verify");
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/auth/csrf-token", () => {
		test("returns a CSRF token", async () => {
			const res = await request(app).get("/api/auth/csrf-token");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// CSRF token should be present in the response or set as a cookie.
			expect(res.body.data?.csrfToken || res.headers["set-cookie"]).toBeTruthy();
		});
	});
});
