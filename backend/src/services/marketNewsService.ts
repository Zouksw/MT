/**
 * Market News service (资讯 / 牧集网-style market dynamics feed).
 *
 * Pure functions — no HTTP knowledge. Routes pass in userId + validated
 * payloads; the service talks to Prisma and throws ApiError subclasses
 * (BadRequestError / NotFoundError / ForbiddenError) that asyncHandler
 * routes to the central errorHandler.
 *
 * Ownership model: news is editable by its author OR any ADMIN. Editors can
 * author but not edit others' posts. A not-owned post is reported as
 * NotFoundError (not Forbidden) to avoid leaking existence — same pattern as
 * watchlistService's getOwnedWatchlist.
 */

import type { NewsCategory } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib";
import { BadRequestError, NotFoundError } from "@/middleware/errorHandler";

export interface NewsListItem {
	id: string;
	title: string;
	slug: string;
	summary: string;
	category: NewsCategory;
	source: string;
	commoditySlug: string | null;
	tags: string[];
	status: string;
	viewCount: number;
	publishedAt: Date;
	author: { id: string; name: string };
}

export interface NewsDetail extends NewsListItem {
	body: string;
	sourceUrl: string | null;
	relatedSlugs: string[] | null;
	coverImageUrl: string | null;
	createdAt: Date;
	updatedAt: Date | null;
}

export interface CreateNewsInput {
	title: string;
	summary: string;
	body: string;
	category: NewsCategory;
	source: string;
	sourceUrl?: string | null;
	commoditySlug?: string | null;
	relatedSlugs?: string[] | null;
	coverImageUrl?: string | null;
	tags?: string[];
	status?: string;
	publishedAt?: Date;
}

export type UpdateNewsInput = Partial<CreateNewsInput>;

export interface ListNewsParams {
	skip: number;
	take: number;
	search?: string;
	category?: NewsCategory;
	status?: string;
	commoditySlug?: string;
}

/** Title → URL-safe slug. Reused by create/update when the slug isn't given. */
export function slugifyTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Fetch a news post if it exists AND the user may manage it (author or ADMIN). */
async function getManagedNews(id: string, userId: string, userRole: string) {
	const post = await prisma.marketNews.findUnique({
		where: { id },
		select: { id: true, authorId: true, slug: true },
	});
	if (!post) return null;
	if (post.authorId !== userId && userRole !== "ADMIN") return null;
	return post;
}

/** List news with filters + pagination, ordered newest-first. */
export async function listNews(params: ListNewsParams): Promise<{
	news: NewsListItem[];
	total: number;
}> {
	const where: Record<string, unknown> = {};
	if (params.search) {
		where.OR = [
			{ title: { contains: params.search, mode: "insensitive" } },
			{ summary: { contains: params.search, mode: "insensitive" } },
		];
	}
	if (params.category) where.category = params.category;
	if (params.status) where.status = params.status;
	if (params.commoditySlug) where.commoditySlug = params.commoditySlug;

	const [rows, total] = await Promise.all([
		prisma.marketNews.findMany({
			where,
			orderBy: { publishedAt: "desc" },
			skip: params.skip,
			take: params.take,
			select: {
				id: true,
				title: true,
				slug: true,
				summary: true,
				category: true,
				source: true,
				commoditySlug: true,
				tags: true,
				status: true,
				viewCount: true,
				publishedAt: true,
				author: { select: { id: true, name: true } },
			},
		}),
		prisma.marketNews.count({ where }),
	]);

	return { news: rows as NewsListItem[], total };
}

/** Get a single news post by id (public read — includes author). */
export async function getNewsById(id: string): Promise<NewsDetail> {
	const post = await prisma.marketNews.findUnique({
		where: { id },
		select: {
			id: true,
			title: true,
			slug: true,
			summary: true,
			body: true,
			category: true,
			source: true,
			sourceUrl: true,
			commoditySlug: true,
			relatedSlugs: true,
			coverImageUrl: true,
			tags: true,
			status: true,
			viewCount: true,
			publishedAt: true,
			createdAt: true,
			updatedAt: true,
			author: { select: { id: true, name: true } },
		},
	});
	if (!post) throw new NotFoundError("News article");
	return post as NewsDetail;
}

/** Atomically bump the view counter. Non-blocking — failures are fine. */
export async function incrementView(id: string): Promise<void> {
	try {
		await prisma.marketNews.update({
			where: { id },
			data: { viewCount: { increment: 1 } },
		});
	} catch {
		// Missing id between fetch + increment is harmless for a view counter.
	}
}

