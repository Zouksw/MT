/**
 * Watchlist service.
 *
 * Pure functions for watchlist + watchlist-item CRUD and quote aggregation.
 * Routes in `routes/watchlist.ts` own the HTTP boundary (auth, response
 * shaping); this service owns the Prisma queries and the price-batch logic.
 *
 * Ownership is enforced here (not in the route) so non-owners see a 404 with
 * no existence leak — same pattern as datasetService.getDataset.
 */

import { prisma } from "@/lib";
import { BadRequestError, NotFoundError } from "@/middleware/errorHandler";

// ─── Types ───────────────────────────────────────────────────────────────

interface CommoditySummary {
	slug: string;
	name: string;
	nameCn: string | null;
	category: string;
	unit: string;
}

export interface WatchlistSummary {
	id: string;
	name: string;
	isDefault: boolean;
	itemCount: number;
	items: WatchlistItemSummary[];
	createdAt: Date;
}

export interface WatchlistItemSummary {
	id: string;
	commodityId: string;
	commodity: CommoditySummary;
	latestPrice: number | null;
	latestDate: Date | null;
	notes: string | null;
	addedAt: Date;
}

export interface WatchlistQuote {
	commodityId: string;
	slug: string;
	name: string;
	nameCn: string | null;
	unit: string;
	price: number | null;
	previousPrice: number | null;
	change: number | null;
	changePercent: number | null;
	date: Date | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const COMMODITY_SELECT = {
	id: true,
	slug: true,
	name: true,
	nameCn: true,
	category: true,
	unit: true,
} as const;

/**
 * Get a watchlist scoped to its owner. Returns null when missing OR when the
 * caller is not the owner — routes translate null → 404 NotFoundError, so a
 * caller cannot distinguish "does not exist" from "not mine".
 */
async function getOwnedWatchlist(
	id: string,
	userId: string,
): Promise<{ id: string; userId: string; isDefault: boolean } | null> {
	const watchlist = await prisma.watchlist.findUnique({
		where: { id },
		select: { id: true, userId: true, isDefault: true },
	});
	if (!watchlist || watchlist.userId !== userId) return null;
	return watchlist;
}

/**
 * Batch-fetch the latest daily close per commodity (one query regardless of
 * how many items the watchlist has). Used by listWatchlists.
 */
async function batchLatestPrices(
	commodityIds: string[],
): Promise<Map<string, { close: number; date: Date }>> {
	if (commodityIds.length === 0) return new Map();
	const rows = await prisma.$queryRaw<Array<{ commodityId: string; close: number; date: Date }>>`
    SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date
    FROM commodity_prices
    WHERE commodity_id = ANY(${commodityIds}::text[]) AND interval = 'daily'
    ORDER BY commodity_id, date DESC
  `;
	return new Map(rows.map((p) => [p.commodityId, { close: p.close, date: p.date }]));
}

/**
 * Batch-fetch the latest 2 daily closes per commodity (one query). Used by
 * getWatchlistQuotes to compute day-over-day change.
 */
async function batchRecentPricePairs(
	commodityIds: string[],
): Promise<Map<string, Array<{ close: number; date: Date }>>> {
	const pairs = new Map<string, Array<{ close: number; date: Date }>>();
	if (commodityIds.length === 0) return pairs;
	const rows = await prisma.$queryRaw<
		Array<{ commodity_id: string; close: number; date: Date; rn: number }>
	>`
    SELECT commodity_id, close, date,
           ROW_NUMBER() OVER (PARTITION BY commodity_id ORDER BY date DESC) AS rn
    FROM commodity_prices
    WHERE commodity_id = ANY(${commodityIds}::text[]) AND interval = 'daily'
  `;
	for (const p of rows) {
		if (p.rn > 2) continue;
		if (!pairs.has(p.commodity_id)) pairs.set(p.commodity_id, []);
		pairs.get(p.commodity_id)?.push({ close: p.close, date: p.date });
	}
	return pairs;
}

// ─── Public API ──────────────────────────────────────────────────────────

/** List all watchlists for a user, each enriched with latest item prices. */
export async function listWatchlists(userId: string): Promise<WatchlistSummary[]> {
	const watchlists = await prisma.watchlist.findMany({
		where: { userId },
		include: {
			items: {
				include: { commodity: { select: COMMODITY_SELECT } },
				orderBy: { addedAt: "desc" },
			},
		},
		orderBy: { createdAt: "desc" },
	});

	const commodityIds = watchlists.flatMap((wl) => wl.items.map((it) => it.commodityId));
	const priceMap = await batchLatestPrices(commodityIds);

	return watchlists.map((wl) => ({
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
}

/** Create a watchlist. Throws BadRequestError if a same-name list exists. */
export async function createWatchlist(userId: string, name: string) {
	const existing = await prisma.watchlist.findUnique({
		where: { userId_name: { userId, name } },
	});
	if (existing) {
		throw new BadRequestError(`Watchlist '${name}' already exists`);
	}
	return prisma.watchlist.create({
		data: { userId, name },
		include: { items: true },
	});
}

/** Rename a watchlist. Throws NotFoundError if missing or not owned. */
export async function renameWatchlist(id: string, userId: string, name: string) {
	const owned = await getOwnedWatchlist(id, userId);
	if (!owned) throw new NotFoundError("Watchlist");
	return prisma.watchlist.update({ where: { id }, data: { name } });
}

/** Delete a watchlist. Throws NotFoundError if missing/not owned;
 *  BadRequestError if it is the default (undeletable) list. */
export async function deleteWatchlist(id: string, userId: string) {
	const owned = await getOwnedWatchlist(id, userId);
	if (!owned) throw new NotFoundError("Watchlist");
	if (owned.isDefault) throw new BadRequestError("Cannot delete default watchlist");
	await prisma.watchlist.delete({ where: { id } });
}

/** Add a commodity to a watchlist.
 *  Throws NotFoundError for unknown watchlist/commodity; BadRequestError on
 *  duplicate. */
export async function addWatchlistItem(
	id: string,
	userId: string,
	commodityId: string,
	notes?: string,
) {
	const owned = await getOwnedWatchlist(id, userId);
	if (!owned) throw new NotFoundError("Watchlist");

	const commodity = await prisma.commodity.findUnique({ where: { id: commodityId } });
	if (!commodity) throw new NotFoundError("Commodity");

	const existing = await prisma.watchlistItem.findUnique({
		where: { watchlistId_commodityId: { watchlistId: id, commodityId } },
	});
	if (existing) throw new BadRequestError("Commodity already in watchlist");

	return prisma.watchlistItem.create({
		data: { watchlistId: id, commodityId, notes },
	});
}

/** Remove a commodity from a watchlist.
 *  Throws NotFoundError for missing item or non-owned watchlist. */
export async function removeWatchlistItem(id: string, userId: string, commodityId: string) {
	const item = await prisma.watchlistItem.findUnique({
		where: { watchlistId_commodityId: { watchlistId: id, commodityId } },
	});
	if (!item) throw new NotFoundError("Watchlist item");

	const owned = await getOwnedWatchlist(id, userId);
	if (!owned) throw new NotFoundError("Watchlist");

	await prisma.watchlistItem.delete({ where: { id: item.id } });
}

/** Get real-time quotes (latest + previous close + day change) for all items
 *  in a watchlist. Throws NotFoundError if missing/not owned. */
export async function getWatchlistQuotes(id: string, userId: string): Promise<WatchlistQuote[]> {
	const watchlist = await prisma.watchlist.findUnique({
		where: { id },
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
	if (!watchlist || watchlist.userId !== userId) throw new NotFoundError("Watchlist");

	const commodityIds = watchlist.items.map((it) => it.commodityId);
	const pricePairs = await batchRecentPricePairs(commodityIds);

	return watchlist.items.map((item) => {
		const pair = pricePairs.get(item.commodityId) || [];
		const latest = pair[0];
		const prev = pair[1];
		const close = latest ? Number(latest.close) : null;
		const prevClose = prev ? Number(prev.close) : null;
		const change = close != null && prevClose != null ? close - prevClose : null;
		// prevClose === 0 is a legitimate value for some scrap/index series;
		// guard against division by zero with !== 0, not a truthy check that
		// would null out the percent for any sub-1 price.
		const changePercent =
			change != null && prevClose !== null && prevClose !== 0
				? +((change / prevClose) * 100).toFixed(2)
				: null;
		return {
			commodityId: item.commodityId,
			slug: item.commodity.slug,
			name: item.commodity.name,
			nameCn: item.commodity.nameCn,
			unit: item.commodity.unit,
			price: close,
			previousPrice: prevClose,
			change,
			changePercent,
			date: latest?.date ?? null,
		};
	});
}
