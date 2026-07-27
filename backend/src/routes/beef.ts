import { Router } from "express";
import { prisma } from "@/lib";
import { success } from "@/lib/response";
import type { AuthenticatedRequest } from "@/middleware/auth";
import { authenticate, authorize } from "@/middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { getPagination } from "@/schemas/common";
import { pageFreshnessSummary, withFreshness } from "@/services/beefFreshness";
import { importBeefPrices, parseBeefCSV } from "@/services/beefImport";
import { findForecastableFactoryForCut, generateBeefCutForecast } from "@/services/tradingSignals";

const router = Router();

// Public routes (no auth required for data viewing)

// List all factories
router.get(
	"/factories",
	asyncHandler(async (_req, res) => {
		const factories = await prisma.factory.findMany({
			where: { active: true },
			orderBy: [{ country: "asc" }, { name: "asc" }],
			take: 200,
		});
		success(res, { factories, count: factories.length });
	}),
);

// Get factory by code
router.get(
	"/factories/:code",
	asyncHandler(async (req, res) => {
		const factory = await prisma.factory.findUnique({
			where: { code: req.params.code },
		});
		if (!factory) {
			throw new NotFoundError("Factory not found");
		}
		success(res, factory);
	}),
);

// List all beef cuts (taxonomy)
router.get(
	"/cuts",
	asyncHandler(async (_req, res) => {
		const cuts = await prisma.beefCutTaxonomy.findMany({
			orderBy: [{ primal: "asc" }, { nameEn: "asc" }],
			take: 200,
		});
		success(res, { cuts, count: cuts.length });
	}),
);

// Get cuts grouped by primal
router.get(
	"/cuts/by-primal",
	asyncHandler(async (_req, res) => {
		const cuts = await prisma.beefCutTaxonomy.findMany({
			orderBy: [{ primal: "asc" }, { nameEn: "asc" }],
		});
		const grouped: Record<string, typeof cuts> = {};
		for (const cut of cuts) {
			const key = cut.primal || "Other";
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(cut);
		}
		success(res, grouped);
	}),
);

// Get cut by code
router.get(
	"/cuts/:cutCode",
	asyncHandler(async (req, res) => {
		const cut = await prisma.beefCutTaxonomy.findUnique({
			where: { cutCode: req.params.cutCode },
		});
		if (!cut) {
			throw new NotFoundError("Cut not found");
		}
		success(res, cut);
	}),
);

// Query beef cut prices with flexible filters + pagination
router.get(
	"/prices",
	asyncHandler(async (req, res) => {
		const { cutCode, factoryCode, country, source, grade, days = "30" } = req.query;

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
			});
			if (factory) {
				where.factoryId = factory.id;
			}
		}
		if (country && typeof country === "string" && !factoryCode) {
			const factories = await prisma.factory.findMany({
				where: { country: country as string },
				select: { id: true },
				take: 100,
			});
			where.factoryId = { in: factories.map((f) => f.id) };
		}

		// Pagination — previously a hard take:500 that silently truncated large
		// queries. Now page/limit with a total so callers know data was dropped.
		// Response shape kept backward-compatible ({ prices, count, freshness })
		// with an added `pagination` block; existing callers ignore the new field.
		const { skip, take } = getPagination(req.query);

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

		success(res, {
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
		});
	}),
);

// Price summary per cut (latest price for each cut)
router.get(
	"/prices/latest",
	asyncHandler(async (req, res) => {
		const { cutCode, factoryCode, country, source, grade } = req.query;

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
			if (factory) where.factoryId = factory.id;
		}
		if (country && typeof country === "string") {
			where.factory = { country: country as string };
		}

		// Get the most recent date matching the filter
		const latest = await prisma.beefCutPrice.findFirst({
			where,
			orderBy: { date: "desc" },
			select: { date: true },
		});

		if (!latest) {
			return success(res, { prices: [], date: null, freshness: null });
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

		success(res, {
			prices: pricesWithFreshness,
			date: latest.date,
			count: pricesWithFreshness.length,
			freshness,
		});
	}),
);

/**
 * GET /api/beef/by-country
 *
 * Origin-comparison view (PRODUCT-SPEC §四 "分析 > 产地对比"): aggregates the
 * latest BeefCutPrice rows by factory.country so the frontend can render a
 * side-by-side comparison of imported-beef prices across BR/AU/AR/UY/US/etc.
 *
 * Returns, per country: avg/min/max price, cut count, factory count, and a
 * per-cut breakdown (top priced cuts). Optional ?cuts=N limits the per-cut
 * list (default 5). Optional ?source= filters by data source.
 *
 * Public (no auth) — price data is the product's public market surface.
 */
