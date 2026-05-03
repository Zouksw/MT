import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import {
	asyncHandler,
	BadRequestError,
	NotFoundError,
} from "@/middleware/errorHandler";

const router = Router();

const createWatchlistSchema = z.object({
	name: z.string().min(1).max(100),
});

const addItemSchema = z.object({
	commodityId: z.string().uuid(),
	notes: z.string().max(500).optional(),
});

// GET /api/watchlists — list user's watchlists
router.get(
	"/",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const watchlists = await prisma.watchlist.findMany({
			where: { userId: req.userId },
			include: {
				items: {
					include: {
						commodity: {
							select: {
								id: true,
								slug: true,
								name: true,
								nameCn: true,
								category: true,
								unit: true,
							},
						},
					},
					orderBy: { addedAt: "desc" },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// Batch-fetch latest prices for all commodities in one query
		const commodityIds = watchlists.flatMap((wl) =>
			wl.items.map((item) => item.commodityId),
		);
		const latestPrices =
			commodityIds.length > 0
				? await prisma.$queryRaw<
						Array<{ commodityId: string; close: number; date: Date }>
					>`
          SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date
          FROM commodity_prices
          WHERE commodity_id = ANY(${commodityIds}::text[]) AND interval = 'daily'
          ORDER BY commodity_id, date DESC
        `
				: [];
		const priceMap = new Map(latestPrices.map((p) => [p.commodityId, p]));

		const result = watchlists.map((wl) => ({
			id: wl.id,
			name: wl.name,
			isDefault: wl.isDefault,
			itemCount: wl.items.length,
			items: wl.items.map((item) => {
				const price = priceMap.get(item.commodityId);
				return {
					id: item.id,
					commodityId: item.commodityId,
					commodity: {
						slug: item.commodity.slug,
						name: item.commodity.name,
						nameCn: item.commodity.nameCn,
						category: item.commodity.category,
						unit: item.commodity.unit,
					},
					latestPrice: price?.close ?? null,
					latestDate: price?.date ?? null,
					notes: item.notes,
					addedAt: item.addedAt,
				};
			}),
			createdAt: wl.createdAt,
		}));

		success(res, { watchlists: result });
	}),
);

// POST /api/watchlists — create watchlist
router.post(
	"/",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { name } = createWatchlistSchema.parse(req.body);

		const existing = await prisma.watchlist.findUnique({
			where: { userId_name: { userId: req.userId!, name } },
		});
		if (existing) {
			throw new BadRequestError(`Watchlist '${name}' already exists`);
		}

		const watchlist = await prisma.watchlist.create({
			data: { userId: req.userId!, name },
			include: { items: true },
		});

		success(res, { watchlist }, 201);
	}),
);

// PATCH /api/watchlists/:id — rename
router.patch(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { name } = z
			.object({ name: z.string().min(1).max(100) })
			.parse(req.body);

		const existing = await prisma.watchlist.findUnique({
			where: { id: req.params.id },
		});
		if (!existing || existing.userId !== req.userId) {
			throw new NotFoundError("Watchlist");
		}

		const watchlist = await prisma.watchlist.update({
			where: { id: req.params.id },
			data: { name },
		});

		success(res, { watchlist });
	}),
);

// DELETE /api/watchlists/:id — delete watchlist
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const existing = await prisma.watchlist.findUnique({
			where: { id: req.params.id },
		});
		if (!existing || existing.userId !== req.userId) {
			throw new NotFoundError("Watchlist");
		}

		if (existing.isDefault) {
			throw new BadRequestError("Cannot delete default watchlist");
		}

		await prisma.watchlist.delete({ where: { id: req.params.id } });
		success(res, { deleted: true });
	}),
);

