import { Router } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest, authorize } from '@/middleware/auth';
import { asyncHandler, BadRequestError, NotFoundError } from '@/middleware/errorHandler';
import { cacheRoute } from '@/middleware/cacheDecorator';
import { success } from '@/lib/response';
import { prisma } from '@/lib';
import { detectFieldMapping, type FieldMapping } from '@/services/dataIngestion/normalizer';
import { parseCSV, importRows } from '@/services/dataIngestion/sources/manualImport';
import { scraperManager } from '@/services/dataIngestion';

const router = Router();

const priceHistorySchema = z.object({
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  from: z.string().optional().transform(v => v ? new Date(v) : undefined),
  to: z.string().optional().transform(v => v ? new Date(v) : undefined),
  limit: z.coerce.number().min(1).max(10000).default(365),
});

const _importSchema = z.object({
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
  '/commodities/:slug/price-multi',
  authenticate,
  cacheRoute('market:prices-multi', 120),
  asyncHandler(async (req: AuthRequest, res) => {
    const { slug } = req.params;
    const interval = (req.query.interval as string) || 'daily';
    const limit = Math.min(Number(req.query.limit) || 365, 10000);

    const commodity = await prisma.commodity.findUnique({ where: { slug } });
    if (!commodity) {
      throw new NotFoundError(`Commodity '${slug}'`);
    }

    const prices = await prisma.commodityPrice.findMany({
      where: { commodityId: commodity.id, interval },
      orderBy: { date: 'asc' },
      take: limit,
      select: { date: true, close: true, source: true, interval: true },
    });

    const bySource = new Map<string, Array<{ date: string; close: number }>>();
    for (const p of prices) {
      const src = p.source;
      if (!bySource.has(src)) bySource.set(src, []);
      bySource.get(src)!.push({
        date: p.date.toISOString().slice(0, 10),
        close: Number(p.close),
      });
    }

    success(res, {
      commodity: { id: commodity.id, slug: commodity.slug, name: commodity.name, unit: commodity.unit },
      interval,
      sources: Object.fromEntries(bySource),
      sourceCount: bySource.size,
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

router.get(
  '/sources',
  authenticate,
  cacheRoute('market:sources', 300),
  asyncHandler(async (_req, res) => {
    const health = scraperManager.getHealth();

    const sourceLabels: Record<string, { label: string; description: string; tier: string }> = {
      commodity_prices: { label: 'Multi-Source Aggregator', description: 'Aggregated commodity prices from multiple public sources', tier: '1' },
      weather: { label: 'Weather Data', description: 'Global weather data affecting commodity production', tier: '1' },
      usda_ams: { label: 'USDA AMS', description: 'US Department of Agriculture Agricultural Marketing Service — livestock, grain, dairy prices', tier: '1' },
      fao_prices: { label: 'FAO', description: 'UN Food and Agriculture Organization — global food price indices and commodity data', tier: '1' },
      world_bank: { label: 'World Bank Pink Sheet', description: 'World Bank monthly commodity prices — 70+ commodities, energy, metals, agriculture', tier: '1' },
      usda_psd: { label: 'USDA FAS PSD', description: 'USDA Foreign Agricultural Service — global production, supply, and distribution data', tier: '1' },
      fred: { label: 'FRED', description: 'Federal Reserve Economic Data — CPI, PPI, interest rates, commodity indices, exchange rates', tier: '1' },
      cme_futures: { label: 'CME Group', description: 'CME Group futures settlement prices — live cattle, grain, oil, metals', tier: '2' },
      abares: { label: 'ABARES', description: 'Australian Bureau of Agricultural and Resource Economics — beef/lamb/grain production & exports', tier: '2' },
      china_wholesale: { label: 'China MARA', description: '中国农业农村部批发市场价格 — daily wholesale prices for meat, vegetables, fruits', tier: '2' },
      china_customs: { label: 'China Customs', description: '中国海关总署 — monthly import/export statistics by commodity and country', tier: '3' },
      dce_futures: { label: 'DCE/CZCE', description: '大商所/郑商所期货 — domestic Chinese futures prices for soybean meal, corn, cotton, etc.', tier: '3' },
      baltic_dry: { label: 'Baltic Dry Index', description: 'Baltic Exchange dry bulk shipping cost index — global freight benchmark', tier: '3' },
    };

    const sources = Object.entries(sourceLabels).map(([key, info]) => ({
      id: key,
      ...info,
      status: health[key]?.success ? 'healthy' : (health[key]?.lastRun ? 'error' : 'pending'),
      lastRun: health[key]?.lastRun ?? null,
      error: health[key]?.error ?? null,
      lastResult: health[key]?.lastResult ?? null,
    }));

    success(res, { sources, count: sources.length });
  }),
);

router.get(
  '/commodities/:slug/sources',
  authenticate,
  cacheRoute('market:commodity-sources', 300),
  asyncHandler(async (req: AuthRequest, res) => {
    const { slug } = req.params;

    const commodity = await prisma.commodity.findUnique({ where: { slug } });
    if (!commodity) {
      throw new NotFoundError(`Commodity '${slug}'`);
    }

    // Get distinct sources and their data coverage
    const sourceStats = await prisma.commodityPrice.groupBy({
      by: ['source'],
      where: { commodityId: commodity.id },
      _count: { id: true },
      _min: { date: true },
      _max: { date: true },
    });

    const factorStats = await prisma.marketFactor.groupBy({
      by: ['source', 'type'],
      where: {
        date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      _count: { id: true },
    });

    const sourceLabels: Record<string, string> = {
      usda_ams: 'USDA AMS',
      fao: 'FAO',
      world_bank: 'World Bank',
      cme: 'CME Group',
      fred: 'FRED',
      usda_psd: 'USDA PSD',
      commodity_prices: 'Aggregated',
      china_mara: 'China MARA',
      china_customs: 'China Customs',
      manual: 'Manual Import',
    };

    const priceSources = sourceStats.map((s) => ({
      id: s.source,
      label: sourceLabels[s.source] || s.source,
      priceCount: s._count.id,
      dateRange: { from: s._min.date, to: s._max.date },
    }));

    const factorSources = factorStats.map((f) => ({
      source: f.source,
      type: f.type,
      label: sourceLabels[f.source] || f.source,
      count: f._count.id,
    }));

    success(res, {
      commodity: { id: commodity.id, slug: commodity.slug, name: commodity.name, unit: commodity.unit },
      priceSources,
      factorSources,
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

    let mapping: FieldMapping | undefined;
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

    const result = await importRows(params.commodityId, rows, mapping!, params.interval);

    success(res, {
      imported: result.inserted + result.updated,
      ...result,
    });
  }),
);

// Manual scraper trigger — run a single source
router.post(
  '/sources/:sourceId/refresh',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { sourceId } = req.params;
    const health = scraperManager.getHealth();

    if (!health[sourceId] && !scraperManager.getHealth()[sourceId]) {
      throw new NotFoundError(`Data source '${sourceId}'`);
    }

    const startTime = Date.now();
    try {
      const result = await scraperManager.runSource(sourceId);
      const elapsed = Date.now() - startTime;

      await prisma.ingestionLog.create({
        data: {
          source: sourceId,
          status: 'success',
          inserted: result.inserted,
          updated: result.updated,
          durationMs: elapsed,
        },
      });

      success(res, { source: sourceId, ...result, elapsedMs: elapsed });
    } catch (err) {
      const elapsed = Date.now() - startTime;
      await prisma.ingestionLog.create({
        data: {
          source: sourceId,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
          durationMs: elapsed,
        },
      });
      throw err;
    }
  }),
);

// Refresh all sources — admin only
router.post(
  '/sources/refresh-all',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (_req, res) => {
    const startTime = Date.now();
    const results = await scraperManager.runAll();
    const elapsed = Date.now() - startTime;

    for (const [source, result] of Object.entries(results)) {
      if ('error' in result) {
        await prisma.ingestionLog.create({
          data: {
            source,
            status: 'error',
            errorMessage: result.error,
            durationMs: elapsed,
          },
        });
      } else {
        const r = result as { inserted: number; updated: number };
        await prisma.ingestionLog.create({
          data: {
            source,
            status: 'success',
            inserted: r.inserted,
            updated: r.updated,
            durationMs: elapsed,
          },
        });
      }
    }

    success(res, { results, elapsedMs: elapsed });
  }),
);

// Data freshness monitoring
router.get(
  '/sources/freshness',
  authenticate,
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get latest ingestion log per source
    const latestLogs = await prisma.ingestionLog.groupBy({
      by: ['source'],
      _max: { createdAt: true },
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    // Get success rate per source (last 7 days)
    const recentLogs = await prisma.ingestionLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
    });

    const sourceStats = new Map<string, { total: number; success: number; lastRun: Date | null; lastInserted: number; lastUpdated: number }>();
    for (const log of recentLogs) {
      const stat = sourceStats.get(log.source) || { total: 0, success: 0, lastRun: null as Date | null, lastInserted: 0, lastUpdated: 0 };
      stat.total++;
      if (log.status === 'success') stat.success++;
      if (!stat.lastRun || log.createdAt > stat.lastRun) {
        stat.lastRun = log.createdAt;
        stat.lastInserted = log.inserted;
        stat.lastUpdated = log.updated;
      }
      sourceStats.set(log.source, stat);
    }

    const freshness = Array.from(sourceStats.entries()).map(([source, stat]) => ({
      source,
      successRate: stat.total > 0 ? Math.round((stat.success / stat.total) * 100) : 0,
      lastRun: stat.lastRun,
      stale: stat.lastRun ? (now.getTime() - stat.lastRun.getTime()) > oneDayAgo.getTime() : true,
      lastInserted: stat.lastInserted,
      lastUpdated: stat.lastUpdated,
      totalRuns: stat.total,
    }));

    const staleSources = freshness.filter((f) => f.stale);
    const healthySources = freshness.filter((f) => !f.stale);

    success(res, {
      freshness,
      summary: {
        total: freshness.length,
        healthy: healthySources.length,
        stale: staleSources.length,
        staleSources: staleSources.map((s) => s.source),
      },
    });
  }),
);

// Ingestion history for a specific source
router.get(
  '/sources/:sourceId/history',
  authenticate,
  asyncHandler(async (req, res) => {
    const { sourceId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const logs = await prisma.ingestionLog.findMany({
      where: { source: sourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    success(res, { source: sourceId, logs, count: logs.length });
  }),
);

export { router as marketDataRouter };
