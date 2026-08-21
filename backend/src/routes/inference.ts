import { type Request, type Response, Router } from "express";
import { config, logger, prisma } from "@/lib";
import { success } from "@/lib/response";
import { checkAIAccess } from "@/middleware/aiAccess";
import { authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError } from "@/middleware/errorHandler";
import { aiRateLimiter } from "@/middleware/rateLimiter";
import { get as cacheGet, cacheKeys, set as cacheSet } from "@/services/cache";
import { healthCheck as inferenceHealth, predictFromCache } from "@/services/inference";
import { authoritativeSourceWhere } from "@/services/inference/authoritativeSources";
import { applyConformalInterval, getIntervalMultipliers } from "@/services/intervalCalibration";
import { getValidModels, isValidModel } from "@/services/modelRegistry";
import { PREDICTION_TTL_SECONDS } from "@/services/predictionCache";

/**
 * Conformal-calibrate a raw inference result's interval (round-110). The
 * on-demand paths build responses from predictFromCache directly — unlike
 * runAndCachePrediction they skip the calibration hook, so it is applied
 * here. Enhancement-not-dependency: on any failure the native bounds are
 * returned untouched.
 */
async function calibrateBounds(
	modelId: string,
	result: {
		values: number[];
		lowerBound?: number[];
		upperBound?: number[];
	},
): Promise<{ lowerBound?: number[]; upperBound?: number[] }> {
	try {
		const multipliers = await getIntervalMultipliers();
		const calibrated = applyConformalInterval(result.values, multipliers.get(modelId));
		return {
			lowerBound: calibrated.lowerBound ?? result.lowerBound,
			upperBound: calibrated.upperBound ?? result.upperBound,
		};
	} catch (error) {
		logger.warn(`[CONFORMAL] route calibration failed for ${modelId}: ${error}`);
		return { lowerBound: result.lowerBound, upperBound: result.upperBound };
	}
}

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a caller-supplied commodityId into the UUID that the price table is
 * keyed on. Callers (frontend, clients) may pass either a UUID or a slug such
 * as "crude_oil_cme"; the underlying CommodityPrice.commodityId column only
 * matches UUIDs. Mirrors the resolution in routes/signals.ts:258-270.
 *
 * Returns the UUID, or throws BadRequestError when the slug/UUID is unknown.
 * Splitting this from the existence check would let callers probe which ids
 * exist, so the 400 carries no existence signal beyond "not found".
 */
async function resolveCommodityId(input: string): Promise<string> {
	if (UUID_RE.test(input)) return input;
	const commodity = await prisma.commodity.findFirst({ where: { slug: input } });
	if (!commodity) {
		throw new BadRequestError(
			`Commodity "${input}" not found. Use GET /api/signals/commodities to list available commodities.`,
		);
	}
	return commodity.id;
}

/**
 * Resolve a caller-supplied commodityId/UUID into the full commodity row
 * (id + slug). The slug is needed to apply authoritative-source filtering
 * (docs/KNOWN-ISSUES.md R2) on direct CommodityPrice reads in this router.
 * Throws BadRequestError when the slug/UUID is unknown.
 */
async function resolveCommodity(input: string): Promise<{ id: string; slug: string }> {
	if (UUID_RE.test(input)) {
		const found = await prisma.commodity.findUnique({
			where: { id: input },
			select: { id: true, slug: true },
		});
		if (!found) {
			throw new BadRequestError(
				`Commodity "${input}" not found. Use GET /api/signals/commodities to list available commodities.`,
			);
		}
		return found;
	}
	const commodity = await prisma.commodity.findFirst({
		where: { slug: input },
		select: { id: true, slug: true },
	});
	if (!commodity) {
		throw new BadRequestError(
			`Commodity "${input}" not found. Use GET /api/signals/commodities to list available commodities.`,
		);
	}
	return commodity;
}

// Callable model ids come from the model registry (round-115): seeded for
// cold boot, reconciled hourly from inference-service GET /models — the
// single source of truth. The /ai predict page lets users call ANY callable
// model for comparison.

// Default model when none specified — the smallest chronos variant (fast + zero-shot).
const DEFAULT_MODEL = "chronos_tiny";

// === Status ===

