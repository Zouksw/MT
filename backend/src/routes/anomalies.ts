import type { AnomalySeverity } from "@prisma/client";
import { Router } from "express";
import { logger } from "@/lib";
import { paginated, success, successWithMessage } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/errorHandler";
import {
	anomaliesQuerySchema,
	bulkResolveSchema,
	detectAnomaliesSchema,
	updateAnomalySchema,
} from "@/schemas/anomalies";
import { getPagination } from "@/schemas/common";
import {
	bulkResolveAnomalies,
	deleteAnomaly,
	detectAnomalies,
	getAnomaly,
	getAnomalyStats,
	listAnomalies,
	updateAnomaly,
} from "@/services/anomalyService";

const router = Router();

// Get the authenticated user ID. Throws if absent — previously this fell back
// to a phantom UUID (00000000-...-001), silently attributing anomaly work to
// a non-existent user. Every route that calls getUser is behind `authenticate`
// (which rejects unauthenticated requests with 401), so req.userId is always
// set by the time we get here. This guard is defense-in-depth: if a future
// route forgets the authenticate middleware, it fails loudly here instead of
// corrupting the DB with phantom-user rows.
const getUser = (req: AuthRequest): string => {
	if (!req.userId) {
		throw new Error(
			"getUser called without an authenticated userId — missing authenticate middleware",
		);
	}
	return req.userId;
};

/**
 * @openapi
 * /api/anomalies:
 *   get:
 *     tags: [Anomalies]
 *     summary: List all anomalies
 *     description: Retrieves a paginated list of anomalies with optional filters for time series, severity, and resolution status.
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
 *         name: timeseriesId
 *         schema: { type: string }
 *         description: Filter by time series ID
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *         description: Filter by severity
 *       - in: query
 *         name: isResolved
 *         schema: { type: boolean }
 *         description: Filter by resolution status
 *     responses:
 *       200:
 *         description: Paginated list of anomalies
 *       401:
 *         description: Not authenticated
 */
// GET /api/anomalies - Get all anomalies
router.get(
	"/",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const { timeseriesId, severity } = req.query;
		const { skip, take } = getPagination(req.query);
		const params = anomaliesQuerySchema.parse(req.query);

		const { anomalies, total } = await listAnomalies({
			timeseriesId: timeseriesId as string | undefined,
			severity: severity as AnomalySeverity | undefined,
			isResolved: params.isResolved,
			skip,
			take,
		});

		return paginated(res, anomalies, {
			page: params.page,
			limit: params.limit,
			total,
			totalPages: Math.ceil(total / params.limit),
		});
	}),
);

/**
 * @openapi
 * /api/anomalies/{id}:
 *   get:
 *     tags: [Anomalies]
 *     summary: Get a single anomaly
 *     description: Retrieves an anomaly by ID including associated time series and dataset information.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Anomaly details
 *       404:
 *         description: Anomaly not found
 */
// GET /api/anomalies/:id - Get single anomaly
router.get(
	"/:id",
	authenticate,
	asyncHandler(async (req, res) => {
		const anomaly = await getAnomaly(req.params.id);
		return success(res, { anomaly });
	}),
);

/**
 * @openapi
 * /api/anomalies/detect:
 *   post:
 *     tags: [Anomalies]
 *     summary: Run anomaly detection
 *     description: Detects anomalies in a time series using statistical (z-score) or rule-based methods. Creates alerts for HIGH/CRITICAL severity anomalies.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseriesId, method, windowSize]
 *             properties:
 *               timeseriesId:
 *                 type: string
 *                 description: Time series ID to analyze
 *               method:
 *                 type: string
 *                 enum: [STATISTICAL, RULE_BASED]
 *                 description: Detection method
 *                 example: STATISTICAL
 *               windowSize:
 *                 type: integer
 *                 description: Window size for analysis
 *                 example: 10
 *               threshold:
 *                 type: number
 *                 description: Threshold for rule-based detection (0-1)
 *                 example: 0.5
 *               start:
 *                 type: string
 *                 format: date-time
 *                 description: Start time for data range
 *               end:
 *                 type: string
 *                 format: date-time
 *                 description: End time for data range
 *     responses:
 *       201:
 *         description: Anomalies detected successfully
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
 *                     anomalies:
 *                       type: array
 *                       items: { type: object }
 *                     meta:
 *                       type: object
 *                       properties:
 *                         timeseriesId: { type: string }
 *                         method: { type: string }
 *                         dataPointsAnalyzed: { type: integer }
 *                         anomaliesDetected: { type: integer }
 *                         anomaliesCreated: { type: integer }
 *       400:
 *         description: Not enough data points or unsupported method
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Time series not found
 */
