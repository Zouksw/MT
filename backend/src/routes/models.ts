import { type ModelAlgorithm, Prisma } from "@prisma/client";
import { Router } from "express";
import { logger, prisma } from "@/lib";
import { paginated, success, successWithMessage } from "@/lib/response";
import { checkAIAccess } from "@/middleware/aiAccess";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { getPagination, limitSchema } from "@/schemas/common";
import { modelsQuerySchema, predictSchema } from "@/schemas/models";
import {
	createForecasts,
	deleteForecasts,
	deleteModel,
	getModel,
	listForecasts,
	listModels,
	setModelActive,
} from "@/services/modelService";

const router = Router();

/**
 * @openapi
 * /api/models:
 *   get:
 *     tags: [Models]
 *     summary: List all forecasting models
 *     description: Retrieves a paginated list of forecasting models with optional filters.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: timeseriesId
 *         schema: { type: string }
 *         description: Filter by time series ID
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *         description: Filter by active status
 *       - in: query
 *         name: algorithm
 *         schema: { type: string }
 *         description: Filter by algorithm type
 *     responses:
 *       200:
 *         description: Paginated list of forecasting models
 */
// GET /api/models - Get all forecasting models
router.get(
	"/",
	authenticate,
	asyncHandler(async (req, res) => {
		const { timeseriesId, algorithm } = req.query;
		const { skip, take } = getPagination(req.query);
		const params = modelsQuerySchema.parse(req.query);

		const { models, total } = await listModels({
			timeseriesId: timeseriesId as string | undefined,
			isActive: params.isActive,
			algorithm: algorithm as string | undefined,
			skip,
			take,
		});
		return paginated(res, models, {
			page: params.page,
			limit: params.limit,
			total,
			totalPages: Math.ceil(total / params.limit),
		});
	}),
);

/**
 * @openapi
 * /api/models/{id}:
 *   get:
 *     tags: [Models]
 *     summary: Get a single forecasting model
 *     description: Retrieves a model by ID with time series, trainer info, and recent forecasts.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Model ID
 *     responses:
 *       200:
 *         description: Model details with forecasts
 *       404:
 *         description: Model not found
 */
// GET /api/models/:id - Get single model
router.get(
	"/:id",
	authenticate,
	asyncHandler(async (req, res) => {
		const model = await getModel(req.params.id);
		return success(res, { model });
	}),
);

/**
 * @openapi
 * /api/models/train:
 *   post:
 *     tags: [Models]
 *     summary: Train a new forecasting model (deprecated)
 *     description: >
 *       Deprecated. Returns 410 Gone. The inference architecture serves
 *       pretrained foundation models (Chronos) and ready statistical models —
 *       none require per-request training. Previously this endpoint persisted a
 *       "trained+deployed" model record without invoking any training, which
 *       fabricated the appearance of a trained model (AGENTS §十.3). Use
 *       POST /api/inference/predict to run a forecast instead.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: No AI access (VIEWER tier)
 *       410:
 *         description: Endpoint gone — training is not supported
 */
