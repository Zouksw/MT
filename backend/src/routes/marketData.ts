import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, authorize } from '@/middleware/auth';
import { asyncHandler, BadRequestError, NotFoundError } from '@/middleware/errorHandler';
import { cacheRoute } from '@/middleware/cacheDecorator';
import { success } from '@/lib/response';
import { prisma } from '@/lib';
import { detectFieldMapping } from '@/services/dataIngestion/normalizer';
import { parseCSV, importRows } from '@/services/dataIngestion/sources/manualImport';
import type { Request, Response } from 'express';

const router = Router();

const priceHistorySchema = z.object({
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  from: z.string().optional().transform(v => v ? new Date(v) : undefined),
  to: z.string().optional().transform(v => v ? new Date(v) : undefined),
  limit: z.coerce.number().min(1).max(10000).default(365),
});

const importSchema = z.object({
  commodityId: z.string().uuid(),
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  delimiter: z.string().max(1).optional(),
});

router.get(
  '/commodities',
  authenticate,
  cacheRoute('market:commodities', 300),
  asyncHandler(async (_req, res) => {
    const commodities = await prisma.commodity.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
      include: {
        prices: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { close: true, date: true },
        },
      },
    });

    const result = commodities.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      nameCn: c.nameCn,
      category: c.category,
      subcategory: c.subcategory,
      grade: c.grade,
      originCountry: c.originCountry,
      unit: c.unit,
      currency: c.currency,
      latestPrice: c.prices[0]?.close ?? null,
      latestDate: c.prices[0]?.date ?? null,
    }));

    success(res, { commodities: result, count: result.length });
  }),
);

router.get(
  '/commodities/:slug/latest',
  authenticate,
  cacheRoute('market:latest', 60),
  asyncHandler(async (req: AuthRequest, res) => {
    const { slug } = req.params;

    const commodity = await prisma.commodity.findUnique({
      where: { slug },
      include: {
        prices: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    if (!commodity) {
      throw new NotFoundError(`Commodity '${slug}'`);
    }

    if (!commodity.prices.length) {
      return success(res, { commodity, price: null });
    }

    const price = commodity.prices[0];
    success(res, {
      commodity: { id: commodity.id, slug: commodity.slug, name: commodity.name, unit: commodity.unit },
      price: {
        date: price.date,
        open: price.open,
        high: price.high,
        low: price.low,
        close: price.close,
        volume: price.volume,
        source: price.source,
      },
    });
  }),
);

router.get(
  '/commodities/:slug/price',
  authenticate,
  cacheRoute('market:prices', 120),
  asyncHandler(async (req: AuthRequest, res) => {
    const { slug } = req.params;
    const params = priceHistorySchema.parse(req.query);

    const commodity = await prisma.commodity.findUnique({ where: { slug } });
    if (!commodity) {
      throw new NotFoundError(`Commodity '${slug}'`);
    }

    const where: Record<string, unknown> = {
      commodityId: commodity.id,
      interval: params.interval,
    };

    if (params.from || params.to) {
      where.date = {
        ...(params.from && { gte: params.from }),
        ...(params.to && { lte: params.to }),
      };
    }

    const prices = await prisma.commodityPrice.findMany({
      where,
      orderBy: { date: 'asc' },
      take: params.limit,
    });

    success(res, {
      commodity: { id: commodity.id, slug: commodity.slug, name: commodity.name, unit: commodity.unit },
      interval: params.interval,
      prices,
      count: prices.length,
    });
  }),
);

router.get(
  '/commodities/:slug/fundamentals',
  authenticate,
  cacheRoute('market:fundamentals', 600),
  asyncHandler(async (req: AuthRequest, res) => {
    const { slug } = req.params;

    const commodity = await prisma.commodity.findUnique({ where: { slug } });
    if (!commodity) {
      throw new NotFoundError(`Commodity '${slug}'`);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const factors = await prisma.marketFactor.findMany({
      where: {
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    success(res, {
      commodity: { id: commodity.id, slug: commodity.slug, category: commodity.category },
      factors,
      count: factors.length,
    });
  }),
);

router.get(
  '/factors/exchange-rates',
  authenticate,
  cacheRoute('market:exchange-rates', 300),
  asyncHandler(async (_req, res) => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const rates = await prisma.marketFactor.findMany({
      where: {
        type: 'exchange_rate',
        date: { gte: sevenDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    const latest = new Map<string, typeof rates[0]>();
    for (const rate of rates) {
      const key = rate.region || 'unknown';
      if (!latest.has(key)) {
        latest.set(key, rate);
      }
    }

    success(res, {
      rates: Array.from(latest.values()),
      count: latest.size,
    });
  }),
);

router.post(
  '/import/preview',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.is('multipart/form-data')) {
      throw new BadRequestError('Content-Type must be multipart/form-data');
    }

    // Lazy-load multer only when needed
    const multer = await import('multer');
    const upload = multer.default({ storage: multer.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upload.single('file')(req as any, res as any, (err) => {
        if (err) reject(new BadRequestError(err.message));
        else resolve();
      });
    });

    const file = (req as unknown as { file?: { buffer: Buffer } }).file;
    if (!file) {
      throw new BadRequestError('No file uploaded');
    }

    const rows = parseCSV(file.buffer);
    if (rows.length === 0) {
      throw new BadRequestError('CSV file is empty');
    }

    const headers = Object.keys(rows[0]);
    const mapping = detectFieldMapping(headers);
    const sample = rows.slice(0, 5);

    success(res, {
      headers,
      detectedMapping: mapping,
      rowCount: rows.length,
      sample,
    });
  }),
);

router.post(
  '/import',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.is('multipart/form-data')) {
      throw new BadRequestError('Content-Type must be multipart/form-data');
    }

    const multer = await import('multer');
    const upload = multer.default({ storage: multer.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upload.single('file')(req as any, res as any, (err) => {
        if (err) reject(new BadRequestError(err.message));
        else resolve();
      });
    });

    const file = (req as unknown as { file?: { buffer: Buffer } }).file;
    if (!file) {
      throw new BadRequestError('No file uploaded');
    }

    const bodySchema = z.object({
      commodityId: z.string().min(1),
      interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
      delimiter: z.string().max(1).optional(),
      mapping: z.record(z.string()).optional(),
    });

    const params = bodySchema.parse(req.body);
    const rows = parseCSV(file.buffer, { delimiter: params.delimiter });

    if (rows.length === 0) {
      throw new BadRequestError('CSV file is empty');
    }

    let mapping;
    if (params.mapping) {
      const m = params.mapping;
      mapping = {
        date: m.date,
        close: m.close,
        open: m.open,
        high: m.high,
        low: m.low,
        volume: m.volume,
      };
    } else {
      const headers = Object.keys(rows[0]);
      mapping = detectFieldMapping(headers);
    }

    const result = await importRows(params.commodityId, rows, mapping, params.interval);

    success(res, {
      imported: result.inserted + result.updated,
      ...result,
    });
  }),
);

export { router as marketDataRouter };