// POST /api/anomalies/detect - Run anomaly detection (requires authentication)
router.post(
	"/detect",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const validatedData = detectAnomaliesSchema.parse(req.body);
		const userId = getUser(req);

		const { anomalies, meta } = await detectAnomalies(validatedData, userId);

		// Emit WebSocket event (HTTP/socket boundary — stays in the route)
		const io = req.app.get("io");
		if (io) {
			try {
				io.to(`timeseries:${validatedData.timeseriesId}`).emit("anomalies:detected", {
					timeseriesId: validatedData.timeseriesId,
					count: anomalies.length,
					method: validatedData.method,
				});
			} catch (wsError) {
				logger.warn("WebSocket emit failed for anomalies:detected event", {
					timeseriesId: validatedData.timeseriesId,
					error: wsError instanceof Error ? wsError.message : "Unknown error",
				});
			}
		}

		return success(res, { anomalies, meta }, 201);
	}),
);

/**
 * @openapi
 * /api/anomalies/{id}:
 *   patch:
 *     tags: [Anomalies]
 *     summary: Update an anomaly
 *     description: Updates an anomaly, typically to resolve it.
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
 *               isResolved:
 *                 type: boolean
 *                 description: Mark the anomaly as resolved
 *               notes:
 *                 type: string
 *                 description: Resolution notes
 *     responses:
 *       200:
 *         description: Anomaly updated successfully
 *       401:
 *         description: Not authenticated
 */
// PATCH /api/anomalies/:id - Update anomaly (requires authentication)
router.patch(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const validatedData = updateAnomalySchema.parse(req.body);
		const anomaly = await updateAnomaly(
			req.params.id,
			validatedData,
			req.userId as string,
			req.user?.role,
		);
		return success(res, { anomaly });
	}),
);

/**
 * @openapi
 * /api/anomalies/{id}:
 *   delete:
 *     tags: [Anomalies]
 *     summary: Delete an anomaly
 *     description: Permanently deletes an anomaly.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Anomaly deleted successfully
 *       401:
 *         description: Not authenticated
 */
// DELETE /api/anomalies/:id - Delete anomaly (requires authentication)
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		await deleteAnomaly(req.params.id, req.userId as string, req.user?.role);
		return successWithMessage(res, {}, "Anomaly deleted successfully");
	}),
);

/**
 * @openapi
 * /api/anomalies/stats/timeseries/{timeseriesId}:
 *   get:
 *     tags: [Anomalies]
 *     summary: Get anomaly statistics for a time series
 *     description: Returns anomaly counts, severity breakdown, and resolution rate for a specific time series.
 *     parameters:
 *       - in: path
 *         name: timeseriesId
 *         required: true
 *         schema: { type: string }
 *         description: Time series ID
 *       - in: query
 *         name: start
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Anomaly statistics
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         resolved: { type: integer }
 *                         unresolved: { type: integer }
 *                         resolutionRate: { type: string }
 *                         severityBreakdown: { type: object }
 */
// GET /api/anomalies/stats - Get anomaly statistics
router.get(
	"/stats/timeseries/:timeseriesId",
	authenticate,
	asyncHandler(async (req, res) => {
		const { timeseriesId } = req.params;
		const { start, end } = req.query;
		const stats = await getAnomalyStats(timeseriesId, {
			start: start as string | undefined,
			end: end as string | undefined,
		});
		return success(res, { stats });
	}),
);

/**
 * @openapi
 * /api/anomalies/bulk-resolve:
 *   post:
 *     tags: [Anomalies]
 *     summary: Bulk resolve anomalies
 *     description: Resolves multiple unresolved anomalies at once with optional filters.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeseriesId:
 *                 type: string
 *                 description: Limit to a specific time series
 *               severity:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *               start:
 *                 type: string
 *                 format: date-time
 *               end:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Anomalies resolved successfully
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
 *                     count: { type: integer }
 *       401:
 *         description: Not authenticated
 */
// POST /api/anomalies/bulk-resolve - Bulk resolve anomalies (requires authentication)
router.post(
	"/bulk-resolve",
	authenticate,
	asyncHandler(async (req: AuthRequest, res) => {
		const validatedData = bulkResolveSchema.parse(req.body);
		const count = await bulkResolveAnomalies(validatedData, req.userId as string, req.user?.role);
		return successWithMessage(res, { count }, `Resolved ${count} anomalies`);
	}),
);

export { router as anomaliesRouter };