router.get(
	"/status",
	asyncHandler(async (_req: Request, res: Response) => {
		const isHealthy = await inferenceHealth();
		// Intentionally do NOT echo process.env.INFERENCE_URL — that leaked an
		// internal service address to unauthenticated callers. Health probes need
		// only the status, not the backend URL.
		res.json({
			status: isHealthy ? "healthy" : "unhealthy",
			timestamp: new Date().toISOString(),
			service: "inference",
		});
	}),
);

// === Predict ===

router.post(
	"/predict",
	authenticate,
	checkAIAccess,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, horizon, algorithm, confidenceLevel } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		// Callers may pass either a UUID or a slug (e.g. "crude_oil_cme").
		// resolve to the UUID the price table and the prewarmed cache are keyed
		// on. Without this, a slug produced "Insufficient price data: 0 points"
		// because CommodityPrice.commodityId only matches UUIDs.
		const uuid = await resolveCommodityId(commodityId);

		const modelId = isValidModel(algorithm) ? algorithm : DEFAULT_MODEL;
		const h = Math.min(Math.max(Number(horizon) || 10, 1), 100);
		const cl = Number(confidenceLevel) || 0.95;

		const cacheKey = cacheKeys.prediction(uuid, modelId, h);
		const cachedResult = await cacheGet(cacheKey);
		if (cachedResult) {
			return success(res, { ...cachedResult, commodityId, cached: true });
		}

		// Errors propagate to errorHandler via asyncHandler (which logs + shapes
		// the response). No try/catch needed here — it would only double-log.
		const result = await predictFromCache({
			commodityId: uuid,
			horizon: h,
			algorithm: modelId,
			confidenceLevel: cl,
		});

		const { lowerBound, upperBound } = await calibrateBounds(modelId, result);
		const response = {
			timestamps: result.timestamps,
			values: result.values,
			lowerBound,
			upperBound,
			algorithm: modelId,
		};

		// Same key family as the background refresh — write the full
		// CachedPrediction shape with the shared TTL (round-114, INT-1).
		await cacheSet(
			cacheKey,
			{ ...response, cachedAt: Date.now(), commodityId: uuid, horizon: h },
			PREDICTION_TTL_SECONDS,
		);
		success(res, { ...response, commodityId, cached: false });
	}),
);

// === Batch Predict ===

router.post(
	"/predict/batch",
	authenticate,
	checkAIAccess,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { requests } = req.body;
		if (!Array.isArray(requests) || requests.length === 0) {
			throw new BadRequestError("Missing required parameter: requests (array)");
		}
		if (requests.length > 50) {
			throw new BadRequestError("Batch request limit exceeded (max 50)");
		}

		const results: Record<string, unknown>[] = [];
		let cached = 0;
		let computed = 0;

		for (const r of requests) {
			const commodityId = r.commodityId;
			if (!commodityId) {
				results.push({ error: "Missing commodityId" });
				continue;
			}

			const modelId = isValidModel(r.algorithm) ? r.algorithm : DEFAULT_MODEL;
			const h = Math.min(Math.max(Number(r.horizon) || 10, 1), 100);
			const cl = Number(r.confidenceLevel) || 0.95;

			// Resolve slug→UUID inside the try so an unknown id is reported per-row
			// (matching the existing per-row error contract) rather than failing
			// the whole batch.
			let uuid: string;
			try {
				uuid = await resolveCommodityId(commodityId);
			} catch (err) {
				logger.warn(`[inference/batch] resolveCommodityId failed for ${commodityId}: ${err}`);
				results.push({
					error: err instanceof Error ? err.message : String(err),
					commodityId,
				});
				continue;
			}

			const cacheKey = cacheKeys.prediction(uuid, modelId, h);
			const cachedResult = await cacheGet(cacheKey);

			if (cachedResult) {
				results.push({ ...cachedResult, cached: true, commodityId });
				cached++;
				continue;
			}

			try {
				const result = await predictFromCache({
					commodityId: uuid,
					horizon: h,
					algorithm: modelId,
					confidenceLevel: cl,
				});

				const { lowerBound, upperBound } = await calibrateBounds(modelId, result);
				const response = {
					timestamps: result.timestamps,
					values: result.values,
					lowerBound,
					upperBound,
					algorithm: modelId,
				};

				// Same key family as the background refresh — write the full
				// CachedPrediction shape with the shared TTL (round-114, INT-1).
				await cacheSet(
					cacheKey,
					{ ...response, cachedAt: Date.now(), commodityId: uuid, horizon: h },
					PREDICTION_TTL_SECONDS,
				);
				results.push({ ...response, cached: false, commodityId });
				computed++;
			} catch (error) {
				logger.warn(`[inference/batch] prediction failed for ${commodityId}: ${error}`);
				results.push({
					error: error instanceof Error ? error.message : String(error),
					commodityId,
				});
			}
		}

		res.json({
			results,
			summary: { total: requests.length, cached, computed },
		});
	}),
);

