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

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib";
import { MS_PER_DAY, MS_PER_WEEK } from "@/lib/constants";
import { NotFoundError } from "@/middleware/errorHandler";
import { stalenessWindowDays } from "@/services/cadence";
import { getDataHealth } from "@/services/dataHealth";
import {
	authoritativeSourceWhere,
	batchLatestPrices,
} from "@/services/inference/authoritativeSources";

export interface PriceHistoryParams {
	interval: "daily" | "weekly" | "monthly";
	from?: Date;
	to?: Date;
	limit: number;
}

/**
 * List active commodities with their latest price, ordered by category.
 *
 * Round-67: the latest price is fetched via a batched query with authoritative-
 * source resolution, rather than a Prisma relation include. The relation
 * include (`include.prices`) couldn't apply source filtering, so conflict
 * commodities (brl_usd etc.) surfaced whichever source wrote most recently —
 * e.g. brl_usd listed at ~0.197 (exchange_rate_api) instead of ~5.0 (fred).
 * Round-87: migrated from `findMany` + JS-dedupe (which fetched the entire
 * daily history, 65k+ rows) to `batchLatestPrices` using `DISTINCT ON` (one
 * row per commodity resolved in Postgres).
 */
export async function listCommodities() {
	const commodities = await prisma.commodity.findMany({
		where: { isActive: true },
		orderBy: { category: "asc" },
		select: {
			id: true,
			slug: true,
			name: true,
			nameCn: true,
			category: true,
			subcategory: true,
			grade: true,
			originCountry: true,
			unit: true,
			currency: true,
		},
	});

	// Batched authoritative latest-price lookup via DISTINCT ON (round-87).
	// Previously fetched the ENTIRE daily history for all commodities (65k+
	// rows) into Node then deduped in JS. DISTINCT ON collapses to one row
	// per commodity in Postgres before any rows cross the wire.
	const latestByCommodity = await batchLatestPrices(commodities);

	return commodities.map((c) => {
		const latest = latestByCommodity.get(c.id);
		return {
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
			// Cadence of the row latestPrice came from (round-129 batch 7):
			// monthly-only series report "monthly" so consumers can hide
			// meaningless daily/weekly timeframe options.
			interval: latest?.interval ?? "daily",
			latestPrice: latest?.close ?? null,
			latestDate: latest?.date ?? null,
		};
	});
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

	// Order desc + take so the window is the NEWEST `limit` rows, then reverse
	// to restore chronological order (round-119). `ascending + take` returned
	// the OLDEST rows instead — the exact bug getPricesBySource below fixed in
	// round-106; a rangeless request (frontend CommodityPriceChart) rendered
	// 2005-era prices for FRED series with 7000+ points.
	let prices = await prisma.commodityPrice.findMany({
		where,
		orderBy: { date: "desc" },
		take: params.limit,
	});

	// Cadence fallback (round-129 batch 7, extended round-149): series whose
	// only rows are monthly (beef_carcass_us = IMF monthly, the world_bank
	// group) or weekly (beef_90cl_us = USDA NW_LS421) return [] for a daily
	// request and the trading page rendered an empty chart. Same pattern as
	// fetchHistoryWithFallback (round-127) and public highlights: daily falls
	// to weekly then monthly; a weekly request only falls to monthly.
	if (prices.length === 0 && params.interval !== "monthly") {
		prices = await prisma.commodityPrice.findMany({
			where: {
				...where,
				interval: params.interval === "daily" ? "weekly" : "monthly",
			},
			orderBy: { date: "desc" },
			take: params.limit,
		});
	}
	if (prices.length === 0 && params.interval === "daily") {
		prices = await prisma.commodityPrice.findMany({
			where: { ...where, interval: "monthly" },
			orderBy: { date: "desc" },
			take: params.limit,
		});
	}
	prices.reverse();

	return { commodity, prices };
}

/**
 * Prices for a commodity grouped by source — each source becomes a series of
 * {date, close} points. Used for multi-source comparison charts.
 */
