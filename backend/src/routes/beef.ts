import { Router } from "express";
import { logger, prisma } from "@/lib";
import { success } from "@/lib/response";
import { checkAIAccess } from "@/middleware/aiAccess";
import type { AuthenticatedRequest } from "@/middleware/auth";
import { authenticate, authorize } from "@/middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { aiRateLimiter } from "@/middleware/rateLimiter";
import { getPagination } from "@/schemas";
import { importBeefPrices, parseBeefCSV } from "@/services/beefIngest";
import {
	batchBeefForecasts,
	beefCutForecast,
	beefPriceHistory,
	computeBeefSpreads,
	latestBeefPrices,
	queryBeefPrices,
} from "@/services/beefPriceQueries";
import { aggregateBeefByCountry } from "@/services/beefQueries";

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
			// Same cap as the /cuts sibling above (round-106 consistency).
			take: 200,
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
		const { skip, take } = getPagination(req.query);
		success(res, await queryBeefPrices(req.query, skip, take));
	}),
);

// Price summary per cut (latest price for each cut)
router.get(
	"/prices/latest",
	asyncHandler(async (req, res) => {
		success(res, await latestBeefPrices(req.query));
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
		// Aggregation logic lives in services/beefAggregation.ts (extracted for
		// testability — this route previously had no test coverage).
		const result = await aggregateBeefByCountry(source, cutsLimit);
		success(res, result);
	}),
);

// Price history for a specific cut — supports multi-factory comparison
// (comma-separated factoryCode) and ISO date-range (from/to) for the
// 产地对比 analysis (PRODUCT-SPEC §四 分析 > 产地对比).
router.get(
	"/prices/history/:cutCode",
	asyncHandler(async (req, res) => {
		success(res, await beefPriceHistory(req.params.cutCode, req.query));
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
		success(res, await computeBeefSpreads(req.query));
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
	// One ensemble per forecastable cut — the heaviest inference path in the
	// API (audit C6). Same tier gate + rate limiter as /api/inference/predict.
	checkAIAccess,
	aiRateLimiter,
	asyncHandler(async (req, res) => {
		const horizon = Math.min(Number(req.query.horizon) || 7, 30);
		success(res, await batchBeefForecasts(horizon));
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
	// Multi-model ensemble for the cut's series — tier gate + rate limiter
	// match /forecasts and /api/inference/predict (audit C6; the doc comment
	// above claimed this gate but only authenticate was wired).
	checkAIAccess,
	aiRateLimiter,
	asyncHandler(async (req, res) => {
		const result = await beefCutForecast(req.params.cutCode, req.query);
		success(res, result);
	}),
);

/**
 * GET /api/beef/import/template
 *
 * Returns a CSV template (header + 2 example rows) that the admin import
 * page offers for download. This documents the exact CSV contract the
 * POST /import parser expects, so an operator never has to guess column
 * names or formats. Public — viewing the template is not sensitive.
 *
 * The five trailing columns are the optional quotation-spec dimensions
 * (V7 批3): feedingMethod / feedingDays / vendorLabel (VL) / breed /
 * storage — empty cells are simply omitted, non-empty ones land in
 * BeefCutPrice.metadata.
 */
router.get(
	"/import/template",
	asyncHandler(async (_req, res) => {
		const csv =
			"factoryCode,cutCode,price,date,currency,unit,grade,feedingMethod,feedingDays,vendorLabel,breed,storage\n" +
			"AU-847,BRISKET_NAVEL,8.45,2026-07-25,USD,USD/kg,Choice,Grain-fed,150,,Angus,Port\n" +
			"BR-SIF2057,STRIPLOIN,12.30,2026-07-25,USD,USD/kg,M7,Grass-fed,,,,Warehouse\n";
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
 * See services/beefIngest.ts (beefImport section) for the CSV contract.
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

		// Evict stale prediction caches for every cut pair that got new data.
		// Without this, /api/beef/forecasts/:cutCode would return predictions
		// built on the OLD price series for up to 45 min (the Redis TTL) —
		// dishonest after the operator just provided newer data. Fire-and-forget
		// (errors here must not fail the import, which already committed).
		if (result.affectedCuts.length > 0) {
			void (async () => {
				const { invalidateCutSeriesCache } = await import("@/services/predictionCache");
				let evicted = 0;
				for (const cut of result.affectedCuts) {
					evicted += await invalidateCutSeriesCache(cut.factoryId, cut.cutCode);
				}
				if (evicted > 0) {
					logger.info(
						`[BEEF IMPORT] Evicted ${evicted} stale prediction cache keys across ${result.affectedCuts.length} cut(s)`,
					);
				}
			})().catch((err) => logger.warn(`[BEEF IMPORT] Cache eviction failed (non-fatal): ${err}`));
		}

		success(res, result, 201);
	}),
);

export { router as beefRouter };