// === Predict Visualize ===

router.post(
	"/predict/visualize",
	authenticate,
	checkAIAccess,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, horizon, algorithm, confidenceLevel, historyPoints } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		const commodity = await resolveCommodity(commodityId);
		const uuid = commodity.id;

		const modelId = isValidModel(algorithm) ? algorithm : DEFAULT_MODEL;
		const h = Math.min(Math.max(Number(horizon) || 10, 1), 100);
		const cl = Number(confidenceLevel) || 0.95;
		// Clamp like `h` (round-06): an unclamped historyPoints reached Prisma
		// take directly — ?historyPoints=5000000 pulled 5M rows into Node.
		const limit = Math.min(Math.max(Number(historyPoints) || 50, 1), 1000);

		const [historicalData, predictionResult] = await Promise.all([
			prisma.commodityPrice.findMany({
				where: {
					commodityId: uuid,
					interval: "daily",
					...authoritativeSourceWhere(commodity.slug),
				},
				orderBy: { date: "desc" },
				take: limit,
				select: { date: true, close: true },
			}),
			predictFromCache({
				commodityId: uuid,
				horizon: h,
				algorithm: modelId,
				confidenceLevel: cl,
			}),
		]);

		success(res, {
			commodityId,
			historical: historicalData.map((p) => ({
				timestamp: p.date.getTime(),
				value: Number(p.close),
			})),
			prediction: predictionResult,
			algorithm: modelId,
		});
	}),
);

// === Anomalies (Z-score, no ML needed) ===

router.post(
	"/anomalies",
	authenticate,
	checkAIAccess,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, threshold, historyPoints } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		const commodity = await resolveCommodity(commodityId);
		const uuid = commodity.id;

		const th = Number(threshold) || 2.5;
		// Clamp like the /predict visualize path (round-06): unclamped
		// historyPoints went straight into Prisma take.
		const limit = Math.min(Math.max(Number(historyPoints) || 100, 1), 1000);

		const prices = await prisma.commodityPrice.findMany({
			where: {
				commodityId: uuid,
				interval: "daily",
				...authoritativeSourceWhere(commodity.slug),
			},
			orderBy: { date: "asc" },
			take: limit,
			select: { date: true, close: true },
		});

		const values = prices.map((p) => Number(p.close));
		const timestamps = prices.map((p) => p.date.getTime());

		// Guard: with zero price points, mean/std would be NaN and the loop below
		// silently returns an empty anomalies array — misleading the caller.
		if (values.length === 0) {
			throw new BadRequestError("No price data available for anomaly detection on this commodity");
		}

		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

		const anomalies: Array<{
			timestamp: number;
			value: number;
			score: number;
			severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
		}> = [];

		for (let i = 0; i < values.length; i++) {
			const zscore = std > 0 ? Math.abs((values[i] - mean) / std) : 0;
			if (zscore > th) {
				const severity =
					zscore > 5 ? "CRITICAL" : zscore > 4 ? "HIGH" : zscore > 3 ? "MEDIUM" : "LOW";
				anomalies.push({
					timestamp: timestamps[i],
					value: values[i],
					score: zscore,
					severity,
				});
			}
		}

		const bySeverity: Record<string, number> = {};
		for (const a of anomalies) {
			bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
		}

		res.json({
			anomalies,
			statistics: { total: anomalies.length, bySeverity },
		});
	}),
);

// === Anomalies Visualize ===

