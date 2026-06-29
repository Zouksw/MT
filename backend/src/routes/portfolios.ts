/**
 * Analysis Groups (formerly "Portfolios").
 *
 * An analysis group is a user-curated set of commodities for tracking and
 * correlation overlay — NOT a trading portfolio. There are no positions,
 * sides, quantities, or P&L. Members are added/removed like a watchlist, but
 * an analysis group carries a description and is meant for multi-commodity
 * comparison (see GET /api/analytics/correlation, which feeds off group slugs).
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "@/middleware/errorHandler";

const router = Router();

const createGroupSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

const addMemberSchema = z.object({
	commodityId: z.string().uuid(),
	notes: z.string().max(500).optional(),
});

const updateMemberSchema = z.object({
	notes: z.string().max(500).optional(),
});

// GET /api/portfolios — list user's analysis groups with members
router.get(
	"/",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const groups = await prisma.portfolio.findMany({
			where: { userId: req.userId },
			include: {
				members: {
					include: {
						commodity: { select: { slug: true, name: true, unit: true } },
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		const result = groups.map((g) => ({
			id: g.id,
			name: g.name,
			description: g.description,
			isDefault: g.isDefault,
			memberCount: g.members.length,
			members: g.members.map((m) => ({
				id: m.id,
				commodity: m.commodity,
				notes: m.notes,
				addedAt: m.addedAt,
			})),
			createdAt: g.createdAt,
		}));

		success(res, { groups: result });
	}),
);

// POST /api/portfolios — create analysis group
router.post(
	"/",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { name, description } = createGroupSchema.parse(req.body);

		const existing = await prisma.portfolio.findUnique({
			where: { userId_name: { userId: req.userId, name } },
		});
		if (existing) {
			throw new BadRequestError(`Analysis group '${name}' already exists`);
		}

		const group = await prisma.portfolio.create({
			data: { userId: req.userId, name, description },
		});

		success(res, { group }, 201);
	}),
);

// GET /api/portfolios/:id — analysis group detail with members
router.get(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const group = await prisma.portfolio.findUnique({
			where: { id: req.params.id },
			include: {
				members: {
					include: {
						commodity: {
							select: {
								slug: true,
								name: true,
								nameCn: true,
								unit: true,
								category: true,
							},
						},
					},
					orderBy: { addedAt: "desc" },
				},
			},
		});

		if (!group || group.userId !== req.userId) {
			throw new NotFoundError("Analysis group");
		}

		success(res, { group });
	}),
);

// POST /api/portfolios/:id/members — add commodity to group
router.post(
	"/:id/members",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const group = await prisma.portfolio.findUnique({
			where: { id: req.params.id },
		});
		if (!group || group.userId !== req.userId) {
			throw new NotFoundError("Analysis group");
		}

		const { commodityId, notes } = addMemberSchema.parse(req.body);

		const commodity = await prisma.commodity.findUnique({
			where: { id: commodityId },
		});
		if (!commodity) {
			throw new NotFoundError("Commodity");
		}

		const member = await prisma.groupMember.create({
			data: {
				portfolioId: req.params.id,
				commodityId,
				notes,
			},
			include: {
				commodity: { select: { slug: true, name: true, unit: true } },
			},
		});

		success(res, { member }, 201);
	}),
);

// PATCH /api/portfolios/:id/members/:memberId — update member notes
router.patch(
	"/:id/members/:memberId",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const group = await prisma.portfolio.findUnique({
			where: { id: req.params.id },
		});
		if (!group || group.userId !== req.userId) {
			throw new NotFoundError("Analysis group");
		}

		const member = await prisma.groupMember.findUnique({
			where: { id: req.params.memberId },
		});
		if (!member || member.portfolioId !== req.params.id) {
			throw new NotFoundError("Group member");
		}

		const data = updateMemberSchema.parse(req.body);
		const updated = await prisma.groupMember.update({
			where: { id: req.params.memberId },
			data,
		});

		success(res, { member: updated });
	}),
);

// DELETE /api/portfolios/:id/members/:memberId — remove commodity from group
router.delete(
	"/:id/members/:memberId",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const group = await prisma.portfolio.findUnique({
			where: { id: req.params.id },
		});
		if (!group || group.userId !== req.userId) {
			throw new NotFoundError("Analysis group");
		}

		const member = await prisma.groupMember.findUnique({
			where: { id: req.params.memberId },
		});
		if (!member || member.portfolioId !== req.params.id) {
			throw new NotFoundError("Group member");
		}

		await prisma.groupMember.delete({ where: { id: req.params.memberId } });
		success(res, { removed: true });
	}),
);

// DELETE /api/portfolios/:id — delete analysis group
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const group = await prisma.portfolio.findUnique({
			where: { id: req.params.id },
		});
		if (!group || group.userId !== req.userId) {
			throw new NotFoundError("Analysis group");
		}

		if (group.isDefault) {
			throw new BadRequestError("Cannot delete default analysis group");
		}

		await prisma.portfolio.delete({ where: { id: req.params.id } });
		success(res, { deleted: true });
	}),
);

export { router as portfolioRouter };
