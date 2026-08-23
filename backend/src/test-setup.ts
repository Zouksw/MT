process.env.NODE_ENV = "test";
// Integration tests run the app in-process, so the app's own Prisma client
// (the @/lib singleton, which reads DATABASE_URL) must point at the seeded
// mt_test — the same database CI migrates+seeds before running the suite.
//
// This used to fall back to mt_db (production): a bare `pnpm test` then raced
// the live backend's schedulers and leaked prefixed fixture rows into
// production tables (2026-08-16 red run: prod market_news was empty and
// 35k due prediction_logs starved verifyDuePredictions' 5000-row batch, so
// two suites failed on data state, not code). Default to mt_test and refuse
// mt_db from ANY source (explicit env or .env leak) — fail loud, never test
// prod silently. Bootstrap/reset mt_test with scripts/bootstrap-test-db.sh.
process.env.DATABASE_URL =
	process.env.DATABASE_URL || "postgresql://mt_user:mt_password@localhost:5432/mt_test";
if (/\/mt_db(\?|$)/.test(process.env.DATABASE_URL)) {
	throw new Error(
		`Refusing to run tests against the production database (${process.env.DATABASE_URL}). ` +
			"Point DATABASE_URL at mt_test, or reset it with scripts/bootstrap-test-db.sh.",
	);
}
process.env.JWT_SECRET =
	process.env.JWT_SECRET || "test-secret-key-for-jwt-testing-purposes-only-32chars";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
process.env.SESSION_SECRET =
	process.env.SESSION_SECRET || "test-session-key-for-testing-purposes-only-32chars-min";
// Redis isolation (2026-08-23, round-122 batch 2): FORCE db1, unconditionally.
// Integration suites run the app in-process, so cacheRoute writes go to
// whatever REDIS_URL points at. With prod's db0 that means supertest
// responses get cached under PRODUCTION keys — the live public track-record
// endpoint once served a mt_test fixture row this way (test Redis ≠ test DB
// guard: the DB has refused mt_db since 2026-08-16, Redis had no such guard).
// db1 is never read by the production process, so test cache writes can
// never bleed into live responses. Mirrors the DB fail-loud philosophy:
// tests never share stateful infra with production, period.
process.env.REDIS_URL = "redis://localhost:6379/1";
process.env.INFERENCE_URL = process.env.INFERENCE_URL || "http://localhost:10810";
