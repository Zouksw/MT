import { type Request, type Response, Router } from "express";
import { logger } from "@/lib";
import { authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError } from "@/middleware/errorHandler";
import { aiRateLimiter } from "@/middleware/rateLimiter";
import {
	aggregateSchema,
	batchPredictSchema,
	createTimeseriesSchema,
	detectAnomaliesSchema,
	insertOneRecordSchema,
	insertRecordsSchema,
	predictSchema,
	queryDataSchema,
	sqlQuerySchema,
	visualizePredictSchema,
} from "@/schemas/iotdb";
import {
	get as cacheGet,
	cacheKeys,
	set as cacheSet,
	mget,
} from "@/services/cache";
import { iotdbAIService, iotdbClient, iotdbRPCClient } from "@/services/iotdb";
import type { PredictionRequest } from "@/services/iotdb/ai";

const router = Router();

// === System Status ===

/**
 * @openapi
 * /api/iotdb/status:
 *   get:
 *     tags: [IoTDB]
 *     summary: Check IoTDB service health
 *     description: Returns the health status of the IoTDB service and its configuration.
 *     responses:
 *       200:
 *         description: IoTDB status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 config:
 *                   type: object
 *                   properties:
 *                     host: { type: string }
 *                     port: { type: string }
 *                     restUrl: { type: string }
 */
/**
 * GET /api/iotdb/status
 * Check IoTDB service health
 */
router.get(
	"/status",
	asyncHandler(async (_req: Request, res: Response) => {
		const isHealthy = await iotdbClient.healthCheck();
		res.json({
			status: isHealthy ? "healthy" : "unhealthy",
			timestamp: new Date().toISOString(),
			config: {
				host: process.env.IOTDB_HOST || "localhost",
				port: process.env.IOTDB_PORT || "6667",
				restUrl: process.env.IOTDB_REST_URL || "http://localhost:18080",
			},
		});
	}),
);

// === SQL Query Interface ===

/**
 * @openapi
 * /api/iotdb/sql:
 *   post:
 *     tags: [IoTDB]
 *     summary: Execute SQL query (POST)
 *     description: Primary interface for executing IoTDB SQL queries. Supports all IoTDB SQL operations.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sql]
 *             properties:
 *               sql:
 *                 type: string
 *                 description: IoTDB SQL query string
 *                 example: SELECT * FROM root.sg1.d1
 *     responses:
 *       200:
 *         description: Query result
 */
/**
 * POST /api/iotdb/sql
 * Execute SQL query - Primary interface for all IoTDB operations
 */
router.post(
	"/sql",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { sql } = sqlQuerySchema.parse(req.body);
		const result = await iotdbClient.query(sql);
		res.json(result);
	}),
);

/**
 * @openapi
 * /api/iotdb/sql:
 *   get:
 *     tags: [IoTDB]
 *     summary: Execute SQL query (GET)
 *     description: Execute a simple IoTDB SQL query via GET request.
 *     parameters:
 *       - in: query
 *         name: sql
 *         required: true
 *         schema: { type: string }
 *         description: IoTDB SQL query string
 *     responses:
 *       200:
 *         description: Query result
 *       400:
 *         description: SQL query required
 */
/**
 * GET /api/iotdb/sql
 * Execute SQL query via GET (for simple queries)
 */
router.get(
	"/sql",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { sql } = req.query;
		if (!sql || typeof sql !== "string") {
			throw new BadRequestError("SQL query required");
		}
		const { sql: validatedSql } = sqlQuerySchema.parse({ sql });
		const result = await iotdbClient.query(validatedSql);
		res.json(result);
	}),
);

// === Convenience Interface (SQL-based) ===

/**
 * @openapi
 * /api/iotdb/timeseries:
 *   post:
 *     tags: [IoTDB]
 *     summary: Create a new IoTDB time series
 *     description: Creates a new time series in IoTDB using the RPC client.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [path, dataType, encoding]
 *             properties:
 *               path:
 *                 type: string
 *                 example: root.sg1.d1.temperature
 *               dataType:
 *                 type: string
 *                 example: DOUBLE
 *               encoding:
 *                 type: string
 *                 example: GORILLA
 *               compressor:
 *                 type: string
 *     responses:
 *       200:
 *         description: Time series created successfully
 */
/**
 * POST /api/iotdb/timeseries
 * Create a new time series using SQL
 */
router.post(
	"/timeseries",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const validatedData = createTimeseriesSchema.parse(req.body);

		// Use RPC client for CREATE operations
		const result = await iotdbRPCClient.createTimeseries(validatedData);
		res.json({ success: true, result });
	}),
);

