/**
 * Market data query service.
 *
 * Pure read-side functions for commodities, prices, factors, and freshness.
 * Routes in `routes/marketData.ts` own the HTTP boundary (auth, caching,
 * response shaping) and delegate the Prisma queries + business aggregation
 * here. Write-side / scraper-coupled operations (CSV import, source refresh,
 * source health) stay in the route layer because they bind to the HTTP
 * request (file upload) or the scraper manager.
 */

import { prisma } from "@/lib";
import { MS_PER_DAY, MS_PER_WEEK } from "@/lib/constants";
import { NotFoundError } from "@/middleware/errorHandler";
import { getDataHealth } from "@/services/dataHealth";
import { authoritativeSourceWhere } from "@/services/inference/authoritativeSources";

export interface PriceHistoryParams {
	interval: "daily" | "weekly" | "monthly";
	from?: Date;
	to?: Date;
	limit: number;
}

/** List active commodities with their latest price, ordered by category. */
export async function listCommodities() {
	const commodities = await prisma.commodity.findMany({
		where: { isActive: true },
		orderBy: { category: "asc" },
		include: {
			prices: {
				orderBy: { date: "desc" },
				take: 1,
				select: { close: true, date: true },
			},
		},
	});

	return commodities.map((c) => ({
		id: c.id,
		slug: c.slug,
		name: c.name,
		nameCn: c.nameCn,
		category: c.category,
		subcategory: c.subcategory,
		grade: c.grade,
		originCountry: c.originCountry,
		unit: c.unit,
		currency: c.currency,
		latestPrice: c.prices[0]?.close ?? null,
		latestDate: c.prices[0]?.date ?? null,
	}));
}

/** Get a commodity by slug or throw NotFoundError. */
export async function requireCommodity(slug: string) {
	const commodity = await prisma.commodity.findUnique({ where: { slug } });
	if (!commodity) throw new NotFoundError(`Commodity '${slug}'`);
	return commodity;
}

/** Latest price row for a commodity (newest by date). */
export async function getLatestPrice(slug: string) {
	const commodity = await requireCommodity(slug);
	const prices = await prisma.commodityPrice.findMany({
		where: {
			commodityId: commodity.id,
			...authoritativeSourceWhere(commodity.slug),
		},
		orderBy: { date: "desc" },
		take: 1,
	});
	return { commodity, price: prices[0] ?? null };
}

/** Price history for a commodity filtered by interval/range/limit. */
export async function getPriceHistory(slug: string, params: PriceHistoryParams) {
	const commodity = await requireCommodity(slug);

	const where: Record<string, unknown> = {
		commodityId: commodity.id,
		interval: params.interval,
		...authoritativeSourceWhere(commodity.slug),
	};
	if (params.from || params.to) {
		where.date = {
			...(params.from && { gte: params.from }),
			...(params.to && { lte: params.to }),
		};
	}

	const prices = await prisma.commodityPrice.findMany({
		where,
		orderBy: { date: "asc" },
		take: params.limit,
	});

	return { commodity, prices };
}

/**
 * Prices for a commodity grouped by source — each source becomes a series of
 * {date, close} points. Used for multi-source comparison charts.
 */
export async function getPricesBySource(slug: string, interval: string, limit: number) {
	const commodity = await requireCommodity(slug);

	const prices = await prisma.commodityPrice.findMany({
		where: { commodityId: commodity.id, interval },
		orderBy: { date: "asc" },
		take: limit,
		select: { date: true, close: true, source: true, interval: true },
	});

	const bySource = new Map<string, Array<{ date: string; close: number }>>();
	for (const p of prices) {
		if (!bySource.has(p.source)) bySource.set(p.source, []);
		bySource.get(p.source)?.push({
			date: p.date.toISOString().slice(0, 10),
			close: Number(p.close),
		});
	}

	return {
		commodity: {
			id: commodity.id,
			slug: commodity.slug,
			name: commodity.name,
			unit: commodity.unit,
		},
		interval,
		sources: Object.fromEntries(bySource),
		sourceCount: bySource.size,
	};
}

/** Fundamental market factors relevant to a commodity (last 30 days). */
export async function getFundamentals(slug: string) {
	const commodity = await requireCommodity(slug);

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	// Filter factors relevant to the commodity's category/currency
	const relevantRegions: string[] = [];
	if (commodity.currency === "CNY") relevantRegions.push("USD/CNY");
	if (commodity.currency === "AUD" || commodity.category === "beef_cuts")
		relevantRegions.push("AUD/USD");
	if (commodity.currency === "BRL" || commodity.category === "beef_cuts")
		relevantRegions.push("BRL/USD");

	const factors = await prisma.marketFactor.findMany({
		where: {
			date: { gte: thirtyDaysAgo },
			...(relevantRegions.length > 0 ? { region: { in: relevantRegions } } : {}),
		},
		orderBy: { date: "desc" },
		take: 200,
	});

	return {
		commodity: { id: commodity.id, slug: commodity.slug, category: commodity.category },
		factors,
	};
}

