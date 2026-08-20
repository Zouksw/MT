import { prisma } from "@/lib";

// Plan limits
const PLAN_LIMITS: Record<string, Record<string, number>> = {
	free: {
		watchlists: 1,
		watchlistItems: 5,
		aiModels: 3,
		signalsPerDay: 10,
		apiCalls: 100,
		historyDays: 7,
	},
	pro: {
		watchlists: 10,
		watchlistItems: 50,
		aiModels: 7,
		signalsPerDay: 100,
		apiCalls: 5000,
		historyDays: 365,
	},
	enterprise: {
		watchlists: Infinity,
		watchlistItems: Infinity,
		aiModels: Infinity,
		signalsPerDay: Infinity,
		apiCalls: Infinity,
		historyDays: Infinity,
	},
};

export function getPlanLimits(plan: string): Record<string, number> {
	return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

export async function getUserPlan(
	userId: string,
): Promise<{ plan: string; limits: Record<string, number> }> {
	const sub = await prisma.subscription.findUnique({
		where: { userId },
	});

	const plan = sub?.status === "active" ? sub.plan || "free" : "free";
	return { plan, limits: getPlanLimits(plan) };
}

// checkLimit/trackUsage were REMOVED (round-112): quota scaffolding with zero
// production callers — the advertised plan limits were never enforced and
// usageRecords were never written (PRODUCT-SPEC §九: no paywall). PLAN_LIMITS
// itself stays: /billing/subscription surfaces it as informational limits.
// To enforce quotas someday, reintroduce both with route wiring in the same
// change (git history has the implementation).
