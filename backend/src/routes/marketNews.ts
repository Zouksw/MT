/**
 * Market News routes (资讯 / 牧集网-style market dynamics feed).
 *
 * Thin route layer — delegates to marketNewsService. Mirrors the watchlist
 * pattern: authenticate per-route, asyncHandler wraps, Zod validates,
 * success() shapes the response.
 *
 * Permission model:
 *  - READ (list/get): any authenticated user.
 *  - WRITE (create/update/delete): EDITOR and ADMIN only. VIEWER (free tier)
 *    gets 403. Author or ADMIN may edit/delete a specific post.
 */

import { Router } from "express";
import { z } from "zod";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, ForbiddenError, NotFoundError } from "@/middleware/errorHandler";
import {
	createNews,
	deleteNews,
	getNewsById,
	getNewsStats,
	incrementView,
	listNews,
	updateNews,
} from "@/services/marketNewsService";

const router = Router();

const NEWS_CATEGORIES = [
	"PRICE_MOVE",
	"SUPPLY",
	"TRADE_POLICY",
	"MARKET_INSIGHT",
	"COMPANY",
] as const;

const categorySchema = z.enum(NEWS_CATEGORIES);

const createNewsSchema = z.object({
	title: z.string().min(1).max(200),
	summary: z.string().min(1).max(500),
	body: z.string().min(1),
	category: categorySchema,
	source: z.string().min(1).max(100),
	sourceUrl: z.string().url().optional().nullable(),
	commoditySlug: z.string().optional().nullable(),
	relatedSlugs: z.array(z.string()).optional().nullable(),
	coverImageUrl: z.string().url().optional().nullable(),
	tags: z.array(z.string()).optional(),
	status: z.enum(["published", "draft"]).optional(),
	publishedAt: z.coerce.date().optional(),
});

const updateNewsSchema = createNewsSchema.partial();

/** Guard: only EDITOR / ADMIN may author or manage news. */
function requireEditorRole(req: AuthenticatedRequest) {
	if (req.user.role !== "EDITOR" && req.user.role !== "ADMIN") {
		throw new ForbiddenError("News authoring requires an Editor or Admin role.");
	}
}

// GET /api/news — list (paginated, filterable). The frontend useList helper
// sends `pageSize`; paginationSchema in @/schemas/common reads `limit`. Accept
// both here so the existing convention doesn't silently cap at the default.
router.get(
	"/",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const limit = Number(req.query.pageSize) || Number(req.query.limit) || 20;
		const page = Number(req.query.page) || 1;
		const skip = (page - 1) * limit;

		const category = req.query.category ? categorySchema.parse(req.query.category) : undefined;
		// Draft visibility (round-105): drafts are editorial material. Without
		// EDITOR/ADMIN the listing is forced to published — including when the
		// query string asks for drafts (previously any authenticated VIEWER
		// saw every draft via the unfiltered default).
		const canManage = req.user.role === "EDITOR" || req.user.role === "ADMIN";
		const status =
			canManage && req.query.status
				? String(req.query.status)
				: canManage
					? undefined
					: "published";
		const { news, total } = await listNews({
			skip,
			take: limit,
			search: req.query.search ? String(req.query.search) : undefined,
			category,
			status,
			commoditySlug: req.query.commoditySlug ? String(req.query.commoditySlug) : undefined,
		});

		res.json({
			success: true,
			data: news,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
			total,
		});
	}),
);

// GET /api/news/stats — counts for the list-page stat cards.
router.get(
	"/stats",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		// Drafts tally is editorial info (round-105): non-editors get
		// published-only counts; the frontend falls back to `?? 0` for drafts.
		const canManage = req.user.role === "EDITOR" || req.user.role === "ADMIN";
		const stats = await getNewsStats(!canManage);
		success(res, stats);
	}),
);

// GET /api/news/:id — single article (bumps view count).
router.get(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const post = await getNewsById(req.params.id);
		// Draft visibility (round-105): a draft is indistinguishable from a
		// missing article to non-editors — no-disclosure 404, no view bump.
		if (post.status === "draft" && req.user.role !== "EDITOR" && req.user.role !== "ADMIN") {
			throw new NotFoundError("Article not found");
		}
		// Fire-and-forget view bump — don't block the response on it.
		void incrementView(req.params.id);
		success(res, post);
	}),
);

// POST /api/news — create (EDITOR/ADMIN only).
router.post(
	"/",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		requireEditorRole(req);
		const input = createNewsSchema.parse(req.body);
		const post = await createNews(req.userId, input);
		success(res, post, 201);
	}),
);

// PATCH /api/news/:id — update (author or ADMIN).
router.patch(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		requireEditorRole(req);
		const input = updateNewsSchema.parse(req.body);
		const post = await updateNews(req.params.id, req.userId, req.user.role, input);
		success(res, post);
	}),
);

// DELETE /api/news/:id — delete (author or ADMIN).
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		requireEditorRole(req);
		await deleteNews(req.params.id, req.userId, req.user.role);
		success(res, { deleted: true });
	}),
);

export { router as marketNewsRouter };
