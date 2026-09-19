/**
 * Beef route query services (TD-6 fat-route extraction, round-156 批3b).
 *
 * Verbatim moves of the six fat handler bodies from routes/beef.ts —
 * parameter parsing, factory resolution, pagination, freshness mapping,
 * spread math, and the batch-forecast worker pool all live here now so the
 * routes are thin middleware chains (validate → service → respond) and the
 * query logic is unit-testable without HTTP. Behavior is unchanged: same
 * filters, same honesty rules (unknown factory → 404, never a silently
 * unfiltered response), same response payloads. The /by-country route
 * already used this pattern (aggregateBeefByCountry).
 *
 * Errors: services throw NotFoundError/BadRequestError (same convention as
 * apiKeys/alerts/datasetService) — the route error middleware maps them to
 * 404/400 responses.
 */

import { logger, prisma } from "@/lib";
import { BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { computeBeefTrend, pageFreshnessSummary, withFreshness } from "@/services/beefQueries";
import {
	evaluateFactoryForCut,
	findForecastableFactoryForCut,
	generateBeefCutForecast,
} from "@/services/tradingSignals";

/** Express req.query shape (ParsedQs is structurally assignable to this). */
type BeefQuery = Record<string, unknown>;

/**
 * GET /api/beef/prices — flexible cut-price query with filters + pagination.
 * Returns the full response payload (prices/count/total/freshness/pagination).
 */
export async function queryBeefPrices(query: BeefQuery, skip: number, take: number) {
	const { cutCode, factoryCode, country, region, source, grade, days = "30" } = query;

	const daysNum = Math.min(Number(days) || 30, 365);
	const since = new Date();
	since.setDate(since.getDate() - daysNum);

	const where: Record<string, unknown> = {
		date: { gte: since },
	};

	if (cutCode && typeof cutCode === "string") {
		where.cutCode = cutCode;
	}
	if (source && typeof source === "string") {
		where.source = source;
	}
	if (grade && typeof grade === "string") {
		where.grade = grade;
	}
	if (factoryCode && typeof factoryCode === "string") {
		const factory = await prisma.factory.findUnique({
			where: { code: factoryCode },
			select: { id: true },
		});
		// A typo'd code previously dropped the filter SILENTLY — the
		// response then contained every factory's prices under what the
		// caller believed was a factory-filtered request (round-106).
		if (!factory) throw new NotFoundError(`Factory not found: ${factoryCode}`);
		where.factoryId = factory.id;
	}
	// Factory-level location filters (round-146 批 2): country and region
	// (state/province, e.g. NSW/QLD/Santa Fe) both resolve to factory id
	// sets. A region may span countries, so region is NOT nested under
	// country — they AND naturally only when both are given.
	if ((country || region) && !factoryCode) {
		const factories = await prisma.factory.findMany({
			where: {
				...(country && typeof country === "string" ? { country: country as string } : {}),
				...(region && typeof region === "string"
					? { region: { equals: region as string, mode: "insensitive" } }
					: {}),
			},
			select: { id: true },
			take: 100,
		});
		where.factoryId = { in: factories.map((f) => f.id) };
	}

	const [prices, total] = await Promise.all([
		prisma.beefCutPrice.findMany({
			where,
			orderBy: { date: "desc" },
			skip,
			take,
			include: {
				factory: { select: { code: true, name: true, country: true } },
			},
		}),
		prisma.beefCutPrice.count({ where }),
	]);

	// Attach the honesty-framework freshness tier to each row + a page-level
	// summary so the UI can show a "demo snapshot mode" banner when no live
	// data is present. See services/beefFreshness.ts. Also coerce price from
	// Prisma Decimal (which serializes as a JSON string) to a JS number so
	// the frontend contract stays numeric.
	const pricesWithFreshness = withFreshness(prices).map((p) => ({
		...p,
		price: Number(p.price),
	}));
	const freshness = pageFreshnessSummary(prices);

	return {
		prices: pricesWithFreshness,
		count: pricesWithFreshness.length,
		total,
		freshness,
		pagination: {
			page: Math.floor(skip / take) + 1,
			limit: take,
			total,
			totalPages: Math.ceil(total / take),
		},
	};
}

/**
 * GET /api/beef/prices/latest — latest-date snapshot per cut + imported
 * average trend vs the previous distinct day with data.
 */
export async function latestBeefPrices(query: BeefQuery) {
	const { cutCode, factoryCode, country, region, source, grade } = query;

	// Build the filter applied to BOTH the latest-date lookup and the row
	// fetch, so the "latest" reflects the active filter (e.g. latest price
	// for a specific cut or factory), not the global latest date.
	const where: Record<string, unknown> = {};
	if (source && typeof source === "string") where.source = source;
	if (cutCode && typeof cutCode === "string") where.cutCode = cutCode;
	if (grade && typeof grade === "string") where.grade = grade;
	if (factoryCode && typeof factoryCode === "string") {
		const factory = await prisma.factory.findUnique({
			where: { code: factoryCode as string },
			select: { id: true },
		});
		// Same honesty rule as /prices: unknown code → 404, never a
		// silently unfiltered response (round-106).
		if (!factory) throw new NotFoundError(`Factory not found: ${factoryCode}`);
		where.factoryId = factory.id;
	}
	if (country && typeof country === "string" && !factoryCode) {
		where.factory = { country: country as string };
	}
	// Region (state/province) filter — round-146 批 2. Composes with country
	// when both are given; skipped when a factory is already pinned.
	if (region && typeof region === "string" && !factoryCode) {
		const factories = await prisma.factory.findMany({
			where: {
				region: { equals: region as string, mode: "insensitive" },
				...(country && typeof country === "string" ? { country: country as string } : {}),
			},
			select: { id: true },
			take: 100,
		});
		where.factoryId = { in: factories.map((f) => f.id) };
	}

	// Get the most recent date matching the filter
	const latest = await prisma.beefCutPrice.findFirst({
		where,
		orderBy: { date: "desc" },
		select: { date: true },
	});

	if (!latest) {
		return { prices: [], date: null, freshness: null };
	}

	const prices = await prisma.beefCutPrice.findMany({
		where: { ...where, date: latest.date },
		include: {
			factory: { select: { code: true, name: true, country: true } },
		},
		orderBy: { cutCode: "asc" },
	});

	// Attach freshness tiers + page summary (same as /prices). Coerce price
	// Decimal → number to keep the frontend contract numeric.
	const pricesWithFreshness = withFreshness(prices).map((p) => ({
		...p,
		price: Number(p.price),
	}));
	const freshness = pageFreshnessSummary(prices);

	// Imported-average trend (round-57, PRODUCT-SPEC §5.1; domestic split
	// removed with the domestic dimension, round-155): % change vs the
	// PREVIOUS DISTINCT day with data. "Previous distinct day" (not "7 days
	// ago") handles irregular beef-data cadence honestly. Falls back to
	// nulls when there's no prior day.
	const previous = await prisma.beefCutPrice.findFirst({
		where: { ...where, date: { lt: latest.date } },
		orderBy: { date: "desc" },
		select: { date: true },
	});
	let trend = {
		importedTrendPct: null as number | null,
		latestDate: latest.date.toISOString() as string | null,
		previousDate: null as string | null,
	};
	if (previous) {
		const previousRows = await prisma.beefCutPrice.findMany({
			where: { ...where, date: previous.date },
			include: { factory: { select: { country: true } } },
		});
		trend = computeBeefTrend(
			pricesWithFreshness.map((p) => ({
				price: p.price,
				country: p.factory?.country,
				currency: p.currency,
			})),
			previousRows.map((p) => ({
				price: Number(p.price),
				country: p.factory?.country,
				currency: p.currency,
			})),
			latest.date,
			previous.date,
		);
	}

	return {
		prices: pricesWithFreshness,
		date: latest.date,
		count: pricesWithFreshness.length,
		freshness,
		trend,
	};
}

/**
 * GET /api/beef/prices/history/:cutCode — per-cut history with multi-factory
 * comparison (comma-separated factoryCode) and ISO date-range from/to.
 */
export async function beefPriceHistory(cutCode: string, query: BeefQuery) {
	const { days = "90", factoryCode, source, from, to } = query;

	// Date range: prefer explicit from/to; fall back to days=N window.
	// Invalid date strings previously produced Invalid Date, which Prisma
	// rejects with a 500 — now a 400 (round-106).
	const dateFilter: Record<string, Date> = {};
	if (from && typeof from === "string") {
		const d = new Date(from);
		if (Number.isNaN(d.getTime())) throw new BadRequestError(`Invalid 'from' date: ${from}`);
		dateFilter.gte = d;
	} else {
		const daysNum = Math.min(Number(days) || 90, 730);
		const since = new Date();
		since.setDate(since.getDate() - daysNum);
		dateFilter.gte = since;
	}
	if (to && typeof to === "string") {
		const d = new Date(to);
		if (Number.isNaN(d.getTime())) throw new BadRequestError(`Invalid 'to' date: ${to}`);
		dateFilter.lte = d;
	}

	const where: Record<string, unknown> = {
		cutCode,
		date: dateFilter,
	};

	if (source && typeof source === "string") {
		where.source = source;
	}

	// factoryCode accepts a single code OR a comma-separated list for
	// multi-factory comparison (the 产地对比 use case). Each code is
	// resolved to a factoryId; the filter becomes an IN-clause.
	if (factoryCode && typeof factoryCode === "string") {
		const codes = factoryCode
			.split(",")
			.map((c) => c.trim())
			.filter(Boolean);
		if (codes.length === 1) {
			const factory = await prisma.factory.findUnique({
				where: { code: codes[0] },
			});
			if (!factory) throw new NotFoundError(`Factory not found: ${codes[0]}`);
			where.factoryId = factory.id;
		} else {
			const factories = await prisma.factory.findMany({
				where: { code: { in: codes } },
				select: { id: true },
			});
			// All-unknown list → 404 (silently dropping the whole filter
			// returned unfiltered history as "filtered", round-106).
			if (factories.length === 0) {
				throw new NotFoundError(`No factories found for codes: ${codes.join(", ")}`);
			}
			where.factoryId = { in: factories.map((f) => f.id) };
		}
	}

	const prices = await prisma.beefCutPrice.findMany({
		where,
		orderBy: { date: "asc" },
		include: {
			factory: { select: { code: true, name: true, country: true } },
		},
		take: 1000,
	});

	// Coerce Decimal price → number for the frontend contract.
	const pricesOut = prices.map((p) => ({ ...p, price: Number(p.price) }));

	return { cutCode, prices: pricesOut, count: pricesOut.length };
}

/**
 * GET /api/beef/spreads — min/max/avg spread per (cutCode, source+country,
 * currency) bucket over the requested window.
 */
export async function computeBeefSpreads(query: BeefQuery) {
	const { cutCode, days = "30" } = query;

	const daysNum = Math.min(Number(days) || 30, 365);
	const since = new Date();
	since.setDate(since.getDate() - daysNum);

	const where: Record<string, unknown> = {
		date: { gte: since },
	};
	if (cutCode && typeof cutCode === "string") {
		where.cutCode = cutCode;
	}

	const prices = await prisma.beefCutPrice.findMany({
		where,
		select: {
			cutCode: true,
			price: true,
			currency: true,
			source: true,
			date: true,
			factory: { select: { country: true } },
		},
		orderBy: { date: "desc" },
		take: 1000,
	});

	// Group by (cutCode, source+country, currency) over the requested
	// window. Currency is part of the key: BeefCutPrice rows carry mixed
	// currencies (USD/BRL/AUD...), and a min/max/avg bucket that merges a
	// USD/kg row with a BRL/kg row is numeric noise, not a spread.
	const spreads: Record<
		string,
		Record<string, { min: number; max: number; avg: number; count: number }>
	> = {};
	for (const p of prices) {
		// price is Decimal(18,4) — coerce to number once for the spread math.
		const price = Number(p.price);
		const key = p.cutCode;
		if (!spreads[key]) spreads[key] = {};
		const sourceKey = `${p.source} (${p.factory?.country || "unknown"}) [${p.currency}]`;
		if (!spreads[key][sourceKey]) {
			spreads[key][sourceKey] = {
				min: price,
				max: price,
				avg: price,
				count: 1,
			};
		} else {
			const s = spreads[key][sourceKey];
			s.min = Math.min(s.min, price);
			s.max = Math.max(s.max, price);
			s.avg = (s.avg * s.count + price) / (s.count + 1);
			s.count++;
		}
	}

	return { spreads };
}

/**
 * GET /api/beef/forecasts — batch forecast summary for all forecastable
 * cuts (the heaviest inference path; see the route doc comment).
 */
export async function batchBeefForecasts(horizon: number) {
	// Find all (factoryId, cutCode) pairs with enough fresh real data.
	// One row per cutCode (the best factory), matching the per-cut endpoint's
	// findForecastableFactoryForCut selection logic.
	const candidates = await prisma.beefCutPrice.groupBy({
		by: ["cutCode", "factoryId"],
		where: { source: { not: { startsWith: "bridge:" } } },
		_count: { _all: true },
	});

	// Per cutCode, keep the factory with the most points (deterministic).
	const bestByCut = new Map<string, { factoryId: string; points: number }>();
	for (const c of candidates) {
		const cur = bestByCut.get(c.cutCode);
		if (!cur || c._count._all > cur.points) {
			bestByCut.set(c.cutCode, { factoryId: c.factoryId, points: c._count._all });
		}
	}

	// Forecast the best-supported cuts (fault-tolerant). Only cuts passing
	// the freshness gate are forecastable; the rest are skipped (honest
	// omission — never fabricate from stale seed data).
	//
	// Bounds (round-106): each cut costs one freshness re-validation query
	// + a full multi-model forecast ensemble, so this endpoint used to be
	// O(N cuts) queries at unbounded concurrency in a single request —
	// the rate limiter caps requests/min, not work/request. Cap to the
	// 20 best-supported cuts and run ensembles with a 4-worker pool.
	const MAX_FORECAST_CUTS = 20;
	const FORECAST_CONCURRENCY = 4;
	const cutEntries = Array.from(bestByCut.entries())
		.sort((a, b) => b[1].points - a[1].points)
		.slice(0, MAX_FORECAST_CUTS);

	const entries = new Array<readonly [string, Record<string, unknown>] | null>(
		cutEntries.length,
	).fill(null);
	let next = 0;
	const worker = async () => {
		while (next < cutEntries.length) {
			const i = next++;
			const [cutCode, { factoryId, points }] = cutEntries[i];
			try {
				// Re-validate via findForecastableFactoryForCut so the batch path
				// applies the SAME freshness gate as the single-cut endpoint.
				// (bestByCut only checked point count, not freshness.)
				const check = await findForecastableFactoryForCut(cutCode);
				if (!check || check.factoryId !== factoryId) continue;

				const f = await generateBeefCutForecast(factoryId, cutCode, horizon);
				entries[i] = [
					cutCode,
					{
						direction: f.direction,
						predictedChange: f.predictedChange,
						confidence: f.confidence,
						predictedPrice: f.predictedPrice,
						modelsAgree: f.modelsAgree,
						availableModels: f.availableModels,
						dataPoints: points,
						horizon,
					},
				];
			} catch (err) {
				logger.warn(`[beef/forecasts] forecast failed for cut ${cutCode}: ${err}`);
			}
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(FORECAST_CONCURRENCY, cutEntries.length) }, worker),
	);

	const forecasts: Record<string, unknown> = {};
	for (const e of entries) {
		if (e) {
			const [code, summary] = e;
			forecasts[code] = summary;
		}
	}

	return { forecasts, count: Object.keys(forecasts).length, horizon };
}

