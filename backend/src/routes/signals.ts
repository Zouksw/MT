/**
 * Trading Signals API Routes
 *
 * Static routes (/models, /correlation, /commodities) MUST come before
 * the parameterized /:commodityId route to avoid Express matching them
 * as commodity IDs.
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib";
import { logger } from "@/lib/logger.js";
import { success } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import { cacheRoute } from "@/middleware/cacheDecorator";
import { asyncHandler, BadRequestError } from "@/middleware/errorHandler";
import { checkSignalChange } from "@/services/alertNotifications";
import { runBacktest } from "@/services/backtesting";
import {
	computeCorrelation,
	computeCorrelationMatrix,
	getAvailableCommodities,
} from "@/services/correlationAnalysis";
import {
	authoritativeSourceWhere,
	batchLatestPriceWhere,
	dedupeLatestByCommodity,
} from "@/services/inference/authoritativeSources";
import { getAllModelAccuracy, getModelAccuracy } from "@/services/mapeTracking";
import { getAllCachedPredictions } from "@/services/predictionCache";
import { BASELINE_MODELS, generateForecast, getAllModels } from "@/services/tradingSignals";

const router = Router();

const signalQuerySchema = z.object({
	horizon: z.coerce.number().min(1).max(100).default(10),
	currentPrice: z.coerce.number().positive().optional(),
	models: z.string().optional(), // comma-separated model IDs
});

// ─── Static routes (MUST come before /:commodityId) ───

/**
 * GET /api/signals/models
 *
 * List active trading models
 */
router.get(
	"/models",
	authenticate,
	asyncHandler(async (_req, res) => {
		const models = getAllModels();
		success(res, { models, count: models.length });
	}),
);

/**
 * GET /api/signals/models/accuracy
 *
 * Get MAPE accuracy for all models (for comparison view)
 */
router.get(
	"/models/accuracy",
	authenticate,
	cacheRoute("signals:models-accuracy", 600),
	asyncHandler(async (req: AuthRequest, res) => {
		const commodityId = req.query.commodityId as string | undefined;
		const days = parseInt(req.query.days as string, 10) || 30;

		const accuracy = await getAllModelAccuracy(commodityId, days);

		success(res, { accuracy, days });
	}),
);

/**
 * GET /api/signals/models/:modelId/accuracy
 *
 * Get detailed accuracy for a specific model
 */
router.get(
	"/models/:modelId/accuracy",
	authenticate,
	cacheRoute("signals:model-accuracy", 600),
	asyncHandler(async (req: AuthRequest, res) => {
		const { modelId } = req.params;
		const commodityId = req.query.commodityId as string | undefined;
		const days = parseInt(req.query.days as string, 10) || 30;

		// R3 (round-75): unknown-model guard. Refuse to surface accuracy for a
		// model_id the current inference engine doesn't serve (e.g. dead-era
		// ghost models timer_xl/sundial). Without this, a wildcard query
		// returns stale MAPE from orphan rows as if the model were live.
		// Returns the same zeroed shape getModelAccuracy yields for no data, so
		// the contract is unchanged for legitimate models.
		const known = new Set<string>([...getAllModels(), ...BASELINE_MODELS]);
		if (!known.has(modelId)) {
			return success(res, {
				modelId,
				avgMape: null,
				predictionCount: 0,
				verifiedCount: 0,
				last7dMape: null,
				last30dMape: null,
				lastVerifiedAt: null,
			});
		}

		const accuracy = await getModelAccuracy(modelId, commodityId, days);

		success(res, accuracy);
	}),
);

/**
 * GET /api/signals/models/:modelId/backtest
 *
 * Run backtest for a specific model — compares past predictions
 * against actual outcomes over 7/30/90 day windows.
 */
router.get(
	"/models/:modelId/backtest",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { modelId } = req.params;
		const commodityId = req.query.commodityId as string | undefined;
		const windowsParam = req.query.windows as string | undefined;
		const windows = windowsParam
			? windowsParam
					.split(",")
					.map(Number)
					.filter((n) => n > 0)
			: [7, 30, 90];

		const result = await runBacktest(modelId, commodityId, windows);
		success(res, result);
	}),
);

/**
 * GET /api/signals/models/:modelId/predictions
 *
 * Get verified prediction logs for a model with predicted vs actual values.
 * Supports pagination and commodity filter.
 */
