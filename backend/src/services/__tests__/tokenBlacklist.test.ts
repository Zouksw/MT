/**
 * Token Blacklist Service — Real Redis Integration Tests
 *
 * Tests the actual token blacklist service against a running Redis instance.
 * No mocks — every assertion verifies real Redis state.
 */

import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	blacklistToken,
	checkTokenBlacklist,
	clearBlacklist,
	getBlacklistStats,
	isTokenBlacklisted,
	removeFromBlacklist,
} from "@/services/tokenBlacklist";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

const JWT_SECRET = "test-secret-key-for-jwt-testing-purposes-only-32chars";

function makeToken(overrides: { exp?: number; jti?: string } = {}): string {
	const payload: Record<string, unknown> = {
		userId: "test-user-id",
		jti: overrides.jti ?? uuidv4(),
	};
	if (overrides.exp) payload.exp = overrides.exp;
	return jwt.sign(payload, JWT_SECRET);
}

describe("tokenBlacklist service (real Redis)", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("tokenBlacklist");
	});

	afterAll(async () => {
		if (ctx?.available) {
			await clearBlacklist();
		}
		await destroyTestContext(ctx);
	});

	beforeEach(() => {
		if (!ctx?.available) return;
	});

	describe("blacklistToken", () => {
		it("should blacklist a valid token and verify via Redis", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });

			const result = await blacklistToken(token, "logout");
			expect(result).toBe(true);

			// Verify via isTokenBlacklisted
			expect(await isTokenBlacklisted(token)).toBe(true);
		});

		it("should not blacklist an already expired token", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 });

			const result = await blacklistToken(token, "logout");
			expect(result).toBe(false);
			expect(await isTokenBlacklisted(token)).toBe(false);
		});

		it("should blacklist token without exp using default TTL", async () => {
			const token = makeToken(); // no exp

			const result = await blacklistToken(token, "password_change");
			expect(result).toBe(true);
			expect(await isTokenBlacklisted(token)).toBe(true);
		});
	});

	describe("isTokenBlacklisted", () => {
		it("should return false for non-blacklisted token", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			expect(await isTokenBlacklisted(token)).toBe(false);
		});

		it("should return true for blacklisted token", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			await blacklistToken(token, "logout");
			expect(await isTokenBlacklisted(token)).toBe(true);
		});
	});

	describe("removeFromBlacklist", () => {
		it("should remove a blacklisted token", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			await blacklistToken(token, "logout");
			expect(await isTokenBlacklisted(token)).toBe(true);

			const result = await removeFromBlacklist(token);
			expect(result).toBe(true);
			expect(await isTokenBlacklisted(token)).toBe(false);
		});
	});

	describe("getBlacklistStats", () => {
		it("should return stats counting blacklisted tokens", async () => {
			// Clean slate for this test
			await clearBlacklist();

			const token1 = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			const token2 = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			await blacklistToken(token1, "test");
			await blacklistToken(token2, "test");

			const stats = await getBlacklistStats();
			expect(stats.totalBlacklisted).toBeGreaterThanOrEqual(2);
		});

		it("should return 0 when blacklist is empty", async () => {
			await clearBlacklist();
			const stats = await getBlacklistStats();
			expect(stats.totalBlacklisted).toBe(0);
		});
	});

	describe("clearBlacklist", () => {
		it("should clear all blacklisted tokens", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			await blacklistToken(token, "test");

			const result = await clearBlacklist();
			expect(result).toBe(true);

			const stats = await getBlacklistStats();
			expect(stats.totalBlacklisted).toBe(0);
		});
	});

	describe("checkTokenBlacklist", () => {
		it("should throw for blacklisted token", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			await blacklistToken(token, "logout");

			await expect(checkTokenBlacklist(token)).rejects.toThrow(
				"Token has been revoked",
			);
		});

		it("should not throw for valid token", async () => {
			const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
			await expect(checkTokenBlacklist(token)).resolves.toBeUndefined();
		});
	});

	describe("blacklistUserTokens", () => {
		it("should return 0 (placeholder)", async () => {
			const { blacklistUserTokens: blut } = await import(
				"@/services/tokenBlacklist"
			);
			const result = await blut("user-123", "security");
			expect(result).toBe(0);
		});
	});
});
