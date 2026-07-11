import { Router } from "express";
import { z } from "zod";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/errorHandler";
import {
	addWatchlistItem,
	createWatchlist,
	deleteWatchlist,
	getWatchlistQuotes,
	listWatchlists,
	removeWatchlistItem,
	renameWatchlist,
} from "@/services/watchlistService";

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
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const watchlists = await listWatchlists(req.userId);
		success(res, { watchlists });
	}),
);

// POST /api/watchlists — create watchlist
router.post(
	"/",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { name } = createWatchlistSchema.parse(req.body);
		const watchlist = await createWatchlist(req.userId, name);
		success(res, { watchlist }, 201);
	}),
);

// PATCH /api/watchlists/:id — rename
router.patch(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
		const watchlist = await renameWatchlist(req.params.id, req.userId, name);
		success(res, { watchlist });
	}),
);

// DELETE /api/watchlists/:id — delete watchlist
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		await deleteWatchlist(req.params.id, req.userId);
		success(res, { deleted: true });
	}),
);

// POST /api/watchlists/:id/items — add commodity to watchlist
router.post(
	"/:id/items",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { commodityId, notes } = addItemSchema.parse(req.body);
		const item = await addWatchlistItem(req.params.id, req.userId, commodityId, notes);
		success(res, { item }, 201);
	}),
);

// DELETE /api/watchlists/:id/items/:commodityId — remove commodity
router.delete(
	"/:id/items/:commodityId",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		await removeWatchlistItem(req.params.id, req.userId, req.params.commodityId);
		success(res, { deleted: true });
	}),
);

// GET /api/watchlists/:id/quotes — get real-time quotes for all items
router.get(
	"/:id/quotes",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const quotes = await getWatchlistQuotes(req.params.id, req.userId);
		success(res, { quotes });
	}),
);

export { router as watchlistRouter };