export async function getPricesBySource(slug: string, interval: string, limit: number) {
	const commodity = await requireCommodity(slug);

	// `limit` applies across ALL sources combined. Order desc + take so the
	// window is the NEWEST `limit` rows (ascending + take returned the oldest
	// rows instead — multi-source comparison charts rendered each source's
	// earliest history). Reverse afterwards to restore chronological order.
	const prices = await prisma.commodityPrice.findMany({
		where: { commodityId: commodity.id, interval },
		orderBy: { date: "desc" },
		take: limit,
		select: { date: true, close: true, source: true, interval: true },
	});
	prices.reverse();

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

	// round-119: "no relevant regions" means NO factors are relevant to this
	// commodity (e.g. USD-denominated wheat/gold). The old conditional spread
	// dropped the region filter entirely in that case, serving the last 30
	// days of EVERY region's factors as this commodity's "fundamentals".
	const factors =
		relevantRegions.length > 0
			? await prisma.marketFactor.findMany({
					where: {
						date: { gte: thirtyDaysAgo },
						region: { in: relevantRegions },
					},
					orderBy: { date: "desc" },
					take: 200,
				})
			: [];

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
 * Per-commodity data freshness — latest price date for each commodity at its
 * OWN cadence (round-129 batch 6a). Previously daily-only: monthly-only
 * series (beef_carcass_us = IMF, world_bank group) reported lastUpdated null
 * and stale:true no matter how fresh their monthly points were. Stale
 * thresholds come from the cadence policy (7d daily / 90d monthly). Mirrors
 * the `/commodities/freshness` endpoint.
 */
export async function getCommodityFreshness() {
	const now = new Date();

	// Latest point per commodity per interval; the newest interval wins per
	// commodity below. (Mixed-cadence series are honest: the cadence of the
	// newest point is the cadence the board reports.)
	const latestPrices = await prisma.commodityPrice.groupBy({
		by: ["commodityId", "interval"],
		_max: { date: true },
	});

	const lastByCommodity = new Map<string, { date: Date; interval: string }>();
	for (const row of latestPrices) {
		const d = row._max.date;
		if (!d) continue;
		const existing = lastByCommodity.get(row.commodityId);
		if (!existing || d > existing.date) {
			lastByCommodity.set(row.commodityId, { date: d, interval: row.interval });
		}
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
		const last = lastByCommodity.get(c.id) ?? null;
		const staleThreshold = new Date(
			now.getTime() - stalenessWindowDays(last?.interval ?? "daily") * MS_PER_DAY,
		);
		return {
			id: c.id,
			slug: c.slug,
			name: c.name,
			category: c.category,
			isActive: c.isActive,
			lastUpdated: last?.date ?? null,
			// Cadence of the row lastUpdated came from (null when no data).
			interval: last?.interval ?? null,
			stale: last ? last.date < staleThreshold : true,
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

	// All three aggregates run in SQL (round-106): the previous version
	// loaded EVERY ingestionLog row from the last 7 days into Node (10-min
	// cycle × ~19 sources ≈ 19k rows and growing) only to count them in a
	// JS loop on every board request.
	const [bySource, byStatus, latestRows] = await Promise.all([
		prisma.ingestionLog.groupBy({
			by: ["source"],
			where: { createdAt: { gte: sevenDaysAgo } },
			_count: { _all: true },
			_max: { createdAt: true },
		}),
		prisma.ingestionLog.groupBy({
			by: ["source", "status"],
			where: { createdAt: { gte: sevenDaysAgo } },
			_count: { _all: true },
		}),
		// DISTINCT ON source, ordered desc → the latest row per source
		// (carries lastInserted/lastUpdated).
		prisma.ingestionLog.findMany({
			distinct: ["source"],
			where: { createdAt: { gte: sevenDaysAgo } },
			orderBy: { createdAt: "desc" },
			select: { source: true, inserted: true, updated: true },
		}),
	]);

	const successBySource = new Map<string, number>();
	for (const row of byStatus) {
		if (row.status === "success") {
			successBySource.set(row.source, row._count._all);
		}
	}
	const latestBySource = new Map(latestRows.map((r) => [r.source, r]));

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
	for (const row of bySource) {
		const latest = latestBySource.get(row.source);
		sourceStats.set(row.source, {
			total: row._count._all,
			success: successBySource.get(row.source) ?? 0,
			lastRun: row._max.createdAt ?? null,
			lastInserted: latest?.inserted ?? 0,
			lastUpdated: latest?.updated ?? 0,
		});
	}

	const freshness = Array.from(sourceStats.entries()).map(([source, stat]) => ({
		source,
		successRate: stat.total > 0 ? Math.round((stat.success / stat.total) * 100) : 0,
		lastRun: stat.lastRun,
		stale: stat.lastRun ? now.getTime() - stat.lastRun.getTime() > MS_PER_DAY : true,
		lastInserted: stat.lastInserted,
		lastUpdated: stat.lastUpdated,
		totalRuns: stat.total,
		// "empty" = the most-recent run wrote 0 rows. Distinct from `stale`
		// (which is recency-only): a source can run every cycle (stale:false)
		// yet never write a price (empty:true) — the silent-failure pattern
		// that inflated successRate before round-58 unified the status
		// contract. Derived from already-fetched lastInserted/lastUpdated, so
		// no extra query.
		empty: stat.lastInserted === 0 && stat.lastUpdated === 0,
	}));

	const staleSources = freshness.filter((f) => f.stale);
	const healthySources = freshness.filter((f) => !f.stale);
	// Sources whose last run wrote 0 rows — the per-source analog of
	// dataHealth.freshSourceCount's "wrote rows vs ran" gap.
	const emptySources = freshness.filter((f) => f.empty);

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
			predictionUnverifiable: dh.predictionUnverifiable,
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
			// Sources whose last run wrote 0 rows. Symmetric to staleSources;
			// surfaces the "ran but produced nothing" sources so the board can
			// label them per-row instead of relying only on the summary-level
			// dataHealth.freshSourceCount gap.
			emptyCount: emptySources.length,
			emptySources: emptySources.map((s) => s.source),
			// Actual data writes + prediction verification debt (round-48).
			// Differs from healthy/stale above: those count scraper runs, this
			// counts real price rows written + whether predictions can verify.
			dataHealth,
		},
	};
}

/**
 * Trade flows to China for one HS code (V8 批4, round-151).
 *
 * Reads the comtrade_mirror lanes (V8 批0): monthly FOB mirror rows written
 * by the live monthly reporters (BR/AU/NZ/US), annual FOB fallback rows for
 * AR/UY, and the China-reported annual CIF calibration lines. Response
 * contract: per-country latest month with quantity / unit price / MoM, the
 * calibration lines side by side, and 口径注记 mandatory — FOB mirror and CIF
 * official are systematically different numbers and must never be merged
 * (research doc §七.4). Stale flags are honest about monthly lag: AR/UY gaps
 * are non-reporting (annual only), NOT zero exports.
 */
export interface TradeFlowPoint {
	period: string;
	date: string;
	unitPriceUsdPerT: number;
	qtyTons: number;
	valueUsdM: number;
}

export interface TradeFlowEntry {
	region: string;
	country: string;
	freq: "M" | "A";
	basis: string;
	latest: TradeFlowPoint;
	/** Unit-price change vs the previous period, %. Null for annual lanes and
	 * first points (no comparable previous row). */
	momPct: number | null;
	qtyMomPct: number | null;
	stale: boolean;
	/** Most recent periods, oldest-first — the monthly volume/price series
	 * behind `latest` for charting (round-155 批C; the rows were already
	 * fetched, only the newest 2 were surfaced before). */
	history: TradeFlowPoint[];
}

export interface ArFobTotal {
	/** "YYYY-MM" of the observation month. */
	period: string;
	/** Argentina's monthly meat-rubro FOB exports, ALL destinations, USD
	 * millions (SSPM 75.3 `export_fob_carnes`). AR has no monthly to-China
	 * mirror (annual fallback lane only), so this is context, never a
	 * to-China flow. */
	valueUsdM: number;
}

export interface CalibrationEntry {
	region: string;
	country: string;
	basis: string;
	latest: TradeFlowPoint;
	stale: boolean;
}

/** Monthly lanes are stale when the latest period lags more than 3 months
 * behind the current one — BR reports t-1 and AU/NZ/US t-2, so a 2-month lag
 * is the sources' normal cadence, not staleness (live-found round-151: a
 * 75-day wall-clock threshold flagged every t-2 source as stale). */
const MONTHLY_STALE_MONTHS = 3;
/** Annual lanes land ~1 year in arrears; 2 missing years = stale. */
const ANNUAL_STALE_YEARS = 2;
/** Per-region history depth returned to the read side (round-155 批C). */
const TRADE_HISTORY_POINTS = 24;

type FactorRow = {
	region: string | null;
	date: Date;
	value: Prisma.Decimal;
	metadata: Prisma.JsonValue;
};

function toPoint(row: FactorRow): TradeFlowPoint {
	const meta = (row.metadata ?? {}) as {
		period?: string;
		quantityKg?: number;
		valueUsd?: number;
	};
	return {
		period: meta.period ?? row.date.toISOString().slice(0, 7),
		date: row.date.toISOString(),
		unitPriceUsdPerT: Math.round(Number(row.value) * 10) / 10,
		qtyTons: Math.round(((meta.quantityKg ?? 0) / 1000) * 10) / 10,
		valueUsdM: Math.round(((meta.valueUsd ?? 0) / 1_000_000) * 10) / 10,
	};
}

export async function getTradeFlows(hs: string): Promise<{
	hs: string;
	flows: TradeFlowEntry[];
	calibration: CalibrationEntry[];
	arFobTotal: ArFobTotal | null;
	notes: string[];
}> {
	const [mirrorRows, calibRows, arRow] = await Promise.all([
		prisma.marketFactor.findMany({
			where: { type: `export_to_cn_${hs}` },
			orderBy: { date: "desc" },
			take: 400,
		}),
		prisma.marketFactor.findMany({
			where: { type: `import_cn_cif_${hs}` },
			orderBy: { date: "desc" },
			take: 100,
		}),
		// Argentina monthly FOB context (all destinations — the to-China
		// monthly cross doesn't exist at this level, registered gap).
		prisma.marketFactor.findFirst({
			where: { type: "export_fob_carnes" },
			orderBy: { date: "desc" },
		}),
	]);

	const arFobTotal: ArFobTotal | null =
		arRow && arRow.region === "AR→WORLD"
			? {
					period: arRow.date.toISOString().slice(0, 7),
					valueUsdM: Math.round(Number(arRow.value) * 10) / 10,
				}
			: null;

	const now = Date.now();
	const byRegion = new Map<string, FactorRow[]>();
	for (const row of mirrorRows) {
		if (!row.region) continue;
		const list = byRegion.get(row.region) ?? [];
		list.push(row);
		byRegion.set(row.region, list);
	}

	const flows: TradeFlowEntry[] = [];
	for (const [region, rows] of byRegion) {
		const meta = (rows[0].metadata ?? {}) as { freq?: string; basis?: string };
		const freq = meta.freq === "A" ? "A" : "M";
		const latest = toPoint(rows[0]);
		const prev = rows[1] ? toPoint(rows[1]) : null;

		let momPct: number | null = null;
		let qtyMomPct: number | null = null;
		if (prev && prev.unitPriceUsdPerT > 0 && latest.period !== prev.period) {
			momPct =
				Math.round(
					((latest.unitPriceUsdPerT - prev.unitPriceUsdPerT) / prev.unitPriceUsdPerT) * 1000,
				) / 10;
		}
		if (prev && prev.qtyTons > 0 && latest.period !== prev.period) {
			qtyMomPct = Math.round(((latest.qtyTons - prev.qtyTons) / prev.qtyTons) * 1000) / 10;
		}

		let stale: boolean;
		const latestDate = new Date(latest.date);
		const nowDate = new Date(now);
		if (freq === "M") {
			const monthDiff =
				(nowDate.getUTCFullYear() - latestDate.getUTCFullYear()) * 12 +
				(nowDate.getUTCMonth() - latestDate.getUTCMonth());
			stale = monthDiff > MONTHLY_STALE_MONTHS;
		} else {
			const latestYear = Number(latest.period.slice(0, 4));
			stale = latestYear <= new Date().getUTCFullYear() - ANNUAL_STALE_YEARS;
		}

		flows.push({
			region,
			country: region.split("→")[0],
			freq,
			basis: meta.basis ?? "FOB (partner-reported export)",
			latest,
			momPct,
			qtyMomPct,
			stale,
			history: rows.slice(0, TRADE_HISTORY_POINTS).map(toPoint).reverse(),
		});
	}
	// Monthly lanes first (newest data), then annual fallbacks.
	flows.sort((a, b) => {
		if (a.freq !== b.freq) return a.freq === "M" ? -1 : 1;
		return new Date(b.latest.date).getTime() - new Date(a.latest.date).getTime();
	});

	const seenCalib = new Set<string>();
	const calibration: CalibrationEntry[] = [];
	for (const row of calibRows) {
		if (!row.region || seenCalib.has(row.region)) continue;
		seenCalib.add(row.region);
		const meta = (row.metadata ?? {}) as { basis?: string };
		const point = toPoint(row);
		const latestYear = Number(point.period.slice(0, 4));
		calibration.push({
			region: row.region,
			country: row.region.split("←")[1] ?? row.region,
			basis: meta.basis ?? "CIF (China-reported import)",
			latest: point,
			stale: latestYear <= new Date().getUTCFullYear() - ANNUAL_STALE_YEARS,
		});
	}
	calibration.sort((a, b) => b.latest.qtyTons - a.latest.qtyTons);

	return {
		hs,
		flows,
		calibration,
		arFobTotal,
		notes: [
			"月度线为出口国报送的 FOB 镜像口径（巴西约滞后 1 个月，澳/新/美约 2 个月）；阿根廷/乌拉圭仅年度报送，缺失月份为未报送而非零值。",
			"中国官方口径为年度 CIF（中国报送），与月度 FOB 镜像存在系统性差异（含运保费与时点），两口径并列展示、绝不合并。",
			"0202 为冻牛肉总量，其 6 位子目（020230 冻去骨 / 020220 冻带骨）为独立序列，读取时不可与 0202 加总。",
		],
	};
}