/**
 * @openapi
 * /api/iotdb/timeseries:
 *   get:
 *     tags: [IoTDB]
 *     summary: List IoTDB time series
 *     description: Lists all time series paths in IoTDB, optionally filtered by path prefix.
 *     parameters:
 *       - in: query
 *         name: path
 *         schema: { type: string }
 *         description: Path prefix filter
 *     responses:
 *       200:
 *         description: List of time series
 */
/**
 * GET /api/iotdb/timeseries
 * List time series
 */
router.get(
	"/timeseries",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { path } = req.query;
		const result = await iotdbClient.listTimeseries(path as string | undefined);
		res.json(result);
	}),
);

/**
 * @openapi
 * /api/iotdb/timeseries/{path}:
 *   delete:
 *     tags: [IoTDB]
 *     summary: Delete an IoTDB time series
 *     description: Deletes a time series from IoTDB by its full path.
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema: { type: string }
 *         description: Full time series path
 *     responses:
 *       200:
 *         description: Time series deleted successfully
 */
/**
 * DELETE /api/iotdb/timeseries/:path
 * Delete a time series
 */
router.delete(
	"/timeseries/:path(*)",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { path } = req.params;
		// Use RPC client for DROP operations
		const result = await iotdbRPCClient.deleteTimeseries(path);
		res.json({ success: true, result });
	}),
);

/**
 * @openapi
 * /api/iotdb/insert:
 *   post:
 *     tags: [IoTDB]
 *     summary: Insert records into time series
 *     description: Inserts multiple records into IoTDB time series.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [records]
 *             properties:
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [device, timestamp, measurements]
 *                   properties:
 *                     device:
 *                       type: string
 *                     timestamp:
 *                       type: integer
 *                     measurements:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           value: { type: object }
 *     responses:
 *       200:
 *         description: Records inserted successfully
 */
/**
 * POST /api/iotdb/insert
 * Insert records into time series
 */
router.post(
	"/insert",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { records } = insertRecordsSchema.parse(req.body);

		// Transform records to match RPC client format
		const transformedRecords = records.map((r) => ({
			device: r.device,
			timestamp: r.timestamp,
			measurements: r.measurements.map((m) => m.name),
			values: [r.measurements.map((m) => m.value)],
		}));

		// Use RPC client for INSERT operations
		const result = await iotdbRPCClient.insertRecords(
			transformedRecords as {
				device: string;
				measurements: string[];
				values: unknown[][];
				timestamp: number;
			}[],
		);
		res.json({ success: true, result });
	}),
);

/**
 * @openapi
 * /api/iotdb/insert/one:
 *   post:
 *     tags: [IoTDB]
 *     summary: Insert a single record
 *     description: Inserts a single record into an IoTDB time series.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [device, timestamp, measurements]
 *             properties:
 *               device:
 *                 type: string
 *                 example: root.sg1.d1
 *               timestamp:
 *                 type: integer
 *                 description: Unix timestamp in milliseconds
 *                 example: 1700000000000
 *               measurements:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string, example: temperature }
 *                     value: { example: 25.5 }
 *     responses:
 *       200:
 *         description: Record inserted successfully
 */
/**
 * POST /api/iotdb/insert/one
 * Insert a single record
 */
router.post(
	"/insert/one",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const validatedData = insertOneRecordSchema.parse(req.body);

		// Convert measurements array to Record format for RPC client
		// Schema: [{ name: 'temp', value: 25.5 }, ...] -> Record: { temp: 25.5, ... }
		const measurementsRecord: Record<string, unknown> = {};
		for (const m of validatedData.measurements) {
			measurementsRecord[m.name] = m.value;
		}

		// Use RPC client for INSERT operations
		const result = await iotdbRPCClient.insertOneRecord({
			device: validatedData.device,
			timestamp: validatedData.timestamp,
			measurements: measurementsRecord,
		});
		res.json({ success: true, result });
	}),
);

/**
 * @openapi
 * /api/iotdb/query/data:
 *   post:
 *     tags: [IoTDB]
 *     summary: Query time series data
 *     description: Queries time series data from IoTDB with filtering options.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [path]
 *             properties:
 *               path:
 *                 type: string
 *                 example: root.sg1.d1.temperature
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *               limit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Query results
 */
/**
 * POST /api/iotdb/query/data
 * Query time series data
 */
router.post(
	"/query/data",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const validatedData = queryDataSchema.parse(req.body);
		const result = await iotdbClient.queryData(validatedData);
		res.json(result);
	}),
);

