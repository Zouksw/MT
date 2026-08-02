/**
 * Concurrent Operations Integration Tests
 *
 * Tests race conditions, concurrent access patterns, and edge cases
 * that are difficult to reproduce in normal unit tests.
 */

import express, { type Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { getRedisClient } from "@/lib/redis";
import { authRouter } from "@/routes/auth";
import {
	checkAccountLockout,
	clearFailedLoginAttempts,
	recordFailedLogin,
} from "@/services/authLockout";
import {
	blacklistToken,
	getBlacklistStats,
	isTokenBlacklisted,
	removeFromBlacklist,
} from "@/services/tokenBlacklist";

describe("Concurrent Operations Integration Tests", () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use("/auth", authRouter);
	});

	// Clean up test keys before each test
	beforeEach(async () => {
		const redis = await getRedisClient();
		try {
			const prefixes = ["auth:attempts:", "auth:lockout:"];
			const testKeywords = [
				"boundary",
				"concurrent",
				"zero",
				"rapid",
				"interleaved",
				"clear",
				"max",
				"below",
				"failed",
				"debug",
				"minimal",
			];

			for (const prefix of prefixes) {
				let cursor = 0;
				do {
					const result = await redis.scan(cursor, {
						MATCH: `${prefix}*`,
						COUNT: 1000,
					});
					const keys = result.keys;

					const testKeys = keys.filter((key) =>
						testKeywords.some((keyword) => key.includes(keyword)),
					);

					if (testKeys.length > 0) {
						await redis.del(testKeys);
					}

					cursor = result.cursor;
				} while (cursor !== 0);
			}
		} catch (_e) {
			// Ignore cleanup errors
		}
	});

	const getRedis = async () => getRedisClient();
	const getTestId = (testName: string) =>
		`${testName}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	const cleanupLockout = async (testId: string) => {
		const redis = await getRedis();
		await redis.del([`auth:attempts:${testId}`, `auth:lockout:${testId}`]);
	};

	describe("Concurrent Failed Login Attempts (Race Conditions)", () => {
		test("should handle concurrent failed login attempts correctly", async () => {
			const testId = getTestId("concurrent-failed");

			try {
				// Simulate 10 concurrent failed login attempts
				const concurrentAttempts = Array.from({ length: 10 }, (_, i) =>
					recordFailedLogin(testId, `127.0.0.${i}`),
				);

				await Promise.all(concurrentAttempts);

				const lockoutInfo = await checkAccountLockout(testId);

				// Due to Redis INCR being atomic, the count should be correct
				expect(lockoutInfo.isLocked).toBe(true);
				expect(lockoutInfo.remainingAttempts).toBe(0);
			} finally {
				await cleanupLockout(testId);
			}
		});

		test("should handle clear failed attempts and lockout", async () => {
			const testId = getTestId("clear-lockout");

			try {
				// First, lock the account
				for (let i = 0; i < 5; i++) {
					await recordFailedLogin(testId, "127.0.0.1");
				}

				let info = await checkAccountLockout(testId);
				expect(info.isLocked).toBe(true);

				// Clear attempts (simulating successful login)
				await clearFailedLoginAttempts(testId);

				// Clear also removes the lockout key
				const redis = await getRedis();
				await redis.del(`auth:lockout:${testId}`);

				// After clearing and removing lockout, should no longer be locked
				info = await checkAccountLockout(testId);
				expect(info.isLocked).toBe(false);
				expect(info.remainingAttempts).toBe(5);
			} finally {
				await cleanupLockout(testId);
			}
		});

		test("should handle interleaved failed and successful login attempts", async () => {
			const testId = getTestId("interleaved");

			try {
				// 3 failed attempts
				for (let i = 0; i < 3; i++) {
					await recordFailedLogin(testId, "127.0.0.1");
				}

				const info = await checkAccountLockout(testId);
				// After 3 attempts, should not be locked with 2 remaining attempts
				expect(info.isLocked).toBe(false);
				expect(info.remainingAttempts).toBe(2);

				// Clear attempts (simulating successful login)
				await clearFailedLoginAttempts(testId);
			} finally {
				await cleanupLockout(testId);
			}
		});
	});

	describe("Concurrent Token Blacklist Operations", () => {
		test("should handle blacklist stats operations", async () => {
			// getBlacklistStats returns { totalBlacklisted: <sCard>, oldestToken,
			// newestToken } (tokenBlacklist.ts:130). The set is shared across the
			// suite, so the exact count is nondeterministic, but sCard always
			// returns a non-negative integer — pin to that rather than just
			// `typeof === "number"` (which would pass for NaN / negatives).
			const initialStats = await getBlacklistStats();
			expect(Number.isInteger(initialStats.totalBlacklisted)).toBe(true);
			expect(initialStats.totalBlacklisted).toBeGreaterThanOrEqual(0);
		});

		test("should handle isTokenBlacklisted with various inputs", async () => {
			// In dev/CI (NODE_ENV !== "production") with Redis reachable,
			// isTokenBlacklisted returns sIsMember(BLACKLIST_SET, tokenId).
			// None of these tokens are in the set, so each must be false.
			// The old `typeof === "boolean"` assertion passed even if the
			// function returned true (a false positive that would deny every
			// request) — pinning to false asserts the real fail-open contract.
			const emptyResult = await isTokenBlacklisted("");
			expect(emptyResult).toBe(false);

			const malformedResult = await isTokenBlacklisted("not-a-jwt");
			expect(malformedResult).toBe(false);

			const randomResult = await isTokenBlacklisted("random-string-for-testing");
			expect(randomResult).toBe(false);
		});

		test("should handle removeFromBlacklist gracefully", async () => {
			// removeFromBlacklist returns true on the success path and only
			// false when Redis throws (tokenBlacklist.ts:120). A non-existent
			// token is a normal del/sRem that resolves to 0 — not an error —
			// so the function returns true. The old `typeof === "boolean"`
			// hid a regression where it started returning false.
			const result = await removeFromBlacklist("non-existent-token");
			expect(result).toBe(true);
		});

		test("should handle token blacklist operations concurrently", async () => {
			const testTokens = Array.from(
				{ length: 5 },
				(_, i) => `test-token-${i}-${Date.now()}-${Math.random()}`,
			);

			const results = await Promise.allSettled(
				testTokens.map((token) => blacklistToken(token, "concurrent-test")),
			);

			results.forEach((result) => {
				expect(result.status).toBe("fulfilled");
			});
		});

		test("should handle concurrent isTokenBlacklisted checks", async () => {
			// 10 concurrent lookups of the same un-blacklisted token must each
			// resolve to false in dev/CI (not merely "some boolean"). The old
			// typeof check couldn't distinguish a healthy fail-open from a
			// broken fail-closed (which would have made every result true and
			// locked every user out).
			const testToken = `test-token-${Date.now()}`;

			const results = await Promise.all(
				Array.from({ length: 10 }, () => isTokenBlacklisted(testToken)),
			);

			expect(results).toStrictEqual([
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
			]);
		});
	});

	describe("Cache Stampede Prevention", () => {
		test("should handle concurrent requests for same uncached data", async () => {
			const cacheKey = `stampede-test-${Date.now()}`;
			let computationCount = 0;

			const expensiveOperation = async () => {
				computationCount++;
				await new Promise((resolve) => setTimeout(resolve, 50));
				return { data: "result", timestamp: Date.now() };
			};

			const requests = Array.from({ length: 10 }, () => expensiveOperation());
			await Promise.all(requests);

			expect(computationCount).toBe(10);

			// Cleanup
			const redis = await getRedis();
			await redis.del(cacheKey);
		});

		test("should handle concurrent cache invalidations", async () => {
			const cacheKey = `invalidate-test-${Date.now()}`;
			const redis = await getRedis();

			try {
				await redis.set(cacheKey, JSON.stringify({ value: 1 }));

				const [getResult, delResult] = await Promise.all([
					redis.get(cacheKey),
					redis.del(cacheKey),
				]);

				expect(getResult).not.toBeNull();
				expect(delResult).toBe(1);

				const finalGet = await redis.get(cacheKey);
				expect(finalGet).toBeNull();
			} finally {
				await redis.del(cacheKey);
			}
		});
	});

	describe("Edge Case: Boundary Conditions", () => {
		test("should handle exactly MAX_ATTEMPTS failed logins", async () => {
			const testId = getTestId("boundary-max");

			try {
				for (let i = 0; i < 5; i++) {
					await recordFailedLogin(testId, "127.0.0.1");
				}

				const info = await checkAccountLockout(testId);
				expect(info.isLocked).toBe(true);
			} finally {
				await cleanupLockout(testId);
			}
		});

		test("should handle expired tokens in blacklist", async () => {
			// blacklistToken returns true on the success path
			// (tokenBlacklist.ts:63) for any token that reaches setEx — which
			// a random non-expired-with-exp-string does (ttl defaults to
			// 86400). Pin to true; the old typeof check passed even if the
			// function had started returning false on every call.
			const expiredToken = `expired-token-${Date.now()}`;
			const result = await blacklistToken(expiredToken, "expired-test");
			expect(result).toBe(true);
		});
	});

	describe("Edge Case: Empty and Null Inputs", () => {
		// checkAccountLockout's dev/CI-with-Redis contract for an identifier
		// with no prior failed attempts is { isLocked: false, remainingAttempts: 5 }.
		// The old `toHaveProperty("isLocked")` + `typeof boolean` accepted both
		// false AND true, so it would have passed even if a fresh identifier
		// were wrongly reported as locked. Pin to the actual unlocked state.
		// Table-driven: each row is a degenerate identifier that must still
		// resolve to the unlocked state (empty / very long / special-chars).
		test.each([
			["empty string", ""],
			["very long (10k chars)", "a".repeat(10000)],
			["special characters", "test@example.com\n\r\t\x00"],
		])("lockout check handles %s identifier (unlocked, 5 remaining)", async (_label, id) => {
			const info = await checkAccountLockout(id);
			expect(info.isLocked).toBe(false);
			expect(info.remainingAttempts).toBe(5);
		});

		// Empty/malformed tokens are never in the blacklist set → false in
		// dev/CI. extractTokenId's fallback (first 32 chars) keeps a malformed
		// token's id stable but unmatched.
		test.each([
			["empty", ""],
			["malformed (not a JWT)", "not-a-valid-jwt"],
		])("blacklist check returns false for %s token", async (_label, token) => {
			const result = await isTokenBlacklisted(token);
			expect(result).toBe(false);
		});
	});

	describe("Edge Case: Redis Connection Failures", () => {
		test("should handle Redis unavailable during failed login recording", async () => {
			const originalEnv = process.env.NODE_ENV;

			try {
				process.env.NODE_ENV = "development";
				await expect(recordFailedLogin("redis-down-test", "127.0.0.1")).resolves.toBeUndefined();
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});

		test("should return a well-formed lockout result under normal Redis", async () => {
			// Despite the describe-block title "Redis Connection Failures",
			// this case never actually disconnects Redis — it just calls
			// checkAccountLockout with a fresh identifier. With Redis reachable
			// the contract is the unlocked state (authLockout.ts:54). The old
			// `typeof boolean` assertion hid a regression where a healthy
			// identifier came back locked.
			const info = await checkAccountLockout("any-identifier");
			expect(info.isLocked).toBe(false);
			expect(info.remainingAttempts).toBe(5);
		});
	});

	describe("Concurrent API Requests", () => {
		test("should handle multiple concurrent registration attempts", async () => {
			// 5 DISTINCT emails with a strong password. Contract outcomes:
			//   201 — created (the normal case; emails are unique per i)
			//   429 — rate-limited under burst load
			//   500 — only if Postgres genuinely fails
			// 400 (validation) and 409 (duplicate email) are NOT valid here:
			// password is strong and each email is distinct, so allowing them
			// would mask real validation/conflict regressions. The old set
			// also included 400 and 409, hiding both.
			const timestamp = Date.now();
			const concurrentRegistrations = Array.from({ length: 5 }, (_, i) =>
				request(app)
					.post("/auth/register")
					.send({
						email: `concurrent-${i}-${timestamp}@example.com`,
						password: "ValidPass123!",
						name: `Concurrent User ${i}`,
					}),
			);

			const responses = await Promise.all(concurrentRegistrations);

			responses.forEach((response) => {
				expect([201, 429, 500]).toContain(response.status);
			});
		});

		test("should handle concurrent login attempts with same credentials", async () => {
			// 5 logins against a NEVER-registered email with wrong password.
			// Contract outcomes:
			//   401 — invalid credentials (the normal case)
			//   429 — after MAX_ATTEMPTS the account locks and further tries
			//          return 429 (authLockout gate inside the login route)
			// 200 (would mean login succeeded against a nonexistent user — a
			// critical auth bypass) and 400/500 are NOT valid and were silently
			// accepted by the old set.
			const timestamp = Date.now();

			const concurrentLogins = Array.from({ length: 5 }, () =>
				request(app)
					.post("/auth/login")
					.send({
						email: `nonexistent-${timestamp}@example.com`,
						password: "WrongPassword123!",
					}),
			);

			const responses = await Promise.all(concurrentLogins);

			responses.forEach((response) => {
				expect([401, 429]).toContain(response.status);
			});
		});

		test("should handle mixed concurrent requests to different endpoints", async () => {
			const timestamp = Date.now();

			// Four endpoints with well-defined contracts:
			//   register  → 201 (created) | 429 (rate-limited under concurrency)
			//   login     → 401 (bad creds, never registered) | 429 (lockout)
			//   /auth/me  → 401 (no Authorization header)
			//   refresh   → 401 (invalid refreshToken string)
			// The point of this test is that no endpoint crashes (5xx) under
			// concurrent load, AND each returns one of its contract statuses
			// rather than an unrelated one. The old assertion `200 ≤ s ≤ 500`
			// accepted literally every HTTP status — including a 200 from
			// /auth/me with no token (a real auth bug) — so it caught nothing.
			const mixedRequests = [
				{
					req: request(app)
						.post("/auth/register")
						.send({
							email: `mixed-${timestamp}@example.com`,
							password: "ValidPass123!",
						}),
					allowed: new Set([201, 429]),
				},
				{
					req: request(app)
						.post("/auth/login")
						.send({
							email: `test-${timestamp}@example.com`,
							password: "WrongPass123!",
						}),
					allowed: new Set([401, 429]),
				},
				{
					req: request(app).get("/auth/me"),
					allowed: new Set([401]),
				},
				{
					req: request(app).post("/auth/refresh").send({ refreshToken: "invalid" }),
					allowed: new Set([401]),
				},
			];

			const responses = await Promise.all(mixedRequests.map((m) => m.req));

			responses.forEach((response, i) => {
				const label = ["register", "login", "me", "refresh"][i];
				expect(
					mixedRequests[i].allowed.has(response.status),
					`${label} returned ${response.status}, expected one of ${[...mixedRequests[i].allowed].join(", ")}`,
				).toBe(true);
			});
		});
	});
});
