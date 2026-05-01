import { Router } from 'express';
import { prisma, logger } from '@/lib';
import type { Prisma } from '@prisma/client';
import { authenticate, type AuthRequest } from '@/middleware/auth';
import { asyncHandler, NotFoundError, ForbiddenError, BadRequestError } from '@/middleware/errorHandler';
import { getPagination, paginationSchema } from '@/schemas/common';
import { createDatasetSchema as newCreateDatasetSchema, updateDatasetSchema as newUpdateDatasetSchema } from '@/schemas/datasets';
import { cacheRoute, invalidateCache } from '@/middleware/cacheDecorator';
import { success, paginated } from '@/lib/response';
import Papa from 'papaparse';

const router = Router();

type DatasetRow = {
  sizeBytes?: bigint | null;
  rowsCount?: number | null;
  owner?: Record<string, unknown>;
  [key: string]: unknown;
};

// Helper to serialize BigInt fields for JSON responses
const serializeDataset = (dataset: DatasetRow) => {
  const serialized: DatasetRow = { ...dataset };

  // Convert all BigInt fields to string
  if (serialized.sizeBytes) serialized.sizeBytes = serialized.sizeBytes.toString() as unknown as bigint;

  // Handle nested objects
  if (serialized.owner) serialized.owner = { ...serialized.owner };

  return serialized;
};

