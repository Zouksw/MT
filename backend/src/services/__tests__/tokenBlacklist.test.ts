/**
 * Token Blacklist Service — Real Redis Integration Tests
 *
 * Tests the actual token blacklist service against a running Redis instance.
 * No mocks — every assertion verifies real Redis state.
 */

import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { blacklistToken, isTokenBlacklisted } from "@/services/tokenBlacklist";
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
		if (!ctx.available)
			throw new Error(
				"tokenBlacklist: integration suite requires PostgreSQL+Redis. Start them (docker-compose up) or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		// No explicit blacklist wipe: blacklisted keys carry the token's own
		// TTL (≤1h in these fixtures) and unique jtis, so they cannot collide
		// with other suites. The admin clear/stats helpers were removed as
		// 0-caller dead code (round-112).
		await destroyTestContext(ctx);
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
});
