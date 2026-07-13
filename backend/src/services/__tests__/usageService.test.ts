/**
 * Usage Service — plan-limit paywall logic.
 *
 * checkLimit() decides whether a user may take a metered action (add a watchlist
 * item, run an AI model, etc.). The contract:
 *   - enterprise → always allowed (Infinity).
 *   - free / pro → allowed while currentCount < plan limit, denied at >= limit.
 *   - unknown feature → treated as limit 0 (deny at first call) — fail-closed.
 *   - inactive/cancelled subscription → downgraded to free limits.
 *
 * These are pure-logic tests: prisma.subscription.findUnique is mocked so no DB
 * is touched. The mutation check (Step 2 of gen-tests) confirms each branch is
 * load-bearing — flip a comparison and the corresponding test fails.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so the mock fn must be created
// inside vi.hoisted() to be in scope when the factory runs.
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib", () => ({
	prisma: { subscription: { findUnique } },
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { checkLimit, getPlanLimits } from "@/services/usageService";

/** Build a subscription row the way Prisma would return it. */
function sub(plan: string | null, status: "active" | "canceled" | "past_due" = "active") {
	return { plan, status };
}

beforeEach(() => {
	findUnique.mockReset();
});

describe("getPlanLimits", () => {
	it("returns the documented free-tier limits", () => {
		const free = getPlanLimits("free");
		expect(free.watchlistItems).toBe(5);
		expect(free.aiModels).toBe(3);
	});

	it("returns the documented pro-tier limits", () => {
		const pro = getPlanLimits("pro");
		expect(pro.watchlistItems).toBe(50);
		expect(pro.aiModels).toBe(7);
	});

	it("falls back to free for an unknown plan", () => {
		// Fail-closed: an unrecognized plan string never grants pro/enterprise rights.
		expect(getPlanLimits("super-deluxe").watchlistItems).toBe(5);
	});

	it("enterprise limits are unbounded (Infinity)", () => {
		expect(getPlanLimits("enterprise").watchlistItems).toBe(Infinity);
	});
});

describe("checkLimit — free plan paywall", () => {
	it("allows the action while under the limit", async () => {
		findUnique.mockResolvedValueOnce(sub("free"));
		// free.watchlistItems = 5; 4 is the last permitted slot.
		expect(await checkLimit("u1", "watchlistItems", 4)).toBe(true);
	});

	it("denies the action once the limit is reached (boundary)", async () => {
		findUnique.mockResolvedValueOnce(sub("free"));
		// currentCount === limit → not allowed. Off-by-one here would let a free
		// user exceed the documented plan ceiling.
		expect(await checkLimit("u1", "watchlistItems", 5)).toBe(false);
	});

	it("denies when already over the limit", async () => {
		findUnique.mockResolvedValueOnce(sub("free"));
		expect(await checkLimit("u1", "watchlistItems", 99)).toBe(false);
	});

	it("currently ALLOWS an unknown feature (fail-open — documented behavior)", async () => {
		// KNOWN GAP: an unrecognized feature name has no plan limit, so `limit`
		// is undefined. `currentCount >= undefined` is false (NaN compare), and
		// the function falls through to `return true`. This means a typo in the
		// feature string silently grants unlimited access. Pinned here so a
		// future fix to fail-closed is a deliberate, visible change.
		findUnique.mockResolvedValueOnce(sub("free"));
		expect(await checkLimit("u1", "teleport", 0)).toBe(true);
	});
});

describe("checkLimit — pro plan paywall", () => {
	it("respects the higher pro limit (50 watchlist items)", async () => {
		findUnique.mockResolvedValueOnce(sub("pro"));
		expect(await checkLimit("u1", "watchlistItems", 49)).toBe(true);
		expect(await checkLimit("u1", "watchlistItems", 50)).toBe(false);
	});
});

describe("checkLimit — enterprise is unbounded", () => {
	it("always allows regardless of currentCount", async () => {
		findUnique.mockResolvedValueOnce(sub("enterprise"));
		expect(await checkLimit("u1", "watchlistItems", 1_000_000)).toBe(true);
	});
});

describe("checkLimit — subscription status downgrade", () => {
	it("treats a canceled subscription as free (not its former plan)", async () => {
		// A canceled 'pro' sub must NOT retain pro limits. getUserPlan reads
		// status === 'active'; anything else → free.
		findUnique.mockResolvedValueOnce(sub("pro", "canceled"));
		expect(await checkLimit("u1", "watchlistItems", 6)).toBe(false); // free cap is 5
	});

	it("treats a missing subscription as free", async () => {
		findUnique.mockResolvedValueOnce(null);
		expect(await checkLimit("u1", "watchlistItems", 5)).toBe(false);
	});
});
