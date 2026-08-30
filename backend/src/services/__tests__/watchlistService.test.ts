/**
 * watchlistService — ownership + boundary regression tests.
 *
 * The route→service extraction (Round 29) moved ownership enforcement into
 * getOwnedWatchlist(): non-owners must see a 404 with no existence leak
 * (same contract as datasetService.getDataset). These tests pin that
 * contract directly against the service, covering the paths the route-level
 * tests in user.test.ts don't reach (rename/delete by non-owner, default-
 * list deletion guard, remove-item ownership, quotes ownership).
 *
 * Uses real PostgreSQL (same convention as datasetService.idor.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import {
	addWatchlistItem,
	createWatchlist,
	deleteWatchlist,
	getWatchlistQuotes,
	listWatchlists,
	removeWatchlistItem,
	renameWatchlist,
} from "@/services/watchlistService";

// Fixture state ---------------------------------------------------------

let ownerId: string;
let otherUserId: string;
const createdUserIds: string[] = [];
const createdWatchlistIds: string[] = [];
const createdCommodityIds: string[] = [];

beforeEach(async () => {
	ownerId = (
		await prisma.user.create({
			data: {
				email: `wl-owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`,
				passwordHash: "x",
				name: "WL Owner",
				role: "ADMIN",
			},
		})
	).id;
	createdUserIds.push(ownerId);

	otherUserId = (
		await prisma.user.create({
			data: {
				email: `wl-other-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`,
				passwordHash: "x",
				name: "WL Other",
				role: "EDITOR",
			},
		})
	).id;
	createdUserIds.push(otherUserId);
});

afterEach(async () => {
	// Clean watchlists then users (FK order), plus fixture commodities (prices first).
	await prisma.watchlist.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
	await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
	if (createdCommodityIds.length > 0) {
		await prisma.commodityPrice
			.deleteMany({ where: { commodityId: { in: createdCommodityIds } } })
			.catch(() => {});
		await prisma.commodity
			.deleteMany({ where: { id: { in: createdCommodityIds } } })
			.catch(() => {});
	}
	createdUserIds.length = 0;
	createdWatchlistIds.length = 0;
	createdCommodityIds.length = 0;
});

// Helpers ---------------------------------------------------------------

async function makeList(userId: string, name: string, isDefault = false) {
	// Bypass createWatchlist's duplicate guard + default-flag logic for setup.
	const wl = await prisma.watchlist.create({
		data: { userId, name, isDefault },
	});
	createdWatchlistIds.push(wl.id);
	return wl;
}

// Tests -----------------------------------------------------------------

describe("watchlistService — ownership enforcement", () => {
	it("listWatchlists returns only the caller's lists", async () => {
		await makeList(ownerId, "owner-list");
		await makeList(otherUserId, "other-list");

		const mine = await listWatchlists(ownerId);
		expect(mine).toHaveLength(1);
		expect(mine[0].name).toBe("owner-list");
	});

	it("renameWatchlist by non-owner throws NotFound (no existence leak)", async () => {
		const wl = await makeList(ownerId, "mine");
		await expect(renameWatchlist(wl.id, otherUserId, "hijacked")).rejects.toThrow(NotFoundError);
		// Name unchanged
		const check = await prisma.watchlist.findUnique({ where: { id: wl.id } });
		expect(check?.name).toBe("mine");
	});

	it("renameWatchlist on a missing id throws NotFound", async () => {
		await expect(renameWatchlist("nonexistent-id", ownerId, "x")).rejects.toThrow(NotFoundError);
	});

	it("deleteWatchlist by non-owner throws NotFound", async () => {
		const wl = await makeList(ownerId, "mine");
		await expect(deleteWatchlist(wl.id, otherUserId)).rejects.toThrow(NotFoundError);
		// Still exists
		const check = await prisma.watchlist.findUnique({ where: { id: wl.id } });
		expect(check).not.toBeNull();
	});

	it("deleteWatchlist on the default list throws BadRequest", async () => {
		const wl = await makeList(ownerId, "default", true);
		await expect(deleteWatchlist(wl.id, ownerId)).rejects.toThrow(BadRequestError);
	});

	it("createWatchlist rejects a duplicate name for the same user", async () => {
		await createWatchlist(ownerId, "dup");
		await expect(createWatchlist(ownerId, "dup")).rejects.toThrow(BadRequestError);
	});

	it("createWatchlist allows the same name across different users", async () => {
		await createWatchlist(ownerId, "shared-name");
		// Different user — must NOT throw.
		await expect(createWatchlist(otherUserId, "shared-name")).resolves.toBeDefined();
	});

	it("addWatchlistItem by non-owner throws NotFound", async () => {
		const wl = await makeList(ownerId, "mine");
		const commodity = await prisma.commodity.findFirst({});
		await expect(addWatchlistItem(wl.id, otherUserId, commodity!.id)).rejects.toThrow(
			NotFoundError,
		);
	});

	it("removeWatchlistItem by non-owner throws NotFound", async () => {
		const wl = await makeList(ownerId, "mine");
		const commodity = await prisma.commodity.findFirst({});
		await prisma.watchlistItem.create({
			data: { watchlistId: wl.id, commodityId: commodity!.id },
		});
		await expect(removeWatchlistItem(wl.id, otherUserId, commodity!.id)).rejects.toThrow(
			NotFoundError,
		);
	});

	it("getWatchlistQuotes by non-owner throws NotFound", async () => {
		const wl = await makeList(ownerId, "mine");
		await expect(getWatchlistQuotes(wl.id, otherUserId)).rejects.toThrow(NotFoundError);
	});

	it("getWatchlistQuotes returns [] for an empty list (owned)", async () => {
		const wl = await makeList(ownerId, "empty");
		const quotes = await getWatchlistQuotes(wl.id, ownerId);
		expect(quotes).toEqual([]);
	});

	it("getWatchlistQuotes runs the price-pair batch query without a type-cast error (regression)", async () => {
		// Regression: the original route used ::uuid[] but commodity_id is a
		// text column → "operator does not exist: text = uuid". This test
		// exercises the populated path so the raw SQL actually runs.
		const wl = await makeList(ownerId, "with-item");
		const commodity = await prisma.commodity.findFirst({});
		await prisma.watchlistItem.create({
			data: { watchlistId: wl.id, commodityId: commodity!.id },
		});
		// Must not throw; structure must be correct regardless of whether the
		// commodity has price rows.
		const quotes = await getWatchlistQuotes(wl.id, ownerId);
		expect(quotes).toHaveLength(1);
		expect(quotes[0]).toHaveProperty("commodityId", commodity!.id);
		expect(quotes[0]).toHaveProperty("price");
		expect(quotes[0]).toHaveProperty("changePercent");
	});

	it("getWatchlistQuotes reads the authoritative source for brl_usd (fred ~5.0, not exchange_rate_api ~0.197) (round-67)", async () => {
		// Round-67 regression: batchRecentPricePairs previously had no source
		// filter in its raw SQL, so conflict commodities (brl_usd) surfaced the
		// wrong source's price. brl_usd must now read fred (~5.0).
		const brl = await prisma.commodity.findFirst({ where: { slug: "brl_usd" } });
		expect(brl).toBeTruthy();
		const wl = await makeList(ownerId, "brl-source");
		await prisma.watchlistItem.create({
			data: { watchlistId: wl.id, commodityId: brl!.id },
		});
		const quotes = await getWatchlistQuotes(wl.id, ownerId);
		expect(quotes).toHaveLength(1);
		const price = quotes[0].price;
		expect(price).not.toBeNull();
		// fred scale (~5.0), NOT exchange_rate_api scale (~0.197).
		expect(Number(price)).toBeGreaterThan(4);
		expect(Number(price)).toBeLessThan(6);
	});

	it("listWatchlists reads the authoritative source for brl_usd latestPrice (round-67)", async () => {
		// Round-67 regression: batchLatestPrices previously had no source
		// filter. The watchlist summary's latestPrice for brl_usd must read
		// fred (~5.0).
		const brl = await prisma.commodity.findFirst({ where: { slug: "brl_usd" } });
		expect(brl).toBeTruthy();
		const wl = await makeList(ownerId, "brl-list-source");
		await prisma.watchlistItem.create({
			data: { watchlistId: wl.id, commodityId: brl!.id },
		});
		const lists = await listWatchlists(ownerId);
		const target = lists.find((l) => l.id === wl.id);
		expect(target).toBeDefined();
		const item = target!.items.find((it) => it.commodityId === brl!.id);
		expect(item).toBeDefined();
		const price = item!.latestPrice;
		expect(price).not.toBeNull();
		// fred scale (~5.0), NOT exchange_rate_api scale (~0.197).
		expect(Number(price)).toBeGreaterThan(4);
		expect(Number(price)).toBeLessThan(6);
	});

	it("listWatchlists resolves a monthly-only commodity's latestPrice via the monthly fallback (round-132)", async () => {
		// Round-132 regression: the watchlist-local latest-price copy was
		// daily-only, so monthly-only series showed "（暂无价格）". listWatchlists
		// must now fall back to the latest monthly close.
		const slug = `wl-monthly-${Date.now()}`;
		const commodity = await prisma.commodity.create({
			data: {
				slug,
				name: "WL Monthly Fixture",
				category: "beef",
				unit: "CNY/kg",
				prices: {
					create: [
						{
							close: 100,
							date: new Date("2026-06-01T00:00:00Z"),
							interval: "monthly",
							source: "fixture",
						},
						{
							close: 110,
							date: new Date("2026-07-01T00:00:00Z"),
							interval: "monthly",
							source: "fixture",
						},
					],
				},
			},
		});
		createdCommodityIds.push(commodity.id);
		const wl = await makeList(ownerId, "monthly-latest");
		await prisma.watchlistItem.create({
			data: { watchlistId: wl.id, commodityId: commodity.id },
		});

		const lists = await listWatchlists(ownerId);
		const item = lists
			.find((l) => l.id === wl.id)!
			.items.find((it) => it.commodityId === commodity.id)!;
		// Raw-SQL numerics arrive as Prisma Decimal — compare numerically
		// (same convention as the round-67 test below/above).
		expect(Number(item.latestPrice)).toBe(110);
		expect(item.latestDate).toEqual(new Date("2026-07-01T00:00:00Z"));
	});

	it("getWatchlistQuotes resolves a monthly-only commodity's price + month-over-month change (round-132)", async () => {
		// Round-132 regression: batchRecentPricePairs was daily-only too, so the
		// quotes view showed no price for monthly series. The fallback yields the
		// latest 2 monthly closes: change becomes month-over-month.
		const slug = `wl-monthly-q-${Date.now()}`;
		const commodity = await prisma.commodity.create({
			data: {
				slug,
				name: "WL Monthly Quotes Fixture",
				category: "beef",
				unit: "CNY/kg",
				prices: {
					create: [
						{
							close: 200,
							date: new Date("2026-05-01T00:00:00Z"),
							interval: "monthly",
							source: "fixture",
						},
						{
							close: 220,
							date: new Date("2026-06-01T00:00:00Z"),
							interval: "monthly",
							source: "fixture",
						},
						{
							close: 231,
							date: new Date("2026-07-01T00:00:00Z"),
							interval: "monthly",
							source: "fixture",
						},
					],
				},
			},
		});
		createdCommodityIds.push(commodity.id);
		const wl = await makeList(ownerId, "monthly-quotes");
		await prisma.watchlistItem.create({
			data: { watchlistId: wl.id, commodityId: commodity.id },
		});

		const quotes = await getWatchlistQuotes(wl.id, ownerId);
		expect(quotes).toHaveLength(1);
		expect(quotes[0].price).toBe(231);
		expect(quotes[0].previousPrice).toBe(220);
		expect(quotes[0].change).toBe(11);
		expect(quotes[0].changePercent).toBe(5);
	});
});
