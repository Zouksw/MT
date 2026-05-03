import type { Timeseries } from "@prisma/client";
import { type Request, type Response, Router } from "express";
import { logger, prisma } from "@/lib";
import { paginated, success } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, NotFoundError } from "@/middleware/errorHandler";
import { getPagination, limitSchema, paginationSchema } from "@/schemas/common";
import type { IoTDBQueryRow, QueryConditions } from "@/types";
import { getIoTDBClient } from "../../config/iotdb";

const router = Router();

/**
 * Timeseries with IoTDB extended data
 */
interface TimeseriesWithIoTDB extends Timeseries {
	datapointCount: number;
	iotdbDataPoints?: number;
	latestData?: IoTDBQueryRow;
	iotdbAvailable?: boolean;
	dataset?: {
		id: string;
		name: string;
		slug: string;
	};
	_count?: {
		dataPoints: number;
		anomalies: number;
	};
}

/**
 * @openapi
 * /api/timeseries:
 *   get:
 *     tags: [Time Series]
 *     summary: List all time series
 *     description: Retrieves a paginated list of time series with optional filtering by dataset and search text.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: datasetId
 *         schema: { type: string }
 *         description: Filter by dataset ID
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or description
 *     responses:
 *       200:
 *         description: Paginated list of time series
 *       401:
 *         description: Not authenticated
 */
// GET /api/timeseries - Get all timeseries with filters
router.get(
	"/",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		const { datasetId, search } = req.query;
		const { skip, take } = getPagination(req.query);
		const params = paginationSchema.parse(req.query);

		const where: QueryConditions["where"] = {};
		if (datasetId) {
			where.datasetId = datasetId as string;
		}
		if (search) {
			where.OR = [
				{ name: { contains: search as string, mode: "insensitive" } },
				{ description: { contains: search as string, mode: "insensitive" } },
			];
		}

		const [timeseries, total] = await Promise.all([
			prisma.timeseries.findMany({
				where,
				skip,
				take,
				include: {
					dataset: { select: { id: true, name: true, slug: true } },
					_count: { select: { dataPoints: true, anomalies: true } },
				},
				orderBy: { createdAt: "desc" },
			}),
			prisma.timeseries.count({ where }),
		]);

		return paginated(res, timeseries, {
			page: params.page,
			limit: params.limit,
			total,
			totalPages: Math.ceil(total / params.limit),
		});
	}),
);

/**
 * @openapi
 * /api/timeseries/{id}:
 *   get:
 *     tags: [Time Series]
 *     summary: Get a single time series
 *     description: Retrieves a time series by ID with datapoint count and latest IoTDB data if available.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Time series ID
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *         description: Limit for IoTDB data points
 *     responses:
 *       200:
 *         description: Time series details with IoTDB data
 *       404:
 *         description: Time series not found
 */
// GET /api/timeseries/:id - Get single timeseries
router.get(
	"/:id",
	asyncHandler(async (req: Request, res: Response) => {
		const { id } = req.params;
		const params = limitSchema.parse(req.query);

		const timeseries = await prisma.timeseries.findUnique({
			where: { id },
			include: {
				dataset: { select: { id: true, name: true, slug: true } },
				_count: { select: { dataPoints: true, anomalies: true } },
			},
		});

		if (!timeseries) {
			throw new NotFoundError("Timeseries");
		}

		// Use _count from the query result instead of separate count query (fixes N+1 issue)
		const result: TimeseriesWithIoTDB = {
			...timeseries,
			datapointCount: timeseries._count.dataPoints,
		};

		// Try to get latest data from IoTDB
		try {
			const iotdbClient = await getIoTDBClient();
			const iotdbData = await iotdbClient.queryTimeseriesData(
				`root.${timeseries.datasetId}.${timeseries.name}`,
				params.limit,
			);

			if (iotdbData && iotdbData.length > 0) {
				result.iotdbDataPoints = iotdbData.length;
				result.latestData = iotdbData[0];
			}
		} catch (err) {
			// IoTDB connection failure - log with appropriate level
			const errorMessage = err instanceof Error ? err.message : String(err);
			if (
				errorMessage.includes("ECONNREFUSED") ||
				errorMessage.includes("connect")
			) {
				logger.warn("[IoTDB] Connection failed - check if IoTDB is running", {
					timeseriesId: id,
					error: errorMessage,
				});
			} else if (
				errorMessage.includes("not found") ||
				errorMessage.includes("does not exist")
			) {
				logger.info("[IoTDB] Timeseries not found (may not exist yet)", {
					timeseriesId: id,
					path: `root.${timeseries.datasetId}.${timeseries.name}`,
				});
			} else {
				logger.warn("[IoTDB] Query failed", {
					timeseriesId: id,
					error: errorMessage,
				});
			}
			// Set iotdbAvailable flag so frontend knows
			result.iotdbAvailable = false;
		}

		return success(res, result);
	}),
);

/**
 * @openapi
 * /api/timeseries/{id}/data:
 *   get:
 *     tags: [Time Series]
 *     summary: Get time series data points
 *     description: Retrieves data points for a time series from both PostgreSQL and IoTDB. Includes IoTDB availability status.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Time series ID
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: startTime
 *         schema: { type: string, format: date-time }
 *         description: Start time filter for IoTDB data
 *       - in: query
 *         name: endTime
 *         schema: { type: string, format: date-time }
 *         description: End time filter for IoTDB data
 *     responses:
 *       200:
 *         description: Time series data with IoTDB data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { type: object }
 *                     iotdbData:
 *                       type: array
 *                       items: { type: object }
 *                     iotdbError:
 *                       type: string
 *                       nullable: true
 *                     iotdbAvailable:
 *                       type: boolean
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       404:
 *         description: Time series not found
 */
