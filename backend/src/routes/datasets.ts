import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib';
import { logger } from '@/utils/logger';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { asyncHandler, NotFoundError, ForbiddenError, BadRequestError } from '@/middleware/errorHandler';
import { getPagination, paginationSchema } from '@/schemas/common';
import { createDatasetSchema as newCreateDatasetSchema, updateDatasetSchema as newUpdateDatasetSchema } from '@/schemas/datasets';
import { cacheRoute, invalidateCache } from '@/middleware/cacheDecorator';
import Papa from 'papaparse';

const router = Router();

// Helper to serialize BigInt fields for JSON responses
const serializeDataset = (dataset: any) => {
  const serialized: any = { ...dataset };

  // Convert all BigInt fields to string
  if (serialized.sizeBytes) serialized.sizeBytes = serialized.sizeBytes.toString();
  if (serialized.rowsCount) serialized.rowsCount = serialized.rowsCount;

  // Handle nested objects
  if (serialized.owner) serialized.owner = { ...serialized.owner };

  return serialized;
};

const serializeDatasets = (datasets: any[]) =>
  datasets.map((ds: any) => {
    const serialized: any = { ...ds };

    // Convert all BigInt fields to string
    if (serialized.sizeBytes) serialized.sizeBytes = serialized.sizeBytes.toString();
    if (serialized.rowsCount) serialized.rowsCount = serialized.rowsCount;

    // Handle nested objects
    if (serialized.owner) serialized.owner = { ...serialized.owner };

    return serialized;
  });

// GET /api/datasets - Get all datasets (public access)
// Cache for 5 minutes - datasets list changes infrequently
router.get('/', authenticate, cacheRoute('datasets:list', 300), asyncHandler(async (req: AuthRequest, res) => {
  const { search } = req.query;
  const { skip, take } = getPagination(req.query);
  const params = paginationSchema.parse(req.query);

  const where: any = {};

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
  const serializedDatasets = datasets.map((ds: any) => ({
    ...ds,
    sizeBytes: ds.sizeBytes?.toString() || null,
    rowsCount: ds.rowsCount || null,
  }));

  res.json({
    datasets: serializedDatasets,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  });
}));

// GET /api/datasets/:id - Get single dataset
router.get('/:id', asyncHandler(async (req, res) => {
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

  res.json({ dataset: serializeDataset(dataset) });
}));

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

  res.status(201).json({ dataset: serializeDataset(dataset) });
}));

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

  res.json({ dataset: serializeDataset(updatedDataset) });
}));

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

  res.json({ success: true, message: 'Dataset deleted successfully' });
}));

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

  let parsedData: any[] = [];
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

    parsedData = parseResult.data;

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
      const timestamp = new Date(row[timestampColumn]);
      if (isNaN(timestamp.getTime())) {
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

  res.json({
    dataset: serializeDataset(updatedDataset),
    importStats: {
      timeseriesCreated: timeseries.length,
      datapointsImported: totalDatapoints,
      columns: valueColumns,
    },
  });
}));

export { router as datasetsRouter };