/**
 * GET /api/beef/forecasts/:cutCode — per-cut AI forecast with honest
 * unforecastable states (forecastable:false + reason).
 */
export async function beefCutForecast(cutCode: string, query: BeefQuery) {
	const horizon = Math.min(Number(query.horizon) || 10, 30);
	const factoryCode = typeof query.factoryCode === "string" ? query.factoryCode : undefined;

	// Verify the cut exists in taxonomy.
	const cut = await prisma.beefCutTaxonomy.findUnique({
		where: { cutCode },
		select: { cutCode: true, nameEn: true, nameZh: true },
	});
	if (!cut) {
		throw new NotFoundError(`Cut not found: ${cutCode}`);
	}

	// ?factoryCode= pins the forecast to ONE factory's series (round-146
	// 批 2): the same ≥2-non-bridge-points + freshness gate applies to that
	// factory, so a thin series can't be forecast just because another
	// factory's series for the same cut is healthy. Without the param the
	// representative pick (most real, fresh data) is used — unchanged.
	let pinnedFactoryId: string | undefined;
	if (factoryCode) {
		const resolved = await prisma.factory.findUnique({
			where: { code: factoryCode },
			select: { id: true },
		});
		if (!resolved) {
			throw new NotFoundError(`Factory not found: ${factoryCode}`);
		}
		pinnedFactoryId = resolved.id;
	}

	const factory = pinnedFactoryId
		? await evaluateFactoryForCut(pinnedFactoryId, cutCode)
		: await findForecastableFactoryForCut(cutCode);
	if (!factory) {
		// Distinguish "no data at all" from "stale data" for an honest UI message.
		const anyData = await prisma.beefCutPrice.findFirst({
			where: {
				cutCode,
				...(pinnedFactoryId ? { factoryId: pinnedFactoryId } : {}),
				source: { not: { startsWith: "bridge:" } },
			},
			orderBy: { date: "desc" },
			select: { date: true },
		});
		const scope = pinnedFactoryId ? `this cut at factory ${factoryCode}` : "this cut";
		const reason = anyData
			? `Price data for ${scope} is stale (latest ${anyData.date.toISOString().split("T")[0]}). Forecasting requires fresh data (within ${"7"} days). Activate a beef data source to enable predictions.`
			: `Insufficient real (non-bridge) price data for ${scope}. Forecasting requires ≥2 real price points.`;
		return { cutCode, factoryCode, forecastable: false, reason };
	}

	try {
		const forecast = await generateBeefCutForecast(factory.factoryId, cutCode, horizon);
		return {
			cutCode,
			factoryCode,
			forecastable: true,
			factoryId: factory.factoryId,
			dataPoints: factory.pointCount,
			currentPrice: factory.latestPrice,
			forecast,
		};
	} catch (err) {
		// Forecast can fail at inference-time (e.g. all models unavailable).
		// Return forecastable:false with the reason rather than a 500, so the
		// UI treats it as an honest "can't forecast" state.
		const reason = err instanceof Error ? err.message : String(err);
		return { cutCode, factoryCode, forecastable: false, reason };
	}
}