// GET /api/timeseries/:id/data - Get timeseries data
router.get(
	"/:id/data",
	asyncHandler(async (req: Request, res: Response) => {
		const { id } = req.params;
		const { startTime, endTime } = req.query;
		const params = limitSchema.parse(req.query);

		const timeseries = await prisma.timeseries.findUnique({
			where: { id },
		});

		if (!timeseries) {
			throw new NotFoundError("Timeseries");
		}

		// Get datapoints from PostgreSQL
		const datapoints = await prisma.datapoint.findMany({
			where: { timeseriesId: id },
			take: params.limit,
			orderBy: { timestamp: "desc" },
		});

		// Try to get data from IoTDB
		let iotdbData: IoTDBQueryRow[] = [];
		let iotdbError: string | null = null;
		try {
			const iotdbClient = await getIoTDBClient();
			iotdbData = await iotdbClient.queryTimeseriesData(
				`root.${timeseries.datasetId}.${timeseries.name}`,
				params.limit,
				startTime as string,
				endTime as string,
			);
		} catch (err) {
			// Log IoTDB errors with context
			const errorMessage = err instanceof Error ? err.message : String(err);
			iotdbError = errorMessage;

			if (
				errorMessage.includes("ECONNREFUSED") ||
				errorMessage.includes("connect")
			) {
				logger.warn("[IoTDB] Connection failed - check if IoTDB is running", {
					timeseriesId: id,
					error: errorMessage,
				});
			} else if (
				errorMessage.includes("not found") ||
				errorMessage.includes("does not exist")
			) {
				logger.info("[IoTDB] Timeseries not found", {
					timeseriesId: id,
					path: `root.${timeseries.datasetId}.${timeseries.name}`,
				});
			} else {
				logger.warn("[IoTDB] Query failed", {
					timeseriesId: id,
					error: errorMessage,
				});
			}
		}

		return success(res, {
			data: datapoints,
			iotdbData: iotdbData || [],
			iotdbError, // Include error info so frontend can display it
			iotdbAvailable: !iotdbError,
			pagination: {
				page: 1,
				limit: params.limit,
				total: datapoints.length + (iotdbData?.length || 0),
				totalPages: 1,
			},
		});
	}),
);

/**
 * @openapi
 * /api/timeseries/{id}/data:
 *   post:
 *     tags: [Time Series]
 *     summary: Insert a data point
 *     description: Inserts a new data point into a time series. Also writes to IoTDB if available.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Time series ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp (defaults to current time)
 *               value:
 *                 description: The data point value
 *                 example: 25.5
 *     responses:
 *       201:
 *         description: Data point inserted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Time series not found
 */
// POST /api/timeseries/:id/data - Insert data point (requires authentication)
router.post(
	"/:id/data",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		const { id } = req.params;
		const { timestamp, value } = req.body;

		const timeseries = await prisma.timeseries.findUnique({
			where: { id },
		});

		if (!timeseries) {
			throw new NotFoundError("Timeseries");
		}

		const datapoint = await prisma.datapoint.create({
			data: {
				timeseriesId: id,
				timestamp: timestamp ? new Date(timestamp) : new Date(),
				valueJson: JSON.stringify(value !== undefined ? value : 0),
			},
		});

		// Try to write to IoTDB
		try {
			const iotdbClient = await getIoTDBClient();
			const ts = timestamp ? new Date(timestamp).getTime() : Date.now();
			await iotdbClient.insertRecords(
				[`root.${timeseries.datasetId}.${timeseries.name}`],
				[ts],
				[["value"]],
				[["DOUBLE"]],
				[[value !== undefined ? value : 0]],
				false,
			);
		} catch (err) {
			// IoTDB connection is optional
			logger.debug("IoTDB insert failed (expected if not configured):", err);
		}

		return success(res, datapoint, 201);
	}),
);

/**
 * @openapi
 * /api/timeseries/{id}:
 *   delete:
 *     tags: [Time Series]
 *     summary: Delete a time series
 *     description: Deletes a time series and all its data points from both PostgreSQL and IoTDB.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Time series ID
 *     responses:
 *       200:
 *         description: Time series deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Time series not found
 */
// DELETE /api/timeseries/:id - Delete timeseries (requires authentication)
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		const { id } = req.params;

		const timeseries = await prisma.timeseries.findUnique({
			where: { id },
		});

		if (!timeseries) {
			throw new NotFoundError("Timeseries");
		}

		// Try to delete from IoTDB
		try {
			const iotdbClient = await getIoTDBClient();
			await iotdbClient.deleteTimeseriesData(
				`root.${timeseries.datasetId}.${timeseries.name}`,
			);
		} catch (err) {
			// IoTDB connection is optional
			logger.debug("IoTDB delete failed (expected if not configured):", err);
		}

		// Delete from PostgreSQL
		await prisma.datapoint.deleteMany({
			where: { timeseriesId: id },
		});

		await prisma.timeseries.delete({
			where: { id },
		});

		return success(res, {
			success: true,
			message: "Timeseries deleted successfully",
		});
	}),
);

export { router as timeseriesRouter };
