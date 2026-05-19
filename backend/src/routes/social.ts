import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, NotFoundError } from "@/middleware/errorHandler";

const router = Router();

const shareSignalSchema = z.object({
	commoditySlug: z.string().min(1),
	signalType: z.enum(["BUY", "SELL", "HOLD"]),
	confidence: z.number().min(0).max(1),
	reasoning: z.string().max(1000).optional(),
	currentPrice: z.number().positive().optional(),
	targetPrice: z.number().positive().optional(),
});

// GET /api/social/feed — get signal feed
router.get(
	"/feed",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const page = Math.max(1, Number(req.query.page) || 1);
		const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
		const skip = (page - 1) * limit;

		const [signals, total] = await Promise.all([
			prisma.sharedSignal.findMany({
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					user: { select: { id: true, name: true, avatarUrl: true } },
					_count: { select: { signalComments: true, signalLikes: true } },
				},
			}),
			prisma.sharedSignal.count(),
		]);

		const feed = signals.map((s) => ({
			id: s.id,
			user: s.user,
			commoditySlug: s.commoditySlug,
			signalType: s.signalType,
			confidence: Number(s.confidence),
			reasoning: s.reasoning,
			currentPrice: s.currentPrice ? Number(s.currentPrice) : null,
			targetPrice: s.targetPrice ? Number(s.targetPrice) : null,
			likes: s.likes,
			commentsCount: s.commentsCount,
			createdAt: s.createdAt,
		}));

		success(res, { feed, total, page, limit });
	}),
);

// GET /api/social/signals — list shared signals (alias for feed)
router.get(
	"/signals",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const page = Math.max(1, Number(req.query.page) || 1);
		const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
		const skip = (page - 1) * limit;

		const [signals, total] = await Promise.all([
			prisma.sharedSignal.findMany({
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					user: { select: { id: true, name: true, avatarUrl: true } },
					_count: { select: { signalComments: true, signalLikes: true } },
				},
			}),
			prisma.sharedSignal.count(),
		]);

		success(res, { signals, total, page, limit });
	}),
);

// POST /api/social/signals — share a signal
router.post(
	"/signals",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const data = shareSignalSchema.parse(req.body);

		const signal = await prisma.sharedSignal.create({
			data: {
				userId: req.userId,
				...data,
				confidence: data.confidence,
				currentPrice: data.currentPrice,
				targetPrice: data.targetPrice,
			},
			include: {
				user: { select: { id: true, name: true } },
			},
		});

		success(res, { signal }, 201);
	}),
);

// POST /api/social/signals/:id/like — toggle like
router.post(
	"/signals/:id/like",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const signal = await prisma.sharedSignal.findUnique({
			where: { id: req.params.id },
		});
		if (!signal) throw new NotFoundError("Signal");

		const existing = await prisma.signalLike.findUnique({
			where: {
				signalId_userId: { signalId: req.params.id, userId: req.userId },
			},
		});

		if (existing) {
			await prisma.$transaction([
				prisma.signalLike.delete({ where: { id: existing.id } }),
				prisma.sharedSignal.update({
					where: { id: req.params.id },
					data: { likes: { decrement: 1 } },
				}),
			]);
			success(res, { liked: false });
		} else {
			await prisma.$transaction([
				prisma.signalLike.create({
					data: { signalId: req.params.id, userId: req.userId },
				}),
				prisma.sharedSignal.update({
					where: { id: req.params.id },
					data: { likes: { increment: 1 } },
				}),
			]);
			success(res, { liked: true });
		}
	}),
);

// GET /api/social/signals/:id/comments
router.get(
	"/signals/:id/comments",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const comments = await prisma.signalComment.findMany({
			where: { signalId: req.params.id },
			orderBy: { createdAt: "asc" },
			include: {
				user: { select: { id: true, name: true, avatarUrl: true } },
			},
			take: 100,
		});

		success(res, { comments });
	}),
);

// POST /api/social/signals/:id/comments
router.post(
	"/signals/:id/comments",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { content } = z.object({ content: z.string().min(1).max(500) }).parse(req.body);

		const signal = await prisma.sharedSignal.findUnique({
			where: { id: req.params.id },
		});
		if (!signal) throw new NotFoundError("Signal");

		const comment = await prisma.signalComment.create({
			data: {
				signalId: req.params.id,
				userId: req.userId,
				content,
			},
			include: {
				user: { select: { id: true, name: true } },
			},
		});

		await prisma.sharedSignal.update({
			where: { id: req.params.id },
			data: { commentsCount: { increment: 1 } },
		});

		success(res, { comment }, 201);
	}),
);

export { router as socialRouter };