/**
 * @openapi
 * /api/iotdb/aggregate:
 *   post:
 *     tags: [IoTDB]
 *     summary: Execute aggregate query
 *     description: Executes an aggregation query on IoTDB time series data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               path:
 *                 type: string
 *               aggregations:
 *                 type: array
 *                 items: { type: string }
 *               interval:
 *                 type: string
 *                 description: Group by time interval
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Aggregation results
 */
/**
 * POST /api/iotdb/aggregate
 * Execute aggregate query
 */
router.post(
	"/aggregate",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const validatedData = aggregateSchema.parse(req.body);
		const result = await iotdbClient.aggregate({
			...validatedData,
			interval: validatedData.interval?.toString(),
		} as Parameters<typeof iotdbClient.aggregate>[0]);
		res.json(result);
	}),
);

// === AI Features ===

/**
 * @openapi
 * /api/iotdb/ai/predict:
 *   post:
 *     tags: [IoTDB]
 *     summary: AI prediction
 *     description: Predicts future values for a time series using AI. Results are cached for 15 minutes. Rate limited.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseries, horizon]
 *             properties:
 *               timeseries:
 *                 type: string
 *                 description: IoTDB time series path
 *                 example: root.sg1.d1.temperature
 *               horizon:
 *                 type: integer
 *                 description: Number of future time steps
 *                 example: 10
 *               algorithm:
 *                 type: string
 *                 enum: [arima, lstm, prophet, timer_xl]
 *                 default: arima
 *               confidenceLevel:
 *                 type: number
 *                 default: 0.95
 *     responses:
 *       200:
 *         description: Prediction results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 predictions:
 *                   type: array
 *                   items: { type: object }
 *                 cached:
 *                   type: boolean
 *       400:
 *         description: Invalid parameters
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: AI prediction failed
 */
/**
 * POST /api/iotdb/ai/predict
 * Predict future values using AI
 */
router.post(
	"/ai/predict",
	authenticate,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { timeseries, horizon, algorithm, confidenceLevel } =
			predictSchema.parse(req.body);

		// Normalize algorithm (prophet -> timer_xl for IoTDB compatibility)
		const normalizedAlgorithm =
			algorithm === "prophet" ? "arima" : algorithm || "arima";

		// Try to get from cache first
		const cacheKey = cacheKeys.prediction(
			timeseries,
			normalizedAlgorithm,
			horizon,
		);

		const cachedResult = await cacheGet(cacheKey);
		if (cachedResult) {
			return res.json({
				...cachedResult,
				cached: true,
			});
		}

		try {
			// Generate prediction
			const result = await iotdbAIService.predict({
				timeseries,
				horizon,
				algorithm: normalizedAlgorithm as PredictionRequest["algorithm"],
				confidenceLevel,
			});

			// Cache the result for 15 minutes
			await cacheSet(cacheKey, result, 900);

			res.json({ ...result, cached: false });
		} catch (error) {
			logger.error(`AI prediction failed for ${timeseries}: ${error}`);
			throw error;
		}
	}),
);

/**
 * @openapi
 * /api/iotdb/ai/predict/batch:
 *   post:
 *     tags: [IoTDB]
 *     summary: Batch AI prediction
 *     description: Predicts future values for multiple time series in a single request. Results are cached. Rate limited.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requests]
 *             properties:
 *               requests:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [timeseries, horizon]
 *                   properties:
 *                     timeseries: { type: string }
 *                     horizon: { type: integer }
 *                     algorithm: { type: string }
 *                     confidenceLevel: { type: number }
 *     responses:
 *       200:
 *         description: Batch prediction results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items: { type: object }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     cached: { type: integer }
 *                     computed: { type: integer }
 *       429:
 *         description: Rate limit exceeded
 */
/**
 * POST /api/iotdb/ai/predict/batch
 * Batch predict for multiple time series
 */
