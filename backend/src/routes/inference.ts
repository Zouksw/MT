import { type Request, type Response, Router } from "express";
import { logger, prisma } from "@/lib";
import { authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError } from "@/middleware/errorHandler";
import { aiRateLimiter } from "@/middleware/rateLimiter";
import { get as cacheGet, cacheKeys, set as cacheSet } from "@/services/cache";
import { healthCheck as inferenceHealth, predictFromCache } from "@/services/inference";

const router = Router();

const VALID_MODELS = [
	"arima",
	"timer_xl",
	"sundial",
	"holtwinters",
	"exponential_smoothing",
	"naive_forecaster",
	"stl_forecaster",
	"chronos",
] as const;

type ModelId = (typeof VALID_MODELS)[number];

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
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, horizon, algorithm, confidenceLevel } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		const modelId: ModelId = VALID_MODELS.includes(algorithm) ? algorithm : "arima";
		const h = Math.min(Math.max(Number(horizon) || 10, 1), 100);
		const cl = Number(confidenceLevel) || 0.95;

		const cacheKey = cacheKeys.prediction(commodityId, modelId, h);
		const cachedResult = await cacheGet(cacheKey);
		if (cachedResult) {
			return res.json({ ...cachedResult, cached: true });
		}

		try {
			const result = await predictFromCache({
				commodityId,
				horizon: h,
				algorithm: modelId,
				confidenceLevel: cl,
			});

			const response = {
				timestamps: result.timestamps,
				values: result.values,
				lowerBound: result.lowerBound,
				upperBound: result.upperBound,
				algorithm: modelId,
			};

			await cacheSet(cacheKey, response, 900);
			res.json({ ...response, cached: false });
		} catch (error) {
			logger.error(`Prediction failed for ${commodityId}/${modelId}: ${error}`);
			throw error;
		}
	}),
);

// === Batch Predict ===

router.post(
	"/predict/batch",
	authenticate,
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

			const modelId: ModelId = VALID_MODELS.includes(r.algorithm) ? r.algorithm : "arima";
			const h = Math.min(Math.max(Number(r.horizon) || 10, 1), 100);
			const cl = Number(r.confidenceLevel) || 0.95;

			const cacheKey = cacheKeys.prediction(commodityId, modelId, h);
			const cachedResult = await cacheGet(cacheKey);

			if (cachedResult) {
				results.push({ ...cachedResult, cached: true, commodityId });
				cached++;
				continue;
			}

			try {
				const result = await predictFromCache({
					commodityId,
					horizon: h,
					algorithm: modelId,
					confidenceLevel: cl,
				});

				const response = {
					timestamps: result.timestamps,
					values: result.values,
					lowerBound: result.lowerBound,
					upperBound: result.upperBound,
					algorithm: modelId,
				};

				await cacheSet(cacheKey, response, 900);
				results.push({ ...response, cached: false, commodityId });
				computed++;
			} catch (error) {
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
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, horizon, algorithm, confidenceLevel, historyPoints } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		const modelId: ModelId = VALID_MODELS.includes(algorithm) ? algorithm : "arima";
		const h = Math.min(Math.max(Number(horizon) || 10, 1), 100);
		const cl = Number(confidenceLevel) || 0.95;
		const limit = Number(historyPoints) || 50;

		const [historicalData, predictionResult] = await Promise.all([
			prisma.commodityPrice.findMany({
				where: { commodityId, interval: "daily" },
				orderBy: { date: "desc" },
				take: limit,
				select: { date: true, close: true },
			}),
			predictFromCache({
				commodityId,
				horizon: h,
				algorithm: modelId,
				confidenceLevel: cl,
			}),
		]);

		res.json({
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
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, threshold, historyPoints } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		const th = Number(threshold) || 2.5;
		const limit = Number(historyPoints) || 100;

		const prices = await prisma.commodityPrice.findMany({
			where: { commodityId, interval: "daily" },
			orderBy: { date: "asc" },
			take: limit,
			select: { date: true, close: true },
		});

		const values = prices.map((p) => Number(p.close));
		const timestamps = prices.map((p) => p.date.getTime());

		// Guard: with zero price points, mean/std would be NaN and the loop below
		// silently returns an empty anomalies array — misleading the caller.
		if (values.length === 0) {
			throw new BadRequestError(
				"No price data available for anomaly detection on this commodity",
			);
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
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { commodityId, threshold, historyPoints } = req.body;

		if (!commodityId) {
			throw new BadRequestError("Missing required parameter: commodityId");
		}

		const th = Number(threshold) || 2.5;
		const limit = Number(historyPoints) || 100;

		const prices = await prisma.commodityPrice.findMany({
			where: { commodityId, interval: "daily" },
			orderBy: { date: "asc" },
			take: limit,
			select: { date: true, close: true },
		});

		const values = prices.map((p) => Number(p.close));
		const timestamps = prices.map((p) => p.date.getTime());

		// Guard: with zero price points, mean/std would be NaN and the loop below
		// silently returns an empty anomalies array — misleading the caller.
		if (values.length === 0) {
			throw new BadRequestError(
				"No price data available for anomaly detection on this commodity",
			);
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
		const inferenceUrl = process.env.INFERENCE_URL || "http://localhost:10810";
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

		res.json({
			models: VALID_MODELS.map((id) => ({ id, status: "available" })),
		});
	}),
);

router.get(
	"/models/:id",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { id } = req.params;
		if (!VALID_MODELS.includes(id as ModelId)) {
			throw new BadRequestError(`Unknown model: ${id}. Available: ${VALID_MODELS.join(", ")}`);
		}
		res.json({ id, status: "available" });
	}),
);

// === Train (no-op for statistical models, warmup for deep models) ===

router.post(
	"/models/train",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { algorithm, commodityId } = req.body;
		if (!algorithm) {
			throw new BadRequestError("Missing required parameter: algorithm");
		}

		res.json({
			modelId: algorithm,
			status: "ready",
			message: "Model is available for inference (statistical models need no training)",
			commodityId: commodityId || null,
		});
	}),
);

export { router as inferenceRouter };