router.get(
	"/models/:modelId/predictions",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { modelId } = req.params;
		const commodityId = req.query.commodityId as string | undefined;
		const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
		const offset = parseInt(req.query.offset as string, 10) || 0;

		const where: Record<string, unknown> = {
			modelId,
			status: "verified",
		};
		if (commodityId) where.commodityId = commodityId;

		const [logs, total] = await Promise.all([
			prisma.predictionLog.findMany({
				where,
				select: {
					id: true,
					commodityId: true,
					horizon: true,
					predictedValues: true,
					actualValues: true,
					lowerBounds: true,
					upperBounds: true,
					confidence: true,
					mape: true,
					status: true,
					predictedAt: true,
					verifiedAt: true,
				},
				orderBy: { predictedAt: "desc" },
				take: limit,
				skip: offset,
			}),
			prisma.predictionLog.count({ where }),
		]);

		success(res, { predictions: logs, total, limit, offset });
	}),
);

/**
 * GET /api/signals/correlation
 *
 * Compute Pearson correlation between two commodities
 */
router.get(
	"/correlation",
	authenticate,
	cacheRoute("signals:correlation", 1800),
	asyncHandler(async (req: AuthRequest, res) => {
		const { a, b, window } = req.query as {
			a?: string;
			b?: string;
			window?: string;
		};

		if (!a || !b) {
			throw new BadRequestError('Query params "a" and "b" (commodity slugs) are required');
		}

		const windowDays = parseInt(window || "30", 10);
		const result = await computeCorrelation(a, b, windowDays);

		success(res, result);
	}),
);

/**
 * GET /api/signals/correlation/matrix
 *
 * Compute full pairwise correlation matrix
 */
router.get(
	"/correlation/matrix",
	authenticate,
	cacheRoute("signals:correlation-matrix", 1800),
	asyncHandler(async (req: AuthRequest, res) => {
		const { commodities, window } = req.query as {
			commodities?: string;
			window?: string;
		};

		const windowDays = parseInt(window || "30", 10);

		let commodityIds: string[];
		if (commodities) {
			commodityIds = commodities.split(",").filter(Boolean);
		} else {
			// Use all available commodities
			const available = await getAvailableCommodities();
			commodityIds = available.map((c) => c.slug);
		}

		if (commodityIds.length < 2) {
			throw new BadRequestError("At least 2 commodities required for correlation");
		}

		const matrix = await computeCorrelationMatrix(commodityIds, windowDays);

		success(res, matrix);
	}),
);

/**
 * GET /api/signals/commodities
 *
 * List available commodities for correlation analysis
 */
router.get(
	"/commodities",
	authenticate,
	asyncHandler(async (_req, res) => {
		const commodities = await getAvailableCommodities();
		success(res, commodities);
	}),
);

// ─── Parameterized routes ───

/**
 * POST /api/signals/batch
 *
 * Generate consensus forecasts for multiple commodities in one request.
 * Returns one PriceForecast per slug (direction/confidence/modelsAgree/
 * predictedChange/range) — the full consensus shape, not the raw
 * inference/batch array. Used by the market forecast board so each row
 * surfaces confidence + model agreement inline (PRODUCT-SPEC §5.3),
 * avoiding N parallel /signals/:slug calls from the client.
 *
 * Body: { slugs: string[], horizon?: number }
 * Response: { forecasts: Array<{ slug, ok, forecast?, error? }> }
 *
 * Fault-tolerant: a commodity with no price data returns {ok:false, error}
 * rather than failing the whole batch.
 */
const batchSignalsSchema = z.object({
	slugs: z.array(z.string().min(1)).min(1).max(50),
	horizon: z.coerce.number().min(1).max(100).default(7),
});

