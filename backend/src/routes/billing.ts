import { Router } from "express";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError } from "@/middleware/errorHandler";
import { getPlanLimits, getUserPlan } from "@/services/usageService";

const router = Router();

const PLANS = [
	{
		id: "free",
		name: "Free",
		price: 0,
		features: [
			"5 watchlist items",
			"3 AI prediction models",
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
			"50 watchlist items",
			"All 7 AI models",
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
	asyncHandler(async (_req: AuthRequest, res) => {
		success(res, { plans: PLANS });
	}),
);

// GET /api/billing/subscription — current user's subscription
router.get(
	"/subscription",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { plan, limits } = await getUserPlan(req.userId!);

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
	asyncHandler(async (req: AuthRequest, res) => {
		const sub = await prisma.subscription.findUnique({
			where: { userId: req.userId! },
		});

		if (!sub || sub.plan === "free") {
			throw new BadRequestError("No active subscription to cancel");
		}

		await prisma.subscription.update({
			where: { userId: req.userId! },
			data: { status: "canceled", plan: "free" },
		});

		success(res, { message: "Subscription cancelled" });
	}),
);

// GET /api/billing/usage — usage stats for current period
router.get(
	"/usage",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const sub = await prisma.subscription.findUnique({
			where: { userId: req.userId! },
			include: { usageRecords: true },
		});

		if (!sub) {
			return success(res, {
				usage: [],
				plan: "free",
				limits: getPlanLimits("free"),
			});
		}

		success(res, {
			usage: sub.usageRecords,
			plan: sub.plan,
			limits: getPlanLimits(sub.plan),
		});
	}),
);

export { router as billingRouter };