router.post(
	"/anomalies/visualize",
	authenticate,
	checkAIAccess,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, threshold, historyPoints } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		const commodity = await resolveCommodity(commodityId);
		const uuid = commodity.id;

		const th = Number(threshold) || 2.5;
		// Clamp like the /predict visualize path (round-06): unclamped
		// historyPoints went straight into Prisma take.
		const limit = Math.min(Math.max(Number(historyPoints) || 100, 1), 1000);

		const prices = await prisma.commodityPrice.findMany({
			where: {
				commodityId: uuid,
				interval: "daily",
				...authoritativeSourceWhere(commodity.slug),
			},
			orderBy: { date: "asc" },
			take: limit,
			select: { date: true, close: true },
		});

		const values = prices.map((p) => Number(p.close));
		const timestamps = prices.map((p) => p.date.getTime());

		// Guard: with zero price points, mean/std would be NaN and the loop below
		// silently returns an empty anomalies array — misleading the caller.
		if (values.length === 0) {
			throw new BadRequestError("No price data available for anomaly detection on this commodity");
		}

		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

		const anomalies: Array<{
			timestamp: number;
			value: number;
			score: number;
			severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
		}> = [];

		for (let i = 0; i < values.length; i++) {
			const zscore = std > 0 ? Math.abs((values[i] - mean) / std) : 0;
			if (zscore > th) {
				const severity =
					zscore > 5 ? "CRITICAL" : zscore > 4 ? "HIGH" : zscore > 3 ? "MEDIUM" : "LOW";
				anomalies.push({
					timestamp: timestamps[i],
					value: values[i],
					score: zscore,
					severity,
				});
			}
		}

		const bySeverity: Record<string, number> = {};
		for (const a of anomalies) {
			bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
		}

		success(res, {
			commodityId,
			historical: prices.map((p) => ({
				timestamp: p.date.getTime(),
				value: Number(p.close),
			})),
			anomalies,
			statistics: { total: anomalies.length, bySeverity },
		});
	}),
);

// === Models ===

router.get(
	"/models",
	authenticate,
	asyncHandler(async (_req: Request, res: Response) => {
		const inferenceUrl = config.inference.url;
		try {
			const response = await fetch(`${inferenceUrl}/models`, {
				signal: AbortSignal.timeout(5000),
			});
			if (response.ok) {
				const data = await response.json();
				res.json(data);
				return;
			}
		} catch (error) {
			logger.warn(
				"[INFERENCE] Failed to fetch models from inference service, using static list",
				error,
			);
		}

		// Service unreachable: report "unknown", NOT "available" — claiming a
		// model is available when we could not probe anything is fabricated
		// status (round-106 honesty fix; the /train endpoint was retired for
		// exactly this class of fabrication).
		res.json({
			models: getValidModels().map((id) => ({ id, status: "unknown" })),
		});
	}),
);

router.get(
	"/models/:id",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!isValidModel(id)) {
			throw new BadRequestError(`Unknown model: ${id}. Available: ${getValidModels().join(", ")}`);
		}

		// The inference service exposes one /models listing (no per-model
		// route); probe it and surface the entry for this id. Never guess.
		const inferenceUrl = config.inference.url;
		try {
			const response = await fetch(`${inferenceUrl}/models`, {
				signal: AbortSignal.timeout(5000),
			});
			if (response.ok) {
				const data = (await response.json()) as {
					models?: Array<{ id: string; status?: string }>;
				};
				const entry = data.models?.find((m) => m.id === id);
				res.json(entry ?? { id, status: "unknown" });
				return;
			}
		} catch (error) {
			logger.warn("[INFERENCE] Failed to probe models for /models/:id", error);
		}
		res.json({ id, status: "unknown" });
	}),
);

// === Train (removed — architecture is pretrained-model-only) ===
// The previous handler returned a canned {status:"ready"} for every call,
// implying training had occurred when nothing happened. The inference
// architecture is foundation-model-only (Chronos) + ready statistical
// models — none require per-request training. Rather than fabricate a
// "trained" response, this endpoint now signals it is gone so callers stop
// depending on a no-op. Use POST /api/inference/predict to run a model.

router.post(
	"/models/train",
	authenticate,
	checkAIAccess,
	asyncHandler(async (_req: Request, res: Response) => {
		res.status(410).json({
			success: false,
			error: {
				code: "GONE",
				message:
					"Model training is not supported. The inference architecture serves pretrained foundation models (Chronos) and ready statistical models — none require training. Use POST /api/inference/predict to run a forecast.",
			},
		});
	}),
);

export { router as inferenceRouter };