router.post(
	"/batch",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { slugs, horizon } = batchSignalsSchema.parse(req.body);

		// Resolve slugs → commodities in one query (avoid N findFirst calls).
		const commodities = await prisma.commodity.findMany({
			where: { slug: { in: slugs } },
			select: { id: true, slug: true },
		});
		const bySlug = new Map(commodities.map((c) => [c.slug, c]));
		const priceByCommodityId = new Map<string, number>();

		// Fetch the latest close per commodity in one query, applying
		// authoritative-source resolution per commodity so conflict slugs
		// (brl_usd/corn_cme/natural_gas_cme) read the correct source instead
		// of whichever source wrote most recently. Round-67: the previous
		// `distinct:["commodityId"]` + date-desc ordering picked an arbitrary
		// source for conflict commodities (e.g. brl_usd got the inverted
		// exchange_rate_api ~0.2 instead of fred's ~5.0).
		const batchWhere = batchLatestPriceWhere(commodities);
		if (batchWhere) {
			const rows = await prisma.commodityPrice.findMany({
				where: batchWhere,
				orderBy: { date: "desc" },
				select: { commodityId: true, close: true, date: true },
			});
			const latest = dedupeLatestByCommodity(rows);
			for (const [id, row] of latest) priceByCommodityId.set(id, Number(row.close));
		}

		// Run forecasts in parallel — each settled independently so one bad
		// commodity doesn't sink the batch.
		const settled = await Promise.allSettled(
			slugs.map(async (slug) => {
				const commodity = bySlug.get(slug);
				if (!commodity) throw new Error(`Commodity "${slug}" not found`);
				const currentPrice = priceByCommodityId.get(commodity.id) ?? 0;
				if (!currentPrice) throw new Error("No current price — insufficient data");
				const forecast = await generateForecast({
					commodityId: commodity.id,
					horizon,
					currentPrice,
				});
				return { slug, ok: true as const, forecast };
			}),
		);

		const forecasts = settled.map((r, i) => {
			const slug = slugs[i];
			if (r.status === "fulfilled") return r.value;
			const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
			return { slug, ok: false as const, error: msg };
		});

		success(res, { forecasts });
	}),
);

/**
 * GET /api/signals/:commodityId
 *
 * Generate a trading signal for a commodity by running predictions
 * from multiple models and computing consensus.
 */
router.get(
	"/:commodityId",
	authenticate,
	cacheRoute("signals:commodity", 300), // cache for 5 minutes
	asyncHandler(async (req: AuthRequest, res) => {
		const { commodityId } = req.params;
		const params = signalQuerySchema.parse(req.query);

		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			commodityId,
		);
		const priceWhere = isUuid ? { commodityId } : { commodity: { slug: commodityId } };

		const commodity = isUuid
			? await prisma.commodity.findUnique({ where: { id: commodityId } })
			: await prisma.commodity.findFirst({ where: { slug: commodityId } });
		if (!commodity) {
			throw new BadRequestError(
				`Commodity "${commodityId}" not found. Use GET /api/signals/commodities to list available commodities.`,
			);
		}

		let currentPrice = params.currentPrice;
		if (!currentPrice || !Number.isFinite(currentPrice)) {
			const latest = await prisma.commodityPrice.findFirst({
				where: { ...priceWhere, ...authoritativeSourceWhere(commodity.slug) },
				orderBy: { date: "desc" },
				select: { close: true, commodityId: true },
			});
			currentPrice = latest?.close ? Number(latest.close) : 0;
		}

		const models = params.models ? params.models.split(",").filter((m) => m) : undefined;

		const forecast = await generateForecast({
			commodityId: commodity.id,
			horizon: params.horizon,
			currentPrice,
			models,
		});

		// Check for forecast-direction changes and send notifications (non-blocking)
		const io = req.app.get("io");
		checkSignalChange(commodityId, forecast.direction, forecast.confidence, io).catch((err) =>
			logger.warn("Signal change check failed:", err),
		);

		success(res, {
			commodityId,
			...forecast,
			timestamp: new Date().toISOString(),
		});
	}),
);

/**
 * GET /api/signals/:commodityId/predictions
 *
 * Get all cached predictions for a commodity (quick load for dashboard)
 */
router.get(
	"/:commodityId/predictions",
	authenticate,
	cacheRoute("signals:predictions", 300),
	asyncHandler(async (req: AuthRequest, res) => {
		const { commodityId } = req.params;
		const horizon = parseInt(req.query.horizon as string, 10) || 10;
		const models = getAllModels();

		const predictions = await getAllCachedPredictions(commodityId, horizon, models);

		success(res, {
			commodityId,
			horizon,
			predictions: Object.fromEntries(predictions),
			cachedAt: new Date().toISOString(),
		});
	}),
);

export { router as signalsRouter };
