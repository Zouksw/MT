import { type ModelAlgorithm, Prisma } from "@prisma/client";
import { Router } from "express";
import { logger, prisma } from "@/lib";
import { paginated, success, successWithMessage } from "@/lib/response";
import { checkAIAccess } from "@/middleware/aiAccess";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import {
	asyncHandler,
	BadRequestError,
	NotFoundError,
} from "@/middleware/errorHandler";
import { getPagination, limitSchema } from "@/schemas/common";
import {
	modelsQuerySchema,
	predictSchema,
	trainModelSchema,
} from "@/schemas/models";
import { getIoTDBClient } from "../../config/iotdb";

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
	asyncHandler(async (req, res) => {
		const { timeseriesId, algorithm } = req.query;
		const { skip, take } = getPagination(req.query);
		const params = modelsQuerySchema.parse(req.query);

		const where: Prisma.ForecastingModelWhereInput = {};
		if (timeseriesId) where.timeseriesId = timeseriesId as string;
		if (params.isActive !== undefined) where.isActive = params.isActive;
		if (algorithm) {
			// Use 'in' filter for enum values (requires array)
			where.algorithm = { in: [algorithm as ModelAlgorithm] };
		}

		const [models, total] = await Promise.all([
			prisma.forecastingModel.findMany({
				where,
				skip,
				take,
				include: {
					timeseries: {
						select: { id: true, name: true, slug: true, unit: true },
					},
					trainedBy: {
						select: { id: true, name: true, email: true },
					},
					_count: { select: { forecasts: true } },
				},
				orderBy: { trainedAt: "desc" },
			}),
			prisma.forecastingModel.count({ where }),
		]);
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
	asyncHandler(async (req, res) => {
		const model = await prisma.forecastingModel.findUnique({
			where: { id: req.params.id },
			include: {
				timeseries: {
					select: {
						id: true,
						name: true,
						slug: true,
						unit: true,
						dataset: {
							select: { id: true, name: true, slug: true },
						},
					},
				},
				trainedBy: {
					select: { id: true, name: true, email: true },
				},
				forecasts: {
					take: 10,
					orderBy: { timestamp: "desc" },
				},
				_count: { select: { forecasts: true } },
			},
		});

		if (!model) {
			throw new NotFoundError("Model");
		}
		return success(res, { model });
	}),
);

/**
 * @openapi
 * /api/models/train:
 *   post:
 *     tags: [Models]
 *     summary: Train a new forecasting model
 *     description: Trains a new forecasting model using IoTDB AINode. Deactivates existing active models for the same time series.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseriesId, algorithm]
 *             properties:
 *               timeseriesId:
 *                 type: string
 *                 description: Time series ID to train on
 *               algorithm:
 *                 type: string
 *                 enum: [ARIMA, LSTM, PROPHET, EXPONENTIAL_SMOOTHING, LINEAR_REGRESSION]
 *                 example: ARIMA
 *               hyperparameters:
 *                 type: object
 *                 description: Algorithm-specific hyperparameters
 *               trainingStart:
 *                 type: string
 *                 format: date-time
 *               trainingEnd:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Model trained successfully
 *       400:
 *         description: AINode training failed
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Time series not found
 */
// POST /api/models/train - Train a new forecasting model using IoTDB AINode
router.post(
	"/train",
	authenticate,
	checkAIAccess,
	asyncHandler(async (req: AuthRequest, res) => {
		const userId = req.userId!;
		const validatedData = trainModelSchema.parse(req.body);

		// Check if timeseries exists
		const timeseries = await prisma.timeseries.findUnique({
			where: { id: validatedData.timeseriesId },
			include: {
				dataset: true,
			},
		});

		if (!timeseries) {
			throw new NotFoundError("Timeseries");
		}

		// Deactivate existing models for this timeseries
		await prisma.forecastingModel.updateMany({
			where: {
				timeseriesId: validatedData.timeseriesId,
				isActive: true,
			},
			data: { isActive: false },
		});

		// Build IoTDB path for the timeseries
		const iotdbPath = `root.${timeseries.datasetId}.${timeseries.slug}`;

		// Call IoTDB AINode to train the model
		const iotdbClient = await getIoTDBClient();
		const startTime = Date.now();

		const trainResult = await iotdbClient.trainModel(
			iotdbPath,
			validatedData.algorithm as "ARIMA" | "PROPHET" | "LSTM" | "TRANSFORMER",
			(validatedData.hyperparameters || {}) as import("../../src/types/iotdb").IoTDBTrainingHyperparameters,
		);

		const trainingDuration = Date.now() - startTime;

		if (!trainResult.success) {
			throw new BadRequestError(
				`AINode training failed: ${trainResult.message}`,
			);
		}

		// Get training data count for metrics
		const dataPointsCount = await prisma.datapoint.count({
			where: {
				timeseriesId: validatedData.timeseriesId,
				...(validatedData.trainingStart && {
					timestamp: { gte: new Date(validatedData.trainingStart) },
				}),
				...(validatedData.trainingEnd && {
					timestamp: { lte: new Date(validatedData.trainingEnd) },
				}),
			},
		});

		// Create model record in database
		const model = await prisma.forecastingModel.create({
			data: {
				timeseriesId: validatedData.timeseriesId,
				trainedById: userId,
				algorithm: validatedData.algorithm,
				hyperparameters: {
					...validatedData.hyperparameters,
					iotdbPath,
					iotdbModelId: trainResult.modelId,
				},
				trainingMetrics: {
					trainingSamples: dataPointsCount,
					trainingDuration,
					ainodeResponse: trainResult.message,
				},
				version: 1,
				isActive: true,
				trainedAt: new Date(),
				deployedAt: new Date(),
			},
			include: {
				timeseries: {
					select: { id: true, name: true, slug: true, unit: true },
				},
				trainedBy: {
					select: { id: true, name: true, email: true },
				},
			},
		});

		// Emit WebSocket event
		const io = req.app.get("io");
		if (io) {
			try {
				io.to(`timeseries:${validatedData.timeseriesId}`).emit(
					"model:trained",
					model,
				);
			} catch (wsError) {
				logger.warn("WebSocket emit failed for model:trained event", {
					timeseriesId: validatedData.timeseriesId,
					error: wsError instanceof Error ? wsError.message : "Unknown error",
				});
			}
		}
		return success(res, { model }, 201);
	}),
);

/**
 * @openapi
 * /api/models/{modelId}/predict:
 *   post:
 *     tags: [Models]
 *     summary: Generate forecast using a model
 *     description: Generates a forecast using the specified trained model via IoTDB AINode. The model must be active.
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
 *         description: Model not active or AINode prediction failed
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Model not found
 */
// POST /api/models/:modelId/predict - Generate forecast using IoTDB AINode (requires authentication)
router.post(
	"/:modelId/predict",
	authenticate,
	checkAIAccess,
	asyncHandler(async (req: AuthRequest, res) => {
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

		// Get IoTDB model ID from hyperparameters
		const params = model.hyperparameters as {
			iotdbPath?: string;
			iotdbModelId?: string;
		};

		if (!params?.iotdbPath || !params?.iotdbModelId) {
			throw new BadRequestError(
				"Model not trained with AINode. Please retrain the model.",
			);
		}

		// Call IoTDB AINode for prediction
		const iotdbClient = await getIoTDBClient();
		const predictResult = await iotdbClient.predict(
			params.iotdbPath,
			params.iotdbModelId,
			validatedData.horizon,
			validatedData.confidenceLevel,
		);

		if (!predictResult.success || !predictResult.forecasts) {
			throw new BadRequestError(
				`AINode prediction failed: ${predictResult.message}`,
			);
		}

		// Convert AINode forecasts to database format
		// IoTDBForecast has timestamp: Date, need to convert to number for storage then back to Date for Prisma
		const forecasts = predictResult.forecasts.map((f) => {
			const timestamp =
				f.timestamp instanceof Date
					? f.timestamp.getTime()
					: (f.timestamp as number);
			return {
				modelId,
				timeseriesId: model.timeseriesId,
				timestamp: new Date(timestamp), // Prisma expects Date or string
				predictedValue: new Prisma.Decimal(String(f.predictedValue ?? 0)),
				lowerBound: new Prisma.Decimal(
					String(f.lowerBound ?? f.predictedValue ?? 0),
				),
				upperBound: new Prisma.Decimal(
					String(f.upperBound ?? f.predictedValue ?? 0),
				),
				confidence: new Prisma.Decimal(
					validatedData.confidenceLevel.toFixed(2),
				),
				anomalyProbability: new Prisma.Decimal("0"),
				isAnomaly: false,
			};
		});

		// Batch insert forecasts
		await prisma.forecast.createMany({
			data: forecasts,
			skipDuplicates: true,
		});

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
	asyncHandler(async (req, res) => {
		const { modelId } = req.params;
		const { start, end } = req.query;
		const params = limitSchema.parse(req.query);

		const where: Prisma.ForecastWhereInput = { modelId };

		if (start || end) {
			where.timestamp = {};
			if (start) where.timestamp.gte = new Date(start as string);
			if (end) where.timestamp.lte = new Date(end as string);
		}

		const forecasts = await prisma.forecast.findMany({
			where,
			take: params.limit,
			orderBy: { timestamp: "asc" },
		});

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
	asyncHandler(async (req: AuthRequest, res) => {
		const { isActive } = req.body;

		if (typeof isActive !== "undefined") {
			// If activating, deactivate other models for the same timeseries
			if (isActive) {
				const model = await prisma.forecastingModel.findUnique({
					where: { id: req.params.id },
				});

				if (model) {
					await prisma.forecastingModel.updateMany({
						where: {
							timeseriesId: model.timeseriesId,
							id: { not: req.params.id },
						},
						data: { isActive: false },
					});
				}
			}

			const model = await prisma.forecastingModel.update({
				where: { id: req.params.id },
				data: { isActive },
			});
			return success(res, { model });
		}

		throw new BadRequestError("No valid fields to update");
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
	asyncHandler(async (req: AuthRequest, res) => {
		await prisma.forecastingModel.delete({
			where: { id: req.params.id },
		});
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
	asyncHandler(async (req: AuthRequest, res) => {
		const { start, end } = req.query;

		const where: Prisma.ForecastWhereInput = { modelId: req.params.modelId };

		if (start || end) {
			where.timestamp = {};
			if (start) where.timestamp.gte = new Date(start as string);
			if (end) where.timestamp.lte = new Date(end as string);
		}

		const result = await prisma.forecast.deleteMany({ where });

		return successWithMessage(
			res,
			{ count: result.count },
			`Deleted ${result.count} forecasts`,
		);
	}),
);

export { router as modelsRouter };
