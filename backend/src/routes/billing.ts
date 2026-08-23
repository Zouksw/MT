import { Router } from "express";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError } from "@/middleware/errorHandler";
import { getUserPlan } from "@/services/usageService";

const router = Router();

const PLANS = [
	{
		id: "free",
		name: "Free",
		price: 0,
		features: [
			// round-120: "5 watchlist items" removed — the watchlist has no UI
			// entry point yet (backend + lib only); don't sell it as a tier
			// differentiator.
			// round-119: AI tier gating is dormant (AI_TIER_ENFORCED, default
			// off) — every registered user can currently run all 9 model ids.
			// Listing "3 AI prediction models" here claimed a restriction that
			// does not exist; paid tiers will differentiate when they launch.
			"All 9 AI prediction models (open phase)",
			"10 signals/day",
			"7-day price history",
			"Basic alerts",
		],
	},
	{
		id: "pro",
		name: "Professional",
		price: 49,
		features: [
			// round-120: "50 watchlist items" removed with the free-tier claim
			// above — no watchlist UI exists to differentiate with.
			// round-119: 7 was a stale count (registry has 9 model ids); the
			// free/pro split on model access is not enforced today.
			"All 9 AI models, priority inference (planned)",
			"Unlimited signals",
			"1-year price history",
			"Backtest reports",
			"Correlation analysis",
			"API access",
		],
	},
	{
		id: "enterprise",
		name: "Enterprise",
		price: 199,
		features: [
			"Unlimited everything",
			"Custom AI models",
			"Prediction backtesting",
			"Full price history",
			"Market factor analysis",
			"Private deployment",
			"Priority API access",
		],
	},
];

// GET /api/billing/plans — list available plans
router.get(
	"/plans",
	authenticate,
	asyncHandler(async (_req: AuthenticatedRequest, res) => {
		success(res, { plans: PLANS });
	}),
);

// GET /api/billing/subscription — current user's subscription
router.get(
	"/subscription",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { plan, limits } = await getUserPlan(req.userId);

		success(res, {
			plan,
			limits,
			planDetails: PLANS.find((p) => p.id === plan),
		});
	}),
);

// POST /api/billing/cancel — cancel subscription
router.post(
	"/cancel",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const sub = await prisma.subscription.findUnique({
			where: { userId: req.userId },
		});

		if (!sub || sub.plan === "free") {
			throw new BadRequestError("No active subscription to cancel");
		}

		await prisma.subscription.update({
			where: { userId: req.userId },
			data: { status: "canceled", plan: "free" },
		});

		success(res, { message: "Subscription cancelled" });
	}),
);

// GET /api/billing/usage was REMOVED (round-112): nothing ever wrote
// usageRecords (trackUsage had zero production callers — quota scaffolding
// from the pre-PRODUCT-SPEC era), so the endpoint always returned an empty
// array, and no frontend code called it. The billing UI reads /plans and
// /subscription, which remain.

export { router as billingRouter };
