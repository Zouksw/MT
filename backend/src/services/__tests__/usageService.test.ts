/**
 * Usage Service — plan limits surfaced to the billing UI.
 *
 * checkLimit/trackUsage were removed (round-112): quota scaffolding with
 * zero production callers — plan limits are informational only (PRODUCT-SPEC
 * §九: no paywall). What remains under test: getPlanLimits' documented
 * values and its fail-closed fallback, plus getUserPlan's downgrade rules.
 *
 * Pure-logic tests: prisma.subscription.findUnique is mocked so no DB is
 * touched.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so the mock fn must be created
// inside vi.hoisted() to be in scope when the factory runs.
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib", () => ({
	prisma: { subscription: { findUnique } },
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getPlanLimits, getUserPlan } from "@/services/usageService";

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

describe("getUserPlan — subscription status downgrade", () => {
	it("returns the active plan with its limits", async () => {
		findUnique.mockResolvedValueOnce(sub("pro"));
		const { plan, limits } = await getUserPlan("u1");
		expect(plan).toBe("pro");
		expect(limits.watchlistItems).toBe(50);
	});

	it("treats a canceled subscription as free (not its former plan)", async () => {
		// A canceled 'pro' sub must NOT retain pro limits. getUserPlan reads
		// status === 'active'; anything else → free.
		findUnique.mockResolvedValueOnce(sub("pro", "canceled"));
		const { plan, limits } = await getUserPlan("u1");
		expect(plan).toBe("free");
		expect(limits.watchlistItems).toBe(5);
	});

	it("treats a missing subscription as free", async () => {
		findUnique.mockResolvedValueOnce(null);
		const { plan } = await getUserPlan("u1");
		expect(plan).toBe("free");
	});
});