// POST /api/models/train — 410 Gone.
// The previous handler inserted a ForecastingModel row marked isActive:true /
// deployedAt:now / trainingMetrics without ever calling the inference service
// to train anything (the client has no train function). That fabricated a
// "trained+deployed" record — the same dishonesty that saw the sibling route
// /api/inference/models/train retired to 410 in round-20. Use predict instead.
router.post(
	"/train",
	authenticate,
	checkAIAccess,
	asyncHandler(async (_req: AuthenticatedRequest, res) => {
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

/**
 * @openapi
 * /api/models/{modelId}/predict:
 *   post:
 *     tags: [Models]
 *     summary: Generate forecast using a model
 *     description: Generates a forecast using the specified trained model via inference service. The model must be active.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema: { type: string }
 *         description: Model ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [horizon]
 *             properties:
 *               horizon:
 *                 type: integer
 *                 description: Number of future time steps to forecast
 *                 example: 10
 *               confidenceLevel:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.95
 *                 description: Confidence level for prediction intervals
 *     responses:
 *       201:
 *         description: Forecast generated successfully
 *       400:
 *         description: Model not active or inference service prediction failed
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Model not found
 */
// POST /api/models/:modelId/predict - Generate forecast using inference service (requires authentication)
router.post(
	"/:modelId/predict",
	authenticate,
	checkAIAccess,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { modelId } = req.params;
		const validatedData = predictSchema.parse(req.body);

		const model = await prisma.forecastingModel.findUnique({
			where: { id: modelId },
			include: {
				timeseries: true,
			},
		});

		if (!model) {
			throw new NotFoundError("Model");
		}

		if (!model.isActive) {
			throw new BadRequestError("Model is not active");
		}

		// Generate predictions using inference service
		const { predict } = await import("@/services/inference/client");
		const { getCommodityPriceValues } = await import("@/services/inference/data-fetcher");

		const algorithm = model.algorithm || "arima";
		const horizon = validatedData.horizon;
		const confidenceLevel = validatedData.confidenceLevel || 0.95;

		let tsData: { values: number[]; timestamps: number[] };
		try {
			tsData = await getCommodityPriceValues(model.timeseriesId, 200);
		} catch (error) {
			logger.warn("[MODELS] Failed to fetch price data for prediction", error);
			throw new BadRequestError(
				"Insufficient price data for prediction. Need at least 2 data points.",
			);
		}

		const predictResult = await predict({
			values: tsData.values,
			timestamps: tsData.timestamps,
			model_id: algorithm,
			horizon,
			confidence_level: confidenceLevel,
		});

		// Build forecast records.
		// NOTE: anomalyProbability is left null and isAnomaly is omitted (uses
		// its schema default). This prediction path does NOT run anomaly
		// detection — writing a hardcoded anomalyProbability:0 / isAnomaly:false
		// would fabricate "0% chance, definitely not an anomaly" for every row,
		// which is a dishonest claim about a quantity we never computed. null
		// means "not assessed by this model", which is the truth. The dedicated
		// /api/anomalies/detect endpoint is where real anomaly scores come from.
		const forecasts = predictResult.timestamps.map((ts, i) => ({
			modelId,
			timeseriesId: model.timeseriesId,
			timestamp: new Date(ts),
			predictedValue: new Prisma.Decimal(String(predictResult.values[i] ?? 0)),
			lowerBound: new Prisma.Decimal(
				String(predictResult.lower_bound?.[i] ?? predictResult.values[i] ?? 0),
			),
			upperBound: new Prisma.Decimal(
				String(predictResult.upper_bound?.[i] ?? predictResult.values[i] ?? 0),
			),
			confidence: new Prisma.Decimal(confidenceLevel.toFixed(2)),
			anomalyProbability: null,
		}));

		// Batch insert forecasts
		await createForecasts(forecasts);

		// Emit WebSocket event
		const io = req.app.get("io");
		if (io) {
			try {
				io.to(`timeseries:${model.timeseriesId}`).emit("forecast:generated", {
					modelId,
					count: forecasts.length,
				});
			} catch (wsError) {
				logger.warn("WebSocket emit failed for forecast:generated event", {
					modelId,
					timeseriesId: model.timeseriesId,
					error: wsError instanceof Error ? wsError.message : "Unknown error",
				});
			}
		}
		return success(
			res,
			{
				forecasts,
				meta: {
					modelId,
					horizon: forecasts.length,
					generatedAt: new Date(),
				},
			},
			201,
		);
	}),
);

/**
 * @openapi
 * /api/models/{modelId}/forecasts:
 *   get:
 *     tags: [Models]
 *     summary: Get forecasts from a model
 *     description: Retrieves forecast data generated by a specific model with optional time range filtering.
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: start
 *         schema: { type: string, format: date-time }
 *         description: Start time filter
 *       - in: query
 *         name: end
 *         schema: { type: string, format: date-time }
 *         description: End time filter
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: List of forecasts
 *       404:
 *         description: Model not found
 */
// GET /api/models/:modelId/forecasts - Get forecasts from a model
router.get(
	"/:modelId/forecasts",
	authenticate,
	asyncHandler(async (req, res) => {
		const { start, end } = req.query;
		const params = limitSchema.parse(req.query);
		const forecasts = await listForecasts(
			req.params.modelId,
			{
				start: start as string | undefined,
				end: end as string | undefined,
			},
			params.limit,
		);
		return success(res, { forecasts });
	}),
);

/**
 * @openapi
 * /api/models/{id}:
 *   patch:
 *     tags: [Models]
 *     summary: Update a model
 *     description: Updates a model's active status. When activating a model, all other models for the same time series are deactivated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Model updated successfully
 *       400:
 *         description: No valid fields to update
 *       401:
 *         description: Not authenticated
 */
// PATCH /api/models/:id - Update model (requires authentication)
router.patch(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { isActive } = req.body;
		if (typeof isActive !== "boolean") {
			throw new BadRequestError("isActive must be a boolean");
		}
		const model = await setModelActive(req.params.id, isActive, req.userId, req.user.role);
		return success(res, { model });
	}),
);

/**
 * @openapi
 * /api/models/{id}:
 *   delete:
 *     tags: [Models]
 *     summary: Delete a model
 *     description: Permanently deletes a forecasting model.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Model deleted successfully
 *       401:
 *         description: Not authenticated
 */
// DELETE /api/models/:id - Delete model (requires authentication)
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		await deleteModel(req.params.id, req.userId, req.user?.role);
		return successWithMessage(res, {}, "Model deleted successfully");
	}),
);

/**
 * @openapi
 * /api/models/{modelId}/forecasts:
 *   delete:
 *     tags: [Models]
 *     summary: Clear forecasts
 *     description: Deletes forecasts for a model with optional time range filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: start
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Forecasts deleted successfully
 *       401:
 *         description: Not authenticated
 */
// DELETE /api/models/:modelId/forecasts - Clear forecasts (requires authentication)
router.delete(
	"/:modelId/forecasts",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { start, end } = req.query;
		const count = await deleteForecasts(req.params.modelId, {
			start: start as string | undefined,
			end: end as string | undefined,
		});
		return successWithMessage(res, { count }, `Deleted ${count} forecasts`);
	}),
);

export { router as modelsRouter };