router.post(
	"/ai/predict/batch",
	authenticate,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { requests } = batchPredictSchema.parse(req.body);

		// Normalize algorithms and build cache keys
		const normalizedRequests = requests.map(
			(r: {
				timeseries: string;
				horizon: number;
				algorithm?: string;
				confidenceLevel?: number;
			}) => ({
				...r,
				algorithm: (r.algorithm === "prophet"
					? "arima"
					: r.algorithm || "arima") as PredictionRequest["algorithm"],
			}),
		);

		// Try to get all results from cache
		const cacheKeysList = normalizedRequests.map(
			(r: { timeseries: string; algorithm?: string; horizon: number }) =>
				cacheKeys.prediction(r.timeseries, r.algorithm || "arima", r.horizon),
		);

		const cachedResults = await mget<Record<string, unknown>>(cacheKeysList);
		const batchResults: Record<string, unknown>[] = [];
		const uncachedIndices: number[] = [];

		// Separate cached and uncached requests
		requests.forEach((req: { timeseries: string }, index: number) => {
			if (cachedResults[index]) {
				batchResults[index] = {
					...cachedResults[index],
					cached: true,
					timeseries: req.timeseries,
				};
			} else {
				uncachedIndices.push(index);
			}
		});

		// Process uncached requests in parallel
		if (uncachedIndices.length > 0) {
			const uncachedRequests = uncachedIndices.map(
				(i) => normalizedRequests[i],
			);
			const freshResults = await iotdbAIService.batchPredict(
				uncachedRequests as PredictionRequest[],
			);

			// Store in cache and update results
			for (let i = 0; i < freshResults.length; i++) {
				const result = freshResults[i];
				const originalIndex = uncachedIndices[i];

				batchResults[originalIndex] = {
					...result,
					cached: false,
					timeseries: requests[originalIndex].timeseries,
				};

				// Cache the result
				await cacheSet(cacheKeysList[originalIndex], result, 900);
			}
		}

		res.json({
			results: batchResults,
			summary: {
				total: requests.length,
				cached: cachedResults.filter((r) => r).length,
				computed: uncachedIndices.length,
			},
		});
	}),
);

/**
 * @openapi
 * /api/iotdb/ai/predict/visualize:
 *   post:
 *     tags: [IoTDB]
 *     summary: Visualization data (historical + predictions)
 *     description: Returns historical data combined with AI predictions for chart visualization. Rate limited.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseries]
 *             properties:
 *               timeseries:
 *                 type: string
 *               horizon:
 *                 type: integer
 *                 default: 10
 *               algorithm:
 *                 type: string
 *                 default: arima
 *               confidenceLevel:
 *                 type: number
 *                 default: 0.95
 *               historyPoints:
 *                 type: integer
 *                 default: 50
 *                 description: Number of historical data points to include
 *     responses:
 *       200:
 *         description: Historical and prediction data for visualization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timeseries: { type: string }
 *                 historical:
 *                   type: array
 *                   items: { type: object }
 *                 prediction: { type: object }
 *                 algorithm: { type: string }
 *       429:
 *         description: Rate limit exceeded
 */
/**
 * POST /api/iotdb/ai/predict/visualize
 * Get historical data + predictions for chart visualization
 */
router.post(
	"/ai/predict/visualize",
	authenticate,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { timeseries, horizon, algorithm, confidenceLevel, historyPoints } =
			visualizePredictSchema.parse(req.body);

		// Normalize algorithm
		const normalizedAlgorithm =
			algorithm === "prophet" ? "arima" : algorithm || "arima";

		// Get historical data for context
		const historicalResult = await iotdbClient.queryData({
			path: timeseries,
			limit: historyPoints || 50,
		});

		// Get predictions
		const predictionResult = await iotdbAIService.predict({
			timeseries,
			horizon: horizon || 10,
			algorithm: normalizedAlgorithm as PredictionRequest["algorithm"],
			confidenceLevel: confidenceLevel || 0.95,
		});

		res.json({
			timeseries,
			historical: historicalResult.data || [],
			prediction: predictionResult,
			algorithm: normalizedAlgorithm,
		});
	}),
);

/**
 * @openapi
 * /api/iotdb/ai/anomalies:
 *   post:
 *     tags: [IoTDB]
 *     summary: AI anomaly detection
 *     description: Detects anomalies in time series data using AI-based methods.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseries]
 *             properties:
 *               timeseries:
 *                 type: string
 *                 description: IoTDB time series path
 *               method:
 *                 type: string
 *                 enum: [ml, statistical]
 *                 default: ml
 *               threshold:
 *                 type: number
 *               windowSize:
 *                 type: integer
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Anomaly detection results
 *       500:
 *         description: AI anomaly detection failed
 */
/**
 * POST /api/iotdb/ai/anomalies
 * Detect anomalies using AI
 */