router.get(
	"/by-country",
	asyncHandler(async (req, res) => {
		const source = req.query.source as string | undefined;
		const cutsLimit = Math.min(Number(req.query.cuts) || 5, 20);

		// Find the most recent date with data, then aggregate by country on that
		// date. Using a single date gives an apples-to-apples comparison (vs.
		// mixing dates which would skew the country averages).
		const latest = await prisma.beefCutPrice.findFirst({
			where: source ? { source } : {},
			orderBy: { date: "desc" },
			select: { date: true },
		});
		if (!latest) {
			return success(res, { countries: [], date: null });
		}

		const rows = await prisma.beefCutPrice.findMany({
			where: {
				date: latest.date,
				...(source ? { source } : {}),
			},
			include: { factory: { select: { country: true, code: true, name: true } } },
		});

		// Group by country → aggregate + per-cut breakdown.
		const byCountry = new Map<
			string,
			{
				country: string;
				prices: number[];
				cuts: Map<string, number>;
				factories: Set<string>;
			}
		>();
		for (const r of rows) {
			const country = r.factory?.country ?? "?";
			const price = typeof r.price === "number" ? r.price : Number(r.price);
			if (!Number.isFinite(price)) continue;
			let bucket = byCountry.get(country);
			if (!bucket) {
				bucket = { country, prices: [], cuts: new Map(), factories: new Set() };
				byCountry.set(country, bucket);
			}
			bucket.prices.push(price);
			// Keep the latest (highest? first?) price per cutCode within a country.
			if (!bucket.cuts.has(r.cutCode)) bucket.cuts.set(r.cutCode, price);
			if (r.factory?.code) bucket.factories.add(r.factory.code);
		}

		const countries = Array.from(byCountry.values())
			.map((b) => {
				const sum = b.prices.reduce((s, p) => s + p, 0);
				const avg = b.prices.length > 0 ? sum / b.prices.length : 0;
				const min = b.prices.length > 0 ? Math.min(...b.prices) : 0;
				const max = b.prices.length > 0 ? Math.max(...b.prices) : 0;
				const topCuts = Array.from(b.cuts.entries())
					.sort((a, z) => z[1] - a[1]) // highest price first
					.slice(0, cutsLimit)
					.map(([cutCode, price]) => ({ cutCode, price: Math.round(price * 100) / 100 }));
				return {
					country: b.country,
					avgPrice: Math.round(avg * 100) / 100,
					minPrice: Math.round(min * 100) / 100,
					maxPrice: Math.round(max * 100) / 100,
					cutCount: b.cuts.size,
					factoryCount: b.factories.size,
					topCuts,
				};
			})
			.sort((a, b) => a.country.localeCompare(b.country));

		success(res, { countries, date: latest.date, count: countries.length });
	}),
);