/** Aggregate counts for the list-page stat cards. */
export async function getNewsStats(): Promise<{
	total: number;
	published: number;
	drafts: number;
	thisWeek: number;
}> {
	const now = new Date();
	const weekAgo = new Date(now.getTime() - 7 * 86400000);
	const [total, published, drafts, thisWeek] = await Promise.all([
		prisma.marketNews.count(),
		prisma.marketNews.count({ where: { status: "published" } }),
		prisma.marketNews.count({ where: { status: "draft" } }),
		prisma.marketNews.count({ where: { publishedAt: { gte: weekAgo } } }),
	]);
	return { total, published, drafts, thisWeek };
}

/** Create a news post. Slug derived from title; authorId from the caller. */
export async function createNews(userId: string, input: CreateNewsInput): Promise<NewsDetail> {
	const slug = slugifyTitle(input.title);

	// Guard against a duplicate slug — the @unique constraint would throw a
	// raw P2002 otherwise. Surface a friendly 400 instead.
	const existing = await prisma.marketNews.findUnique({ where: { slug }, select: { id: true } });
	if (existing) {
		throw new BadRequestError("A news article with that title already exists");
	}

	const post = await prisma.marketNews.create({
		data: {
			title: input.title,
			slug,
			summary: input.summary,
			body: input.body,
			category: input.category,
			source: input.source,
			sourceUrl: input.sourceUrl ?? null,
			commoditySlug: input.commoditySlug ?? null,
			relatedSlugs:
				input.relatedSlugs == null
					? Prisma.JsonNull
					: (input.relatedSlugs as Prisma.InputJsonValue),
			coverImageUrl: input.coverImageUrl ?? null,
			tags: input.tags ?? [],
			status: input.status ?? "published",
			authorId: userId,
			publishedAt: input.publishedAt ?? new Date(),
		},
		select: {
			id: true,
			title: true,
			slug: true,
			summary: true,
			body: true,
			category: true,
			source: true,
			sourceUrl: true,
			commoditySlug: true,
			relatedSlugs: true,
			coverImageUrl: true,
			tags: true,
			status: true,
			viewCount: true,
			publishedAt: true,
			createdAt: true,
			updatedAt: true,
			author: { select: { id: true, name: true } },
		},
	});
	return post as unknown as NewsDetail;
}

/** Update a news post. Only the author or an ADMIN may edit. */
export async function updateNews(
	id: string,
	userId: string,
	userRole: string,
	input: UpdateNewsInput,
): Promise<NewsDetail> {
	const owned = await getManagedNews(id, userId, userRole);
	if (!owned) throw new NotFoundError("News article");

	// If the title changed, regenerate the slug (collision-checked).
	let slug: string | undefined;
	if (input.title?.trim()) {
		slug = slugifyTitle(input.title);
		const clash = await prisma.marketNews.findFirst({
			where: { slug, NOT: { id } },
			select: { id: true },
		});
		if (clash) throw new BadRequestError("That title is already in use");
	}

	const post = await prisma.marketNews.update({
		where: { id },
		data: {
			...(input.title !== undefined && { title: input.title }),
			...(slug && { slug }),
			...(input.summary !== undefined && { summary: input.summary }),
			...(input.body !== undefined && { body: input.body }),
			...(input.category !== undefined && { category: input.category }),
			...(input.source !== undefined && { source: input.source }),
			...(input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl }),
			...(input.commoditySlug !== undefined && { commoditySlug: input.commoditySlug }),
			...(input.relatedSlugs !== undefined && {
				relatedSlugs:
					input.relatedSlugs == null
						? Prisma.JsonNull
						: (input.relatedSlugs as Prisma.InputJsonValue),
			}),
			...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
			...(input.tags !== undefined && { tags: input.tags }),
			...(input.status !== undefined && { status: input.status }),
			...(input.publishedAt !== undefined && { publishedAt: input.publishedAt }),
		},
		select: {
			id: true,
			title: true,
			slug: true,
			summary: true,
			body: true,
			category: true,
			source: true,
			sourceUrl: true,
			commoditySlug: true,
			relatedSlugs: true,
			coverImageUrl: true,
			tags: true,
			status: true,
			viewCount: true,
			publishedAt: true,
			createdAt: true,
			updatedAt: true,
			author: { select: { id: true, name: true } },
		},
	});
	return post as unknown as NewsDetail;
}

/** Delete a news post. Only the author or an ADMIN may delete. */
export async function deleteNews(id: string, userId: string, userRole: string): Promise<void> {
	const owned = await getManagedNews(id, userId, userRole);
	if (!owned) throw new NotFoundError("News article");
	await prisma.marketNews.delete({ where: { id } });
}
