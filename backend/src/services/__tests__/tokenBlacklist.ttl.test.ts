/**
 * tokenBlacklist TTL regression (round-104 / audit High-2).
 *
 * blacklistToken used to reset the shared set's expireAt to EVERY revoked
 * token's exp. Revoking a short-lived token (1h) after a long-lived one (7d)
 * evicted the whole set an hour later — the 7-day token, still valid,
 * silently left the blacklist. isTokenBlacklisted only read that set, so
 * logout/password-change revocations resurrected.
 *
 * Fix: the per-token key (TTL = the token's own exp) is the source of truth;
 * the set's TTL may only extend. These tests pin the resurrection scenario.
 */

import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { redis } from "@/lib/redis";
import { blacklistToken, isTokenBlacklisted } from "@/services/tokenBlacklist";

const BLACKLIST_SET = "token:blacklist:all";

function tokenWithExpiry(seconds: number, jti: string): string {
	return jwt.sign(
		{ userId: "ttl-test-user", jti },
		process.env.JWT_SECRET ?? "test-secret-key-for-jwt-testing-purposes-only-32chars",
		{
			expiresIn: seconds,
		},
	);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let longToken = "";
let shortToken = "";

// Clean slate for the ids this suite owns (parallel suites share redis).
// removeFromBlacklist was removed as 0-caller dead code (round-112), so this
// deletes the same two structures directly: per-token key + set membership.
async function cleanupOwnKeys() {
	const client = await redis();
	await client
		.multi()
		.del("token:blacklist:ttl-test-long")
		.del("token:blacklist:ttl-test-short")
		.sRem(BLACKLIST_SET, "ttl-test-long")
		.sRem(BLACKLIST_SET, "ttl-test-short")
		.exec()
		.catch(() => {});
}

beforeAll(async () => {
	longToken = tokenWithExpiry(7 * 24 * 3600, "ttl-test-long");
	shortToken = tokenWithExpiry(3, "ttl-test-short");
	await cleanupOwnKeys();
});

afterAll(async () => {
	await cleanupOwnKeys();
});

describe("tokenBlacklist — per-token TTL (resurrection regression)", () => {
	it("revoking a short-lived token does NOT shorten the shared set's TTL", async () => {
		// Assert the write itself succeeded — blacklistToken swallows errors
		// (returns false), and a parallel suite's 24h writes could otherwise
		// mask a silently-failed 7d blacklist in the TTL assertion below.
		await expect(blacklistToken(longToken, "logout")).resolves.toBe(true);
		await expect(blacklistToken(shortToken, "logout")).resolves.toBe(true);

		const setTtl = await (await redis()).ttl(BLACKLIST_SET);
		// Before the fix this was ~3s (the short token's exp). Must now cover
		// the LONGEST blacklisted token — pin to >6 days so only this suite's
		// 7d write can satisfy it.
		expect(setTtl).toBeGreaterThan(6 * 24 * 3600);
	});

	it("long-lived revocation SURVIVES the short-lived token's expiry (the resurrection bug)", async () => {
		// The short token was blacklisted by test 1; re-asserting it here
		// raced its 3s expiry (>3s of wall clock since beforeAll → the
		// per-token key had already evicted → flaky red, round-106).
		// Let the short token pass its exp + per-token key TTL eviction.
		await sleep(3500);
		// THE regression assertion: the long token must still be revoked.
		expect(await isTokenBlacklisted(longToken)).toBe(true);
	});

	it("per-token key carries the token's own TTL", async () => {
		const ttl = await (await redis()).ttl("token:blacklist:ttl-test-long");
		expect(ttl).toBeGreaterThan(6 * 24 * 3600);
		expect(ttl).toBeLessThanOrEqual(7 * 24 * 3600);
	});

	it("cleanup helper clears both structures for this suite's ids", async () => {
		await cleanupOwnKeys();
		expect(await isTokenBlacklisted(longToken)).toBe(false);
	});
});
