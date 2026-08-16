import type { Timeseries } from "@prisma/client";
import { type Response, Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib";
import { paginated, success } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { getPagination, limitSchema, paginationSchema } from "@/schemas/common";
import type { QueryConditions } from "@/types";

const router = Router();

// POST body contract for /:id/data. `value` is required — a missing value
// must be a 400, not a fabricated 0 data point (honesty framework).
const dataPointCreateSchema = z.object({
	timestamp: z.coerce.date().optional(),
	value: z.union([z.number().finite(), z.string().min(1), z.boolean()]),
});

// POST / body contract — mirrors the /timeseries/create form field for field.
const timeseriesCreateSchema = z.object({
	datasetId: z.string().uuid(),
	name: z.string().min(1).max(255),
	slug: z
		.string()
		.min(1)
		.max(255)
		.regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
	unit: z.string().max(50).optional(),
	description: z.string().max(2000).optional(),
	colorHex: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, "Hex color like #F59E0B")
		.optional(),
	timezone: z.string().max(64).default("UTC"),
	isAnomalyDetectionEnabled: z.boolean().optional(),
});

/**
 * POST /api/timeseries - Create a timeseries under an owned dataset.
 *
 * The /timeseries/create page has always submitted here; until this route
 * existed the page 404'd on every submit (found in the round-107 e2e page
 * audit). Ownership follows getOwnedTimeseries convention: 404 for missing
 * AND not-owned, ADMIN bypasses.
 */
router.post(
	"/",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		const input = timeseriesCreateSchema.parse(req.body ?? {});

		const dataset = await prisma.dataset.findFirst({
			where: {
				id: input.datasetId,
				...(req.user?.role === "ADMIN" ? {} : { ownerId: req.userId }),
			},
			select: { id: true },
		});
		if (!dataset) throw new NotFoundError("Dataset");

		const duplicate = await prisma.timeseries.findFirst({
			where: { datasetId: input.datasetId, slug: input.slug },
			select: { id: true },
		});
		if (duplicate) {
			throw new BadRequestError("Slug already exists in this dataset");
		}

		const created = await prisma.timeseries.create({
			data: {
				datasetId: input.datasetId,
				name: input.name,
				slug: input.slug,
				unit: input.unit,
				description: input.description,
				colorHex: input.colorHex,
				timezone: input.timezone,
				isAnomalyDetectionEnabled: input.isAnomalyDetectionEnabled ?? false,
			},
		});

		return success(res, created);
	}),
);

// Mutating endpoints resolve ownership through the parent dataset.
// Same convention as datasetService.getDataset: 404 for both "missing" and
// "not owned" so existence isn't disclosed cross-user; ADMIN bypasses
// (mirrors modelService.deleteModel).
async function getOwnedTimeseries(id: string, userId: string, role: string) {
	const timeseries = await prisma.timeseries.findUnique({
		where: { id },
		include: { dataset: { select: { ownerId: true } } },
	});
	if (!timeseries || (timeseries.dataset.ownerId !== userId && role !== "ADMIN")) {
		throw new NotFoundError("Timeseries");
	}
	return timeseries;
}

/**
 * Timeseries with extended data
 */
interface TimeseriesWithExtended extends Timeseries {
	datapointCount: number;
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
 *     description: Retrieves a time series by ID with datapoint count.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Time series ID
 *     responses:
 *       200:
 *         description: Time series details
 *       404:
 *         description: Time series not found
 */
// GET /api/timeseries/:id - Get single timeseries
router.get(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		const { id } = req.params;

		const timeseries = await prisma.timeseries.findUnique({
			where: { id },
			include: {
				dataset: { select: { id: true, name: true, slug: true, ownerId: true } },
				_count: { select: { dataPoints: true, anomalies: true } },
			},
		});

		// Read scoping (round-106): same rule the mutations already enforce —
		// owner-or-ADMIN, 404 for both missing and foreign series. Previously
		// any authenticated user could read any series (and its counts) by id,
		// bypassing the dataset gate one level up.
		if (!timeseries || (timeseries.dataset.ownerId !== req.userId && req.user?.role !== "ADMIN")) {
			throw new NotFoundError("Timeseries");
		}

		// Use _count from the query result instead of separate count query (fixes N+1 issue)
		const result: TimeseriesWithExtended = {
			...timeseries,
			datapointCount: timeseries._count.dataPoints,
		};

		return success(res, result);
	}),
);

/**
 * @openapi
 * /api/timeseries/{id}/data:
 *   get:
 *     tags: [Time Series]
 *     summary: Get time series data points
 *     description: Retrieves data points for a time series from PostgreSQL.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Time series ID
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: Time series data
 *       404:
 *         description: Time series not found
 */
// GET /api/timeseries/:id/data - Get timeseries data
router.get(
	"/:id/data",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		const { id } = req.params;
		const params = limitSchema.parse(req.query);

		const timeseries = await prisma.timeseries.findUnique({
			where: { id },
			include: { dataset: { select: { ownerId: true } } },
		});

		// Read scoping (round-106): datapoints are the dataset's payload —
		// a user who cannot open the dataset must not read its series'
		// points by id either. Same 404-for-missing-and-foreign contract.
		if (!timeseries || (timeseries.dataset.ownerId !== req.userId && req.user?.role !== "ADMIN")) {
			throw new NotFoundError("Timeseries");
		}

		// Get datapoints from PostgreSQL
		const datapoints = await prisma.datapoint.findMany({
			where: { timeseriesId: id },
			take: params.limit,
			orderBy: { timestamp: "desc" },
		});

		return success(res, {
			data: datapoints,
			pagination: {
				page: 1,
				limit: params.limit,
				total: datapoints.length,
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
 *     description: Inserts a new data point into a time series.
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
		const { timestamp, value } = dataPointCreateSchema.parse(req.body ?? {});

		// Ownership check — anyone-authenticated could previously inject
		// points into any user's series, polluting downstream forecasts.
		await getOwnedTimeseries(id, req.userId as string, req.user?.role ?? "");

		const datapoint = await prisma.datapoint.create({
			data: {
				timeseriesId: id,
				timestamp: timestamp ?? new Date(),
				valueJson: JSON.stringify(value),
			},
		});

		return success(res, datapoint, 201);
	}),
);

/**
 * @openapi
 * /api/timeseries/{id}:
 *   delete:
 *     tags: [Time Series]
 *     summary: Delete a time series
 *     description: Deletes a time series and all its data points from PostgreSQL.
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

		// Ownership check — this is the most destructive endpoint in the
		// workspace area; it previously let any authenticated user delete
		// any user's series and all its data points.
		const timeseries = await getOwnedTimeseries(id, req.userId as string, req.user?.role ?? "");

		// Datapoints/Anomalies cascade via onDelete: Cascade — the manual
		// deleteMany here was both redundant and non-transactional.
		await prisma.timeseries.delete({ where: { id: timeseries.id } });

		return success(res, {
			success: true,
			message: "Timeseries deleted successfully",
		});
	}),
);

export { router as timeseriesRouter };
