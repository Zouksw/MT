import { Router } from "express";
import { logger } from "@/lib";
import { success } from "@/lib/response";
import { type AuthenticatedRequest, authenticate } from "@/middleware/auth";
import { cacheRoute, invalidateCache } from "@/middleware/cacheDecorator";
import { asyncHandler } from "@/middleware/errorHandler";
import { getPagination, paginationSchema } from "@/schemas/common";
import {
	createDatasetSchema as newCreateDatasetSchema,
	updateDatasetSchema as newUpdateDatasetSchema,
} from "@/schemas/datasets";
import {
	createDataset,
	deleteDataset,
	getDataset,
	importDatasetData,
	serializeDataset,
	updateDataset,
	listDatasets,
} from "@/services/datasetService";

const router = Router();

/**
 * @openapi
 * /api/datasets:
 *   get:
 *     tags: [Datasets]
 *     summary: List all datasets
 *     description: Retrieves a paginated list of datasets with optional search filtering. Results are cached for 5 minutes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or description
 *     responses:
 *       200:
 *         description: List of datasets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datasets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       slug: { type: string }
 *                       description: { type: string, nullable: true }
 *                       storageFormat: { type: string }
 *                       sizeBytes: { type: string, nullable: true }
 *                       rowsCount: { type: integer, nullable: true }
 *                       isImported: { type: boolean }
 *                       ownerId: { type: string }
 *                       owner:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                           email: { type: string }
 *                       _count:
 *                         type: object
 *                         properties:
 *                           timeseries: { type: integer }
 *                       createdAt: { type: string, format: date-time }
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
// GET /api/datasets - Get all datasets (public access)
// Cache for 5 minutes - datasets list changes infrequently
router.get(
	"/",
	authenticate,
	cacheRoute("datasets:list", 300),
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { search } = req.query;
		const { skip, take } = getPagination(req.query);
		const params = paginationSchema.parse(req.query);

		const { datasets, total } = await listDatasets({
			search: search as string | undefined,
			skip,
			take,
		});

		res.json({
			success: true,
			data: datasets,
			pagination: {
				page: params.page,
				limit: params.limit,
				total,
				totalPages: Math.ceil(total / params.limit),
			},
			total,
		});
	}),
);

/**
 * @openapi
 * /api/datasets/{id}:
 *   get:
 *     tags: [Datasets]
 *     summary: Get a single dataset
 *     description: Retrieves a dataset by ID including its time series and owner information.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Dataset ID
 *     responses:
 *       200:
 *         description: Dataset details with timeseries
 *       404:
 *         description: Dataset not found
 */
// GET /api/datasets/:id - Get single dataset
router.get(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const dataset = await getDataset(req.params.id);
		success(res, serializeDataset(dataset));
	}),
);

/**
 * @openapi
 * /api/datasets:
 *   post:
 *     tags: [Datasets]
 *     summary: Create a new dataset
 *     description: Creates a new dataset owned by the authenticated user. Requires a unique slug.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Temperature Sensors
 *               slug:
 *                 type: string
 *                 example: temperature-sensors
 *               description:
 *                 type: string
 *                 example: Dataset containing temperature readings from IoT sensors
 *               storageFormat:
 *                 type: string
 *                 enum: [CSV, JSON, PARQUET]
 *                 example: CSV
 *     responses:
 *       201:
 *         description: Dataset created successfully
 *       400:
 *         description: Validation error or slug already exists
 *       401:
 *         description: Not authenticated
 */
// POST /api/datasets - Create dataset
router.post(
	"/",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const validatedData = newCreateDatasetSchema.parse(req.body);

		const dataset = await createDataset(validatedData, req.userId);

		// Invalidate cache after creating a dataset
		await invalidateCache("datasets:*").catch((err) =>
			logger.error("Failed to invalidate cache:", err),
		);

		success(res, serializeDataset(dataset), 201);
	}),
);

/**
 * @openapi
 * /api/datasets/{id}:
 *   patch:
 *     tags: [Datasets]
 *     summary: Update a dataset
 *     description: Updates a dataset. Only the owner can update a dataset.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Dataset ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               storageFormat: { type: string }
 *     responses:
 *       200:
 *         description: Dataset updated successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not the dataset owner
 *       404:
 *         description: Dataset not found
 */
// PATCH /api/datasets/:id - Update dataset
router.patch(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const validatedData = newUpdateDatasetSchema.parse(req.body);

		const updatedDataset = await updateDataset(req.params.id, req.userId, validatedData);

		// Invalidate cache after updating a dataset
		await invalidateCache("datasets:*").catch((err) =>
			logger.error("Failed to invalidate cache:", err),
		);

		success(res, serializeDataset(updatedDataset));
	}),
);

/**
 * @openapi
 * /api/datasets/{id}:
 *   delete:
 *     tags: [Datasets]
 *     summary: Delete a dataset
 *     description: Deletes a dataset. Only the owner can delete a dataset.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Dataset ID
 *     responses:
 *       200:
 *         description: Dataset deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not the dataset owner
 *       404:
 *         description: Dataset not found
 */
// DELETE /api/datasets/:id - Delete dataset
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		await deleteDataset(req.params.id, req.userId);

		// Invalidate cache after deleting a dataset
		await invalidateCache("datasets:*").catch((err) =>
			logger.error("Failed to invalidate cache:", err),
		);

		success(res, null);
	}),
);

/**
 * @openapi
 * /api/datasets/{id}/import:
 *   post:
 *     tags: [Datasets]
 *     summary: Import data into a dataset
 *     description: Imports data (CSV or JSON format) into a dataset. Automatically creates time series for each value column.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Dataset ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [format, data]
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [csv, json]
 *                 example: csv
 *               data:
 *                 oneOf:
 *                   - type: string
 *                     description: CSV string data
 *                   - type: array
 *                     items: { type: object }
 *                     description: JSON array of records
 *     responses:
 *       200:
 *         description: Data imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dataset:
 *                   type: object
 *                 importStats:
 *                   type: object
 *                   properties:
 *                     timeseriesCreated: { type: integer }
 *                     datapointsImported: { type: integer }
 *                     columns:
 *                       type: array
 *                       items: { type: string }
 *       400:
 *         description: Invalid format, missing data, or unsupported format
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not the dataset owner
 *       404:
 *         description: Dataset not found
 */
// POST /api/datasets/:id/import - Import data from file
router.post(
	"/:id/import",
	authenticate,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { format, data } = req.body;

		const { dataset, importStats } = await importDatasetData(
			req.params.id,
			req.userId,
			format,
			data,
		);

		success(res, {
			dataset: serializeDataset(dataset),
			importStats,
		});
	}),
);

export { router as datasetsRouter };
