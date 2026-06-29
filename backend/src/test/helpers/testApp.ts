/**
 * In-process test app helper.
 *
 * Replaces the old pattern of integration tests pointing `supertest` at
 * `http://localhost:8000` (a running production backend), which shared Redis
 * state with the rate limiter / auth-lockout and produced false 429 failures.
 *
 * Tests now call `createTestApp()` to get a fresh in-process Express instance
 * via `createApp()` (no listener, no side effects) and drive it with
 * `request(app)`. The global rate limiter is skipped outside
 * production/staging, so in-process tests under NODE_ENV=test never hit 429.
 */

import type { Express } from "express";
import { PrismaClient } from "@prisma/client";

import { createApp } from "@/app";

// Integration tests rely on seeded data (admin user, commodities) in mt_db.
const REAL_DB_URL = "postgresql://mt_user:mt_password@localhost:5432/mt_db";

let cachedPrisma: PrismaClient | null = null;

/**
 * Build an in-process Express app for `supertest(request(app))`. Each call
 * returns a fresh app instance; there is no shared port or listener.
 */
export function createTestApp(): Express {
	return createApp().app;
}

/**
 * A shared PrismaClient pointed at the real mt_db (where seed data lives).
 * Reused across suites to avoid spawning a client per test. Integration tests
 * need the seed data (admin@trademind.com, wheat_cme, etc.).
 */
export function getPrisma(): PrismaClient {
	if (!cachedPrisma) {
		cachedPrisma = new PrismaClient({
			log: ["error"],
			datasources: { db: { url: REAL_DB_URL } },
		});
	}
	return cachedPrisma;
}

/**
 * Check whether the real PostgreSQL (mt_db) is reachable. In-process tests no
 * longer need to probe an HTTP server, so this only verifies DB connectivity.
 */
export async function isDbAvailable(): Promise<boolean> {
	try {
		const prisma = getPrisma();
		await prisma.$connect();
		await prisma.$executeRaw`SELECT 1`;
		return true;
	} catch {
		return false;
	}
}

/**
 * The admin credentials seeded by prisma/seed.ts — used by integration tests
 * that need an authenticated token for protected endpoints.
 */
export const SEED_ADMIN = {
	email: "admin@trademind.com",
	password: "Admin123!",
} as const;

/**
 * Log in as the seeded admin against an in-process app and return the JWT.
 * Mirrors the per-suite `getAdminToken()` helpers that were duplicated across
 * every integration test file.
 */
export async function getAdminToken(app: Express): Promise<string> {
	// Lazy import to avoid pulling supertest into non-test bundles.
	const { default: request } = await import("supertest");
	const res = await request(app)
		.post("/api/auth/login")
		.send({ email: SEED_ADMIN.email, password: SEED_ADMIN.password });
	return res.body.data.token;
}