const _serializeDatasets = (datasets: DatasetRow[]) =>
  datasets.map((ds: DatasetRow) => serializeDataset(ds));

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
router.get('/', authenticate, cacheRoute('datasets:list', 300), asyncHandler(async (req: AuthRequest, res) => {
  const { search } = req.query;
  const { skip, take } = getPagination(req.query);
  const params = paginationSchema.parse(req.query);

  const where: Prisma.DatasetWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [datasets, total] = await Promise.all([
    prisma.dataset.findMany({
      where,
      skip,
      take,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { timeseries: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dataset.count({ where }),
  ]);

  // Convert BigInt to string for JSON serialization
  const serializedDatasets = datasets.map((ds: { sizeBytes?: bigint | null; rowsCount?: number | null; [key: string]: unknown }) => ({
    ...ds,
    sizeBytes: ds.sizeBytes?.toString() || null,
    rowsCount: ds.rowsCount || null,
  }));

  res.json({
    success: true,
    data: serializedDatasets,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
    total,
  });
}));

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
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const dataset = await prisma.dataset.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      timeseries: {
        include: {
          _count: { select: { dataPoints: true } },
        },
      },
      _count: { select: { timeseries: true } },
    },
  });

  if (!dataset) {
    throw new NotFoundError('Dataset');
  }

  success(res, serializeDataset(dataset));
}));

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
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const validatedData = newCreateDatasetSchema.parse(req.body);

  // Check slug uniqueness
  const existing = await prisma.dataset.findFirst({
    where: {
      slug: validatedData.slug,
    },
  });

  if (existing) {
    throw new BadRequestError('Slug already exists');
  }

  // Get or create default organization for the user
  const defaultOrgId = 'default-org-id';
  let organization = await prisma.organizations.findFirst({
    where: { name: 'Default' },
  });

  if (!organization) {
    organization = await prisma.organizations.create({
      data: {
        id: defaultOrgId,
        owner_id: userId,
        name: 'Default',
        slug: 'default',
      },
    });
  }

  const dataset = await prisma.dataset.create({
    data: {
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description,
      storageFormat: validatedData.storageFormat,
      ownerId: userId,
      organization_id: organization.id,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  // Invalidate cache after creating a dataset
  invalidateCache('datasets:*').catch((err) => logger.error('Failed to invalidate cache:', err));

  success(res, serializeDataset(dataset), 201);
}));

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
router.patch('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const validatedData = newUpdateDatasetSchema.parse(req.body);

  const dataset = await prisma.dataset.findUnique({
    where: { id: req.params.id },
  });

  if (!dataset) {
    throw new NotFoundError('Dataset');
  }

  // Check ownership (simplified)
  if (dataset.ownerId !== userId) {
    throw new ForbiddenError();
  }

  const updatedDataset = await prisma.dataset.update({
    where: { id: req.params.id },
    data: {
      ...validatedData,
      lastAccessedAt: new Date(),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  // Invalidate cache after updating a dataset
  invalidateCache('datasets:*').catch((err) => console.error('Failed to invalidate cache:', err));

  success(res, serializeDataset(updatedDataset));
}));

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
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const dataset = await prisma.dataset.findUnique({
    where: { id: req.params.id },
  });

  if (!dataset) {
    throw new NotFoundError('Dataset');
  }

  // Check ownership
  if (dataset.ownerId !== userId) {
    throw new ForbiddenError();
  }

  await prisma.dataset.delete({
    where: { id: req.params.id },
  });

  // Invalidate cache after deleting a dataset
  invalidateCache('datasets:*').catch((err) => console.error('Failed to invalidate cache:', err));

  success(res, null);
}));

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
router.post('/:id/import', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { format, data } = req.body;

  if (!format || !data) {
    throw new BadRequestError('Format and data are required');
  }

  const dataset = await prisma.dataset.findUnique({
    where: { id: req.params.id },
  });

  if (!dataset) {
    throw new NotFoundError('Dataset');
  }

  // Check ownership
  if (dataset.ownerId !== req.userId) {
    throw new ForbiddenError();
  }

  let parsedData: Record<string, unknown>[] = [];
  let timestampColumn = 'timestamp';
  let valueColumns: string[] = [];

  // Parse data based on format
  if (format === 'csv') {
    const parseResult = Papa.parse(data, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      throw new BadRequestError('CSV parsing failed');
    }

    parsedData = parseResult.data as Record<string, unknown>[];

    // Find timestamp column (look for common names)
    const columns = Object.keys(parsedData[0] || {});
    timestampColumn = columns.find(col =>
      ['timestamp', 'time', 'datetime', 'date', 'ts'].includes(col.toLowerCase())
    ) || columns[0];

    // Value columns are all columns except timestamp
    valueColumns = columns.filter(col => col !== timestampColumn);
  } else if (format === 'json') {
    parsedData = Array.isArray(data) ? data : [data];
    const columns = Object.keys(parsedData[0] || {});
    timestampColumn = columns.find(col =>
      ['timestamp', 'time', 'datetime', 'date', 'ts'].includes(col.toLowerCase())
    ) || columns[0];
    valueColumns = columns.filter(col => col !== timestampColumn);
  } else {
    throw new BadRequestError('Unsupported format. Use "csv" or "json"');
  }

  if (parsedData.length === 0) {
    throw new BadRequestError('No data found');
  }

  // Create timeseries for each value column
  const timeseries = await Promise.all(
    valueColumns.map(async (column) => {
      // Generate slug from column name (lowercase, replace spaces with hyphens)
      const slug = column.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      return prisma.timeseries.upsert({
        where: {
          datasetId_slug: {
            datasetId: dataset.id,
            slug: slug,
          },
        },
        update: {},
        create: {
          datasetId: dataset.id,
          name: column,
          slug: slug,
          unit: '',
        },
      });
    })
  );

  // Batch insert datapoints (1000 at a time)
  const batchSize = 1000;
  let totalDatapoints = 0;

  for (let i = 0; i < parsedData.length; i += batchSize) {
    const batch = parsedData.slice(i, i + batchSize);
    const datapoints: { timeseriesId: string; timestamp: Date; valueJson: string }[] = [];

    for (const row of batch) {
      const timestamp = new Date(row[timestampColumn] as string | number | Date);
      if (Number.isNaN(timestamp.getTime())) {
        continue;
      }

      for (const ts of timeseries) {
        const value = row[ts.name];
        if (value !== null && value !== undefined) {
          datapoints.push({
            timeseriesId: ts.id,
            timestamp,
            valueJson: JSON.stringify(value),
          });
        }
      }
    }

    if (datapoints.length > 0) {
      await prisma.datapoint.createMany({
        data: datapoints,
        skipDuplicates: true,
      });
      totalDatapoints += datapoints.length;
    }
  }

  // Update dataset with import statistics
  const updatedDataset = await prisma.dataset.update({
    where: { id: req.params.id },
    data: {
      isImported: true,
      rowsCount: totalDatapoints,
      lastAccessedAt: new Date(),
    },
  });

  success(res, {
    dataset: serializeDataset(updatedDataset),
    importStats: {
      timeseriesCreated: timeseries.length,
      datapointsImported: totalDatapoints,
      columns: valueColumns,
    },
  });
}));

export { router as datasetsRouter };