/** Latest exchange-rate factor per region (last 7 days). */
export async function getLatestExchangeRates() {
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

	const rates = await prisma.marketFactor.findMany({
		where: { type: "exchange_rate", date: { gte: sevenDaysAgo } },
		orderBy: { date: "desc" },
	});

	const latest = new Map<string, (typeof rates)[0]>();
	for (const rate of rates) {
		const key = rate.region || "unknown";
		if (!latest.has(key)) latest.set(key, rate);
	}
	return Array.from(latest.values());
}

/**
 * Per-commodity data freshness — last daily price date for each commodity.
 * Stale threshold is one week (price data is daily). Mirrors the
 * `/commodities/freshness` endpoint.
 */
export async function getCommodityFreshness() {
	const now = new Date();
	const staleThreshold = new Date(now.getTime() - MS_PER_WEEK);

	const latestPrices = await prisma.commodityPrice.groupBy({
		by: ["commodityId"],
		where: { interval: "daily" },
		_max: { date: true },
	});

	const lastByCommodity = new Map<string, Date>();
	for (const row of latestPrices) {
		const d = row._max.date;
		if (d) lastByCommodity.set(row.commodityId, d);
	}

	const commodities = await prisma.commodity.findMany({
		select: {
			id: true,
			slug: true,
			name: true,
			category: true,
			isActive: true,
		},
		orderBy: { name: "asc" },
	});

	const items = commodities.map((c) => {
		const lastUpdated = lastByCommodity.get(c.id) ?? null;
		return {
			id: c.id,
			slug: c.slug,
			name: c.name,
			category: c.category,
			isActive: c.isActive,
			lastUpdated,
			stale: lastUpdated ? lastUpdated < staleThreshold : true,
		};
	});

	const withData = items.filter((i) => i.lastUpdated !== null);
	const stale = items.filter((i) => i.stale);

	return {
		commodities: items,
		summary: {
			total: items.length,
			withData: withData.length,
			stale: stale.length,
			noData: items.filter((i) => i.lastUpdated === null).length,
			coverage: items.length > 0 ? Math.round((withData.length / items.length) * 100) : 0,
		},
	};
}

/** Ingestion freshness (success rate per source over the last 7 days). */
export async function getSourceFreshness() {
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - MS_PER_WEEK);

	const recentLogs = await prisma.ingestionLog.findMany({
		where: { createdAt: { gte: sevenDaysAgo } },
		orderBy: { createdAt: "desc" },
	});

	const sourceStats = new Map<
		string,
		{
			total: number;
			success: number;
			lastRun: Date | null;
			lastInserted: number;
			lastUpdated: number;
		}
	>();
	for (const log of recentLogs) {
		const stat = sourceStats.get(log.source) || {
			total: 0,
			success: 0,
			lastRun: null as Date | null,
			lastInserted: 0,
			lastUpdated: 0,
		};
		stat.total++;
		if (log.status === "success") stat.success++;
		if (!stat.lastRun || log.createdAt > stat.lastRun) {
			stat.lastRun = log.createdAt;
			stat.lastInserted = log.inserted;
			stat.lastUpdated = log.updated;
		}
		sourceStats.set(log.source, stat);
	}

	const freshness = Array.from(sourceStats.entries()).map(([source, stat]) => ({
		source,
		successRate: stat.total > 0 ? Math.round((stat.success / stat.total) * 100) : 0,
		lastRun: stat.lastRun,
		stale: stat.lastRun ? now.getTime() - stat.lastRun.getTime() > MS_PER_DAY : true,
		lastInserted: stat.lastInserted,
		lastUpdated: stat.lastUpdated,
		totalRuns: stat.total,
	}));

	const staleSources = freshness.filter((f) => f.stale);
	const healthySources = freshness.filter((f) => !f.stale);

	// Data-health snapshot (round-48): the freshness summary above tracks
	// scraper RUNS (ingestion logs), which can show "healthy" while the actual
	// price writes are 0 (silent failures) or while predictions pile up
	// unverifiable. getDataHealth reads the actual price tables + prediction
	// verification debt, so the board sees both "scrapers ran" AND "data is
	// real + predictions verify". Best-effort: a failure doesn't break the
	// existing freshness response.
	let dataHealth: Record<string, unknown> | null = null;
	try {
		const dh = await getDataHealth(3);
		dataHealth = {
			anyDataFlowing: dh.anyDataFlowing,
			freshSourceCount: dh.freshSourceCount,
			registeredSourceCount: dh.registeredSourceCount,
			predictionBacklog: dh.predictionBacklog,
			predictionVerified: dh.predictionVerified,
			predictionStale: dh.predictionStale,
			verificationRatio: dh.verificationRatio,
			hasVerificationDebt: dh.hasVerificationDebt,
		};
	} catch {
		// Keep null — the freshness fields above still answer.
	}

	return {
		freshness,
		summary: {
			total: freshness.length,
			healthy: healthySources.length,
			stale: staleSources.length,
			staleSources: staleSources.map((s) => s.source),
			// Actual data writes + prediction verification debt (round-48).
			// Differs from healthy/stale above: those count scraper runs, this
			// counts real price rows written + whether predictions can verify.
			dataHealth,
		},
	};
}