router.post(
	"/ai/anomalies",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const validatedData = detectAnomaliesSchema.parse(req.body);

		try {
			const result = await iotdbAIService.detectAnomalies({
				timeseries: validatedData.timeseries,
				method: validatedData.method || "ml",
				threshold: validatedData.threshold,
				windowSize: validatedData.windowSize,
				startTime: validatedData.startTime,
				endTime: validatedData.endTime,
			});

			res.json(result);
		} catch (error) {
			logger.error(
				`AI anomaly detection failed for ${validatedData.timeseries}: ${error}`,
			);
			throw error;
		}
	}),
);

/**
 * @openapi
 * /api/iotdb/ai/anomalies/visualize:
 *   post:
 *     tags: [IoTDB]
 *     summary: Visualization data (historical + anomalies)
 *     description: Returns historical data combined with anomaly detection results for chart visualization. Rate limited.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseries]
 *             properties:
 *               timeseries:
 *                 type: string
 *               method:
 *                 type: string
 *                 default: statistical
 *               threshold:
 *                 type: number
 *                 default: 2.5
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *               historyPoints:
 *                 type: integer
 *                 default: 100
 *     responses:
 *       200:
 *         description: Historical and anomaly data for visualization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timeseries: { type: string }
 *                 historical:
 *                   type: array
 *                   items: { type: object }
 *                 anomalies:
 *                   type: array
 *                   items: { type: object }
 *                 statistics: { type: object }
 *                 method: { type: string }
 *       429:
 *         description: Rate limit exceeded
 */
/**
 * POST /api/iotdb/ai/anomalies/visualize
 * Get historical data + anomalies for chart visualization
 */
router.post(
	"/ai/anomalies/visualize",
	authenticate,
	aiRateLimiter,
	asyncHandler(async (req: Request, res: Response) => {
		const { timeseries, method, threshold, startTime, endTime, historyPoints } =
			req.body;

		// Get historical data for context
		const limit = historyPoints || 100;
		const historicalResult = await iotdbClient.queryData({
			path: timeseries,
			limit,
			startTime,
			endTime,
		});

		// Detect anomalies
		const anomalyResult = await iotdbAIService.detectAnomalies({
			timeseries,
			method: method || "statistical",
			threshold: threshold || 2.5,
			startTime,
			endTime,
		});

		res.json({
			timeseries,
			historical: historicalResult.data || [],
			anomalies: anomalyResult.anomalies || [],
			statistics: anomalyResult.statistics || { total: 0, bySeverity: {} },
			method: method || "statistical",
		});
	}),
);

/**
 * @openapi
 * /api/iotdb/ai/models:
 *   get:
 *     tags: [IoTDB]
 *     summary: List available AI models
 *     description: Lists all available AI models in the IoTDB AI service.
 *     responses:
 *       200:
 *         description: List of AI models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items: { type: object }
 */
/**
 * GET /api/iotdb/ai/models
 * List available AI models
 */
router.get(
	"/ai/models",
	authenticate,
	asyncHandler(async (_req: Request, res: Response) => {
		const models = await iotdbAIService.listModels();
		res.json({ models });
	}),
);

/**
 * @openapi
 * /api/iotdb/ai/models/{id}:
 *   get:
 *     tags: [IoTDB]
 *     summary: Get AI model information
 *     description: Retrieves detailed information about a specific AI model.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Model ID
 *     responses:
 *       200:
 *         description: Model information
 */
/**
 * GET /api/iotdb/ai/models/:id
 * Get model information
 */
router.get(
	"/ai/models/:id",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { id } = req.params;
		const model = await iotdbAIService.getModelInfo(id);
		res.json(model);
	}),
);

/**
 * @openapi
 * /api/iotdb/ai/models/train:
 *   post:
 *     tags: [IoTDB]
 *     summary: Train a new AI model
 *     description: Trains a new AI model on IoTDB time series data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseries, algorithm]
 *             properties:
 *               timeseries:
 *                 type: string
 *                 description: IoTDB time series path
 *               algorithm:
 *                 type: string
 *                 description: Training algorithm
 *               parameters:
 *                 type: object
 *                 description: Training parameters
 *     responses:
 *       200:
 *         description: Model training result
 *       400:
 *         description: Missing required parameters
 */
/**
 * POST /api/iotdb/ai/models/train
 * Train a new AI model
 */
router.post(
	"/ai/models/train",
	authenticate,
	asyncHandler(async (req: Request, res: Response) => {
		const { timeseries, algorithm, parameters } = req.body;

		if (!timeseries || !algorithm) {
			throw new BadRequestError(
				"Missing required parameters: timeseries, algorithm",
			);
		}

		const result = await iotdbAIService.trainModel({
			timeseries,
			algorithm,
			parameters,
		});

		res.json(result);
	}),
);

export { router as iotdbRouter };