// Price history for a specific cut — supports multi-factory comparison
// (comma-separated factoryCode) and ISO date-range (from/to) for the
// 产地对比 analysis (PRODUCT-SPEC §四 分析 > 产地对比).
router.get(
	"/prices/history/:cutCode",
	asyncHandler(async (req, res) => {
		const { cutCode } = req.params;
		const { days = "90", factoryCode, source, from, to } = req.query;

		// Date range: prefer explicit from/to; fall back to days=N window.
		const dateFilter: Record<string, Date> = {};
		if (from && typeof from === "string") {
			dateFilter.gte = new Date(from);
		} else {
			const daysNum = Math.min(Number(days) || 90, 730);
			const since = new Date();
			since.setDate(since.getDate() - daysNum);
			dateFilter.gte = since;
		}
		if (to && typeof to === "string") {
			dateFilter.lte = new Date(to);
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
				if (factory) where.factoryId = factory.id;
			} else {
				const factories = await prisma.factory.findMany({
					where: { code: { in: codes } },
					select: { id: true },
				});
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

		success(res, { cutCode, prices: pricesOut, count: pricesOut.length });
	}),
);

// Weekly kill data
router.get(
	"/weekly-kill",
	asyncHandler(async (req, res) => {
		const { country, weeks = "12" } = req.query;

		const weeksNum = Math.min(Number(weeks) || 12, 52);
		const since = new Date();
		since.setDate(since.getDate() - weeksNum * 7);

		const where: Record<string, unknown> = {
			weekEnding: { gte: since },
		};
		if (country && typeof country === "string") {
			where.country = country;
		}

		const kills = await prisma.weeklyKill.findMany({
			where,
			orderBy: { weekEnding: "desc" },
			take: 500,
		});

		success(res, { kills, count: kills.length });
	}),
);

// Cold storage data
router.get(
	"/cold-storage",
	asyncHandler(async (req, res) => {
		const { country, months = "12" } = req.query;

		const monthsNum = Math.min(Number(months) || 12, 60);
		const since = new Date();
		since.setMonth(since.getMonth() - monthsNum);

		const where: Record<string, unknown> = {
			date: { gte: since },
			category: "beef",
		};
		if (country && typeof country === "string") {
			where.country = country;
		}

		const storage = await prisma.coldStorage.findMany({
			where,
			orderBy: { date: "desc" },
			take: 200,
		});

		success(res, { coldStorage: storage, count: storage.length });
	}),
);

// Price spread analysis (FOB vs wholesale vs retail)
router.get(
	"/spreads",
	authenticate,
	asyncHandler(async (req, res) => {
		const { cutCode, days = "30" } = req.query;

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

		// Group by (cutCode, date, source) to show spreads
		const spreads: Record<
			string,
			Record<string, { min: number; max: number; avg: number; count: number }>
		> = {};
		for (const p of prices) {
			// price is Decimal(18,4) — coerce to number once for the spread math.
			const price = Number(p.price);
			const key = p.cutCode;
			if (!spreads[key]) spreads[key] = {};
			const sourceKey = `${p.source} (${p.factory?.country || "unknown"})`;
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

		success(res, { spreads });
	}),
);

/**
 * GET /api/beef/forecasts
 *
 * Batch forecast summary — one fetch returns the consensus direction +
 * predicted-change + confidence for ALL forecastable cuts. This is the layer-2
 * endpoint that powers the per-row forecast column on the /beef Latest Cut
 * Prices table: calling /forecasts/:cutCode once per row would fire N model
 * ensembles (slow, N inference round-trips). This endpoint computes each cut's
 * forecast once and returns a lightweight summary map keyed by cutCode.
 *
 * Returns only cuts with sufficient fresh (non-bridge, non-stale) data.
 * Cuts that can't be forecast are simply omitted from the map — the UI shows
 * nothing for them (an honest absence, not a fabricated zero).
 *
 * Optional ?horizon=N (default 7, max 30).
 * Requires auth (same gate as the single-cut endpoint).
 */
router.get(
	"/forecasts",
	authenticate,
	asyncHandler(async (req, res) => {
		const horizon = Math.min(Number(req.query.horizon) || 7, 30);

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

		// Forecast each candidate (parallel, fault-tolerant). Only cuts passing
		// the freshness gate are forecastable; the rest are skipped (honest
		// omission — never fabricate from stale seed data).
		const entries = await Promise.all(
			Array.from(bestByCut.entries()).map(async ([cutCode, { factoryId, points }]) => {
				try {
					// Re-validate via findForecastableFactoryForCut so the batch path
					// applies the SAME freshness gate as the single-cut endpoint.
					// (bestByCut only checked point count, not freshness.)
					const check = await findForecastableFactoryForCut(cutCode);
					if (!check || check.factoryId !== factoryId) return null;

					const f = await generateBeefCutForecast(factoryId, cutCode, horizon);
					return [
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
					] as const;
				} catch {
					return null;
				}
			}),
		);

		const forecasts: Record<string, unknown> = {};
		for (const e of entries) {
			if (e) {
				const [code, summary] = e;
				forecasts[code] = summary;
			}
		}

		success(res, { forecasts, count: Object.keys(forecasts).length, horizon });
	}),
);

/**
 * GET /api/beef/forecasts/:cutCode
 *
 * Per-cut AI forecast — the core M2 feature (PRODUCT-SPEC §四 "AI 预测 >
 * 价格预测", §5.3 "AI 预测融入行情"). Generates a multi-model consensus
 * forecast for the cut's daily price series, extracted from BeefCutPrice.
 *
 * This is the dual-backend prediction path: unlike /api/signals/:slug (which
 * forecasts a CommodityPrice macro commodity), this forecasts a beef CUT. See
 * services/beefCutSeries.ts + tradingSignals.generateBeefCutForecast.
 *
 * Data-honesty: bridge-proxy rows are excluded from the training series, so a
 * forecast is only produced when the cut has ≥2 real (non-bridge) price
 * points. Otherwise returns forecastable:false so the UI can show an honest
 * "insufficient real data" state instead of a fabricated prediction.
 *
 * Requires auth (AI-feature tier gate consistency with /api/signals).
 */
router.get(
	"/forecasts/:cutCode",
	authenticate,
	asyncHandler(async (req, res) => {
		const { cutCode } = req.params;
		const horizon = Math.min(Number(req.query.horizon) || 10, 30);

		// Verify the cut exists in taxonomy.
		const cut = await prisma.beefCutTaxonomy.findUnique({
			where: { cutCode },
			select: { cutCode: true, nameEn: true, nameZh: true },
		});
		if (!cut) {
			throw new NotFoundError(`Cut not found: ${cutCode}`);
		}

		// Find the factory with the most real, fresh data for this cut.
		// Returns null if no factory has ≥2 non-bridge points OR if the latest
		// point is stale (>STALE_WINDOW_DAYS) — see tradingSignals for the gate.
		const factory = await findForecastableFactoryForCut(cutCode);
		if (!factory) {
			// Distinguish "no data at all" from "stale data" for an honest UI message.
			const anyData = await prisma.beefCutPrice.findFirst({
				where: { cutCode, source: { not: { startsWith: "bridge:" } } },
				orderBy: { date: "desc" },
				select: { date: true },
			});
			const reason = anyData
				? `Price data for this cut is stale (latest ${anyData.date.toISOString().split("T")[0]}). Forecasting requires fresh data (within ${"7"} days). Activate a beef data source to enable predictions.`
				: "Insufficient real (non-bridge) price data for this cut. Forecasting requires ≥2 real price points.";
			return success(res, { cutCode, forecastable: false, reason });
		}

		try {
			const forecast = await generateBeefCutForecast(factory.factoryId, cutCode, horizon);
			success(res, {
				cutCode,
				forecastable: true,
				factoryId: factory.factoryId,
				dataPoints: factory.pointCount,
				currentPrice: factory.latestPrice,
				forecast,
			});
		} catch (err) {
			// Forecast can fail at inference-time (e.g. all models unavailable).
			// Return forecastable:false with the reason rather than a 500, so the
			// UI treats it as an honest "can't forecast" state.
			const reason = err instanceof Error ? err.message : String(err);
			success(res, { cutCode, forecastable: false, reason });
		}
	}),
);

/**
 * GET /api/beef/import/template
 *
 * Returns a CSV template (header + 2 example rows) that the admin import
 * page offers for download. This documents the exact CSV contract the
 * POST /import parser expects, so an operator never has to guess column
 * names or formats. Public — viewing the template is not sensitive.
 */
router.get(
	"/import/template",
	asyncHandler(async (_req, res) => {
		const csv =
			"factoryCode,cutCode,price,date,currency,unit,grade\n" +
			"AU-847,BRISKET_NAVEL,8.45,2026-07-25,USD,USD/kg,Choice\n" +
			"BR-SIF2057,STRIPLOIN,12.30,2026-07-25,USD,USD/kg,M7\n";
		// Force a download with a .csv filename rather than inline render.
		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader("Content-Disposition", 'attachment; filename="beef-prices-template.csv"');
		res.send(csv);
	}),
);

/**
 * POST /api/beef/import
 *
 * Manual beef cut price import — the no-API-key real-data path. An admin
 * uploads a CSV (factoryCode, cutCode, price, date[, currency, unit, grade])
 * and each row is upserted into BeefCutPrice with source='manual:<uploader>'.
 *
 * This is how real cut-level prices enter the platform when no scraper key is
 * configured. Manual rows are classified 'live' by the freshness framework
 * (recent, non-bridge, non-seed), so they unlock per-cut AI forecasts and
 * turn the SnapshotBanner off — the platform becomes honestly live without
 * any API key.
 *
 * ADMIN-only. Multipart form-data with a 'file' field. 10MB limit.
 * See services/beefImport.ts for the CSV contract.
 */
router.post(
	"/import",
	authenticate,
	authorize("ADMIN"),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		if (!req.is("multipart/form-data")) {
			throw new BadRequestError("Content-Type must be multipart/form-data");
		}

		const multer = (await import("multer")).default;
		const upload = multer({
			storage: multer.memoryStorage(),
			limits: { fileSize: 10 * 1024 * 1024 },
		});

		await new Promise<void>((resolve, reject) => {
			upload.single("file")(
				req as Parameters<ReturnType<typeof upload.single>>[0],
				res as Parameters<ReturnType<typeof upload.single>>[1],
				(err) => {
					if (err) reject(new BadRequestError(err.message));
					else resolve();
				},
			);
		});

		const file = (req as unknown as { file?: { buffer: Buffer } }).file;
		if (!file) {
			throw new BadRequestError("No file uploaded");
		}

		const rows = parseBeefCSV(file.buffer);
		if (rows.length === 0) {
			throw new BadRequestError("CSV is empty or has no data rows");
		}

		const uploader = req.user?.email ?? "unknown";
		const result = await importBeefPrices(rows, uploader);

		success(res, result, 201);
	}),
);

export { router as beefRouter };