// POST /api/watchlists/:id/items — add commodity to watchlist
router.post(
	"/:id/items",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { commodityId, notes } = addItemSchema.parse(req.body);

		const watchlist = await prisma.watchlist.findUnique({
			where: { id: req.params.id },
		});
		if (!watchlist || watchlist.userId !== req.userId) {
			throw new NotFoundError("Watchlist");
		}

		const commodity = await prisma.commodity.findUnique({
			where: { id: commodityId },
		});
		if (!commodity) {
			throw new NotFoundError("Commodity");
		}

		const existing = await prisma.watchlistItem.findUnique({
			where: {
				watchlistId_commodityId: { watchlistId: req.params.id, commodityId },
			},
		});
		if (existing) {
			throw new BadRequestError("Commodity already in watchlist");
		}

		const item = await prisma.watchlistItem.create({
			data: { watchlistId: req.params.id, commodityId, notes },
		});

		success(res, { item }, 201);
	}),
);

// DELETE /api/watchlists/:id/items/:commodityId — remove commodity
router.delete(
	"/:id/items/:commodityId",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const item = await prisma.watchlistItem.findUnique({
			where: {
				watchlistId_commodityId: {
					watchlistId: req.params.id,
					commodityId: req.params.commodityId,
				},
			},
		});

		if (!item) {
			throw new NotFoundError("Watchlist item");
		}

		// Verify ownership
		const watchlist = await prisma.watchlist.findUnique({
			where: { id: req.params.id },
		});
		if (!watchlist || watchlist.userId !== req.userId) {
			throw new NotFoundError("Watchlist");
		}

		await prisma.watchlistItem.delete({ where: { id: item.id } });
		success(res, { deleted: true });
	}),
);

// GET /api/watchlists/:id/quotes — get real-time quotes for all items
router.get(
	"/:id/quotes",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const watchlist = await prisma.watchlist.findUnique({
			where: { id: req.params.id },
			include: {
				items: {
					include: {
						commodity: {
							select: {
								id: true,
								slug: true,
								name: true,
								nameCn: true,
								unit: true,
							},
						},
					},
				},
			},
		});

		if (!watchlist || watchlist.userId !== req.userId) {
			throw new NotFoundError("Watchlist");
		}

		// Batch-fetch latest 2 prices per commodity in one query
		const commodityIds = watchlist.items.map((item) => item.commodityId);
		const recentPrices =
			commodityIds.length > 0
				? await prisma.$queryRaw<
						Array<{
							commodity_id: string;
							close: number;
							date: Date;
							rn: number;
						}>
					>`
          SELECT commodity_id, close, date, ROW_NUMBER() OVER (PARTITION BY commodity_id ORDER BY date DESC) AS rn
          FROM commodity_prices
          WHERE commodity_id = ANY(${commodityIds}::uuid[]) AND interval = 'daily'
        `
				: [];

		// Map: commodityId -> [latest, prev]
		const pricePairs = new Map<string, Array<{ close: number; date: Date }>>();
		for (const p of recentPrices) {
			if (p.rn <= 2) {
				if (!pricePairs.has(p.commodity_id)) pricePairs.set(p.commodity_id, []);
				pricePairs.get(p.commodity_id)?.push(p);
			}
		}

		const quotes = watchlist.items.map((item) => {
			const pair = pricePairs.get(item.commodityId) || [];
			const latest = pair[0];
			const prev = pair[1];
			const close = latest ? Number(latest.close) : null;
			const prevClose = prev ? Number(prev.close) : null;
			const change =
				close != null && prevClose != null ? close - prevClose : null;

			return {
				commodityId: item.commodityId,
				slug: item.commodity.slug,
				name: item.commodity.name,
				nameCn: item.commodity.nameCn,
				unit: item.commodity.unit,
				price: close,
				previousPrice: prevClose,
				change,
				changePercent:
					change != null && prevClose
						? +((change / prevClose) * 100).toFixed(2)
						: null,
				date: latest?.date ?? null,
			};
		});

		success(res, { quotes });
	}),
);

export { router as watchlistRouter };
