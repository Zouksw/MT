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

import { PrismaClient } from "@prisma/client";
import type { Express } from "express";

import { createApp } from "@/app";

// Integration tests rely on seeded data (admin user, commodities).
// The URL must follow DATABASE_URL so the in-process app (src/lib/database
// singleton, env-driven) and this helper share ONE database — CI exports
// mt_test; without this the helper silently pointed at mt_db while the app
// pointed elsewhere, and on CI (no mt_db) every requireDb suite died with
// "database mt_db does not exist". The local default is now also mt_test,
// and mt_db (production) is refused outright — see test-setup.ts.
const REAL_DB_URL =
	process.env.DATABASE_URL ?? "postgresql://mt_user:mt_password@localhost:5432/mt_test";
if (/\/mt_db(\?|$)/.test(REAL_DB_URL)) {
	throw new Error(
		`Refusing to run tests against the production database (${REAL_DB_URL}). Use mt_test (scripts/bootstrap-test-db.sh).`,
	);
}

let cachedPrisma: PrismaClient | null = null;

/**
 * Build an in-process Express app for `supertest(request(app))`. Each call
 * returns a fresh app instance; there is no shared port or listener.
 */
export function createTestApp(): Express {
	return createApp().app;
}

/**
 * A shared PrismaClient pointed at the seeded test database (mt_test).
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
 * Check whether the test PostgreSQL (mt_test) is reachable. In-process tests no
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
 * Fail-loud DB precondition for integration test suites.
 *
 * Call this inside a suite's `beforeAll`. If PostgreSQL (mt_db) is unreachable
 * the suite FAILS with a clear error instead of silently passing every case
 * via the old `if (!dbAvailable) return;` guard (which made every case a vacuous
 * green when the DB was down — a CI hazard: a broken DB looked healthy).
 *
 * The label identifies which suite failed, so the error names the file/feature:
 *   await requireDb("signals routes");
 *
 * This mirrors the existing fail-loud pattern in correlationAnalysis.test.ts
 * (beforeAll throws on unreachable infra). CI has postgres+redis provisioned
 * (ci.yml), so a real CI run exercises these suites; only a genuinely broken
 * environment goes red — which is the honest signal.
 */
export async function requireDb(label: string): Promise<void> {
	if (!(await isDbAvailable())) {
		throw new Error(
			`${label}: integration suite requires PostgreSQL (mt_db) to be reachable. ` +
				"Start the DB (docker-compose up) or run only unit tests. Aborting — a silent " +
				"skip would report false-green and mask the gap.",
		);
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
