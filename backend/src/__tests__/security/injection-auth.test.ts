/**
 * Security Tests: Authentication & Authorization (application layer)
 *
 * This file exercises the REAL datasets route stack with a mocked auth
 * middleware + prisma, covering two application-layer security concerns:
 *   - Authentication Bypass: unauthenticated/malformed/wrong-scheme requests
 *     are rejected at the route boundary (401).
 *   - Privilege Escalation: a VIEWER cannot delete/update/import datasets they
 *     do not own (403) — the ownership gate enforced by datasetsRouter.
 *
 * SQL injection and XSS are NOT tested here. The backend has no application-
 * layer sanitizer/validator module (it relies entirely on Prisma's
 * parameterized queries for SQL safety, and stores XSS payloads as plain data
 * for the frontend to render safely). Testing Prisma's parameterization would
 * test a third-party guarantee, not this codebase — the previous SQLi/XSS
 * blocks here asserted objects the tests constructed themselves (tautological)
 * and were removed.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib", () => ({
	prisma: {
		user: { findUnique: vi.fn(), create: vi.fn() },
		dataset: {
			findMany: vi.fn().mockResolvedValue([]),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		organizations: { findFirst: vi.fn(), create: vi.fn() },
		$transaction: vi.fn((cb: (p: unknown) => unknown) => cb({})),
	},
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/utils/logger", () => ({
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
}));

vi.mock("@/middleware/cacheDecorator", () => ({
	cacheRoute: () => (_req: unknown, _res: unknown, next: () => void) => next(),
	invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/middleware/auth", () => ({
	authenticate: (req: Record<string, unknown>, _res: Record<string, unknown>, next: () => void) => {
		if (req.headers.authorization === "Bearer valid-admin-token") {
			req.user = { id: "admin-user-id", role: "admin" };
			req.userId = "admin-user-id";
			next();
		} else if (req.headers.authorization === "Bearer valid-viewer-token") {
			req.user = { id: "viewer-user-id", role: "VIEWER" };
			req.userId = "viewer-user-id";
			next();
		} else {
			_res.status(401).json({ success: false, error: { message: "Unauthorized" } });
		}
	},
}));

vi.mock("@/services/authLockout", () => ({
	checkAccountLockout: vi.fn().mockResolvedValue({ locked: false }),
	recordFailedLogin: vi.fn(),
	clearFailedLoginAttempts: vi.fn(),
}));

vi.mock("@/services/tokenBlacklist", () => ({
	blacklistToken: vi.fn(),
	isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

import { prisma } from "@/lib";
import { datasetsRouter } from "@/routes/datasets";

/**
 * Authentication Bypass Prevention Tests
 *
 * Verify that all authentication edge cases are handled.
 */
describe("Security: Authentication Bypass", () => {
	let app: express.Application;

	beforeEach(() => {
		app = express();
		app.use(express.json());
		app.use("/datasets", datasetsRouter);
		vi.clearAllMocks();
	});

	test("should reject request without token", async () => {
		const response = await request(app).get("/datasets");
		expect(response.status).toBe(401);
	});

	test("should reject request with malformed token", async () => {
		const response = await request(app)
			.get("/datasets")
			.set("Authorization", "Bearer not-a-valid-jwt");
		expect(response.status).toBe(401);
	});

	test("should reject request with empty token", async () => {
		const response = await request(app).get("/datasets").set("Authorization", "Bearer ");
		expect(response.status).toBe(401);
	});

	test("should reject request with wrong auth scheme", async () => {
		const response = await request(app).get("/datasets").set("Authorization", "Basic dXNlcjpwYXNz");
		expect(response.status).toBe(401);
	});
});

/**
 * Privilege Escalation Prevention Tests
 *
 * Verify that VIEWER users cannot perform owner-only operations.
 */
describe("Security: Privilege Escalation", () => {
	let app: express.Application;

	beforeEach(() => {
		app = express();
		app.use(express.json());
		app.use("/datasets", datasetsRouter);
		vi.clearAllMocks();
	});

	test("VIEWER cannot delete datasets they do not own", async () => {
		(prisma.dataset.findUnique as vi.Mock).mockResolvedValue({
			id: "ds-1",
			ownerId: "admin-user-id",
			owner: { id: "admin-user-id", name: "Admin", email: "admin@example.com" },
		});

		const response = await request(app)
			.delete("/datasets/ds-1")
			.set("Authorization", "Bearer valid-viewer-token");
		expect(response.status).toBe(403);
	});

	test("VIEWER cannot update datasets they do not own", async () => {
		(prisma.dataset.findUnique as vi.Mock).mockResolvedValue({
			id: "ds-1",
			ownerId: "admin-user-id",
			owner: { id: "admin-user-id", name: "Admin", email: "admin@example.com" },
		});

		const response = await request(app)
			.patch("/datasets/ds-1")
			.set("Authorization", "Bearer valid-viewer-token")
			.send({ name: "Hacked" });
		expect(response.status).toBe(403);
	});

	test("VIEWER cannot import data to datasets they do not own", async () => {
		(prisma.dataset.findUnique as vi.Mock).mockResolvedValue({
			id: "ds-1",
			ownerId: "admin-user-id",
		});

		const response = await request(app)
			.post("/datasets/ds-1/import")
			.set("Authorization", "Bearer valid-viewer-token")
			.send({ format: "csv", data: "timestamp,value\n2024-01-01,1" });
		expect(response.status).toBe(403);
	});
});
