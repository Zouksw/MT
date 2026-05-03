import { Router } from "express";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/errorHandler";

const router = Router();

// GET /api/community/leaderboard — top traders by P&L
router.get(
	"/leaderboard",
	authenticate,
	asyncHandler(async (_req: AuthRequest, res) => {
		const accounts = await prisma.simulationAccount.findMany({
			where: { isActive: true },
			orderBy: { currentBalance: "desc" },
			take: 50,
			include: {
				user: { select: { id: true, name: true, avatarUrl: true } },
				_count: { select: { trades: true } },
			},
		});

		const leaderboard = accounts.map((a, idx) => ({
			rank: idx + 1,
			user: a.user,
			accountName: a.name,
			balance: Number(a.currentBalance),
			pnl: Number(a.currentBalance) - Number(a.initialBalance),
			pnlPercent:
				((Number(a.currentBalance) - Number(a.initialBalance)) /
					Number(a.initialBalance)) *
				100,
			tradeCount: a._count.trades,
		}));

		success(res, { leaderboard });
	}),
);

// GET /api/community/profile/:userId — public profile
router.get(
	"/profile/:userId",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const user = await prisma.user.findUnique({
			where: { id: req.params.userId },
			select: {
				id: true,
				name: true,
				avatarUrl: true,
				createdAt: true,
				simAccounts: {
					where: { isActive: true },
					select: {
						name: true,
						initialBalance: true,
						currentBalance: true,
						_count: { select: { trades: true } },
					},
				},
				sharedSignals: {
					orderBy: { createdAt: "desc" },
					take: 10,
					select: {
						commoditySlug: true,
						signalType: true,
						confidence: true,
						likes: true,
						commentsCount: true,
						createdAt: true,
					},
				},
				_count: {
					select: {
						sharedSignals: true,
						signalLikes: true,
					},
				},
			},
		});

		if (!user) {
			return success(res, { profile: null });
		}

		success(res, {
			profile: {
				id: user.id,
				name: user.name,
				avatarUrl: user.avatarUrl,
				memberSince: user.createdAt,
				signalCount: user._count.sharedSignals,
				accounts: user.simAccounts.map((a) => ({
					name: a.name,
					pnl: Number(a.currentBalance) - Number(a.initialBalance),
					tradeCount: a._count.trades,
				})),
				recentSignals: user.sharedSignals,
			},
		});
	}),
);

export { router as communityRouter };
