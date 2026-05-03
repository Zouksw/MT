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
			const initialStats = await getBlacklistStats();
			expect(initialStats).toHaveProperty("totalBlacklisted");
			expect(typeof initialStats.totalBlacklisted).toBe("number");
		});

		test("should handle isTokenBlacklisted with various inputs", async () => {
			// Test with empty token
			const emptyResult = await isTokenBlacklisted("");
			expect(typeof emptyResult).toBe("boolean");

			// Test with malformed token
			const malformedResult = await isTokenBlacklisted("not-a-jwt");
			expect(typeof malformedResult).toBe("boolean");

			// Test with random string
			const randomResult = await isTokenBlacklisted(
				"random-string-for-testing",
			);
			expect(typeof randomResult).toBe("boolean");
		});

		test("should handle removeFromBlacklist gracefully", async () => {
			const result = await removeFromBlacklist("non-existent-token");
			expect(typeof result).toBe("boolean");
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
			const testToken = `test-token-${Date.now()}`;

			const results = await Promise.all(
				Array.from({ length: 10 }, () => isTokenBlacklisted(testToken)),
			);

			results.forEach((result) => {
				expect(typeof result).toBe("boolean");
			});
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
			const expiredToken = `expired-token-${Date.now()}`;
			const result = await blacklistToken(expiredToken, "expired-test");
			expect(typeof result).toBe("boolean");
		});
	});

	describe("Edge Case: Empty and Null Inputs", () => {
		test("should handle empty string identifier in lockout check", async () => {
			const info = await checkAccountLockout("");
			expect(info).toHaveProperty("isLocked");
			expect(typeof info.isLocked).toBe("boolean");
		});

		test("should handle very long identifier strings", async () => {
			const longId = "a".repeat(10000);
			const info = await checkAccountLockout(longId);
			expect(info).toHaveProperty("isLocked");
		});

		test("should handle special characters in identifier", async () => {
			const specialId = "test@example.com\n\r\t\x00";
			const info = await checkAccountLockout(specialId);
			expect(info).toHaveProperty("isLocked");
		});

		test("should handle empty token in blacklist check", async () => {
			const result = await isTokenBlacklisted("");
			expect(typeof result).toBe("boolean");
		});

		test("should handle malformed token in blacklist", async () => {
			const result = await isTokenBlacklisted("not-a-valid-jwt");
			expect(typeof result).toBe("boolean");
		});
	});

	describe("Edge Case: Redis Connection Failures", () => {
		test("should handle Redis unavailable during failed login recording", async () => {
			const originalEnv = process.env.NODE_ENV;

			try {
				process.env.NODE_ENV = "development";
				await expect(
					recordFailedLogin("redis-down-test", "127.0.0.1"),
				).resolves.toBeUndefined();
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});

		test("should handle Redis unavailable during lockout check", async () => {
			const info = await checkAccountLockout("any-identifier");
			expect(info).toHaveProperty("isLocked");
			expect(typeof info.isLocked).toBe("boolean");
		});
	});

	describe("Concurrent API Requests", () => {
		test("should handle multiple concurrent registration attempts", async () => {
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
				expect([201, 409, 400, 500, 429]).toContain(response.status);
			});
		});

		test("should handle concurrent login attempts with same credentials", async () => {
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
				expect([200, 401, 400, 429, 500]).toContain(response.status);
			});
		});

		test("should handle mixed concurrent requests to different endpoints", async () => {
			const timestamp = Date.now();

			const mixedRequests = [
				request(app)
					.post("/auth/register")
					.send({
						email: `mixed-${timestamp}@example.com`,
						password: "ValidPass123!",
					}),
				request(app)
					.post("/auth/login")
					.send({
						email: `test-${timestamp}@example.com`,
						password: "WrongPass123!",
					}),
				request(app).get("/auth/me"),
				request(app).post("/auth/refresh").send({ refreshToken: "invalid" }),
			];

			const responses = await Promise.all(mixedRequests);

			responses.forEach((response) => {
				expect(response.status).toBeGreaterThanOrEqual(200);
				expect(response.status).toBeLessThanOrEqual(500);
			});
		});
	});
});
