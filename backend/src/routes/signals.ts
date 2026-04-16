/**
 * Trading Signals API Routes
 *
 * Static routes (/models, /correlation, /commodities) MUST come before
 * the parameterized /:commodityId route to avoid Express matching them
 * as commodity IDs.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { asyncHandler, BadRequestError } from '@/middleware/errorHandler';
import { generateSignal, getAllModels } from '@/services/tradingSignals';
import { getAllCachedPredictions } from '@/services/predictionCache';
import { getAllModelAccuracy, getModelAccuracy } from '@/services/mapeTracking';
import { computeCorrelation, computeCorrelationMatrix, getAvailableCommodities } from '@/services/correlationAnalysis';
import { checkSignalChange } from '@/services/alertNotifications';
import { runBacktest } from '@/services/backtesting';
import { cacheRoute } from '@/middleware/cacheDecorator';
import { success } from '@/lib/response';

const router = Router();

const signalQuerySchema = z.object({
  horizon: z.coerce.number().min(1).max(100).default(10),
  currentPrice: z.coerce.number().positive(),
  timeseriesPath: z.string().min(1),
  models: z.string().optional(), // comma-separated model IDs
});

// ─── Static routes (MUST come before /:commodityId) ───

/**
 * GET /api/signals/models
 *
 * List active trading models
 */
router.get(
  '/models',
  authenticate,
  asyncHandler(async (_req, res) => {
    const models = getAllModels();
    res.json({
      success: true,
      data: { models, count: models.length },
    });
  })
);

/**
 * GET /api/signals/models/accuracy
 *
 * Get MAPE accuracy for all models (for comparison view)
 */
router.get(
  '/models/accuracy',
  authenticate,
  cacheRoute('signals:models-accuracy', 600),
  asyncHandler(async (req: AuthRequest, res) => {
    const commodityId = req.query.commodityId as string | undefined;
    const days = parseInt(req.query.days as string) || 30;

    const accuracy = await getAllModelAccuracy(commodityId, days);

    res.json({
      success: true,
      data: { accuracy, days },
    });
  })
);

/**
 * GET /api/signals/models/:modelId/accuracy
 *
 * Get detailed accuracy for a specific model
 */
router.get(
  '/models/:modelId/accuracy',
  authenticate,
  cacheRoute('signals:model-accuracy', 600),
  asyncHandler(async (req: AuthRequest, res) => {
    const { modelId } = req.params;
    const commodityId = req.query.commodityId as string | undefined;
    const days = parseInt(req.query.days as string) || 30;

    const accuracy = await getModelAccuracy(modelId, commodityId, days);

    res.json({
      success: true,
      data: accuracy,
    });
  })
);

/**
 * GET /api/signals/models/:modelId/backtest
 *
 * Run backtest for a specific model — compares past predictions
 * against actual outcomes over 7/30/90 day windows.
 */
router.get(
  '/models/:modelId/backtest',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { modelId } = req.params;
    const commodityId = req.query.commodityId as string | undefined;
    const windowsParam = req.query.windows as string | undefined;
    const windows = windowsParam
      ? windowsParam.split(',').map(Number).filter(n => n > 0)
      : [7, 30, 90];

    const result = await runBacktest(modelId, commodityId, windows);
    success(res, result);
  })
);

/**
 * GET /api/signals/correlation
 *
 * Compute Pearson correlation between two commodities
 */
router.get(
  '/correlation',
  authenticate,
  cacheRoute('signals:correlation', 1800),
  asyncHandler(async (req: AuthRequest, res) => {
    const { a, b, window } = req.query as { a?: string; b?: string; window?: string };

    if (!a || !b) {
      throw new BadRequestError('Query params "a" and "b" (commodity slugs) are required');
    }

    const windowDays = parseInt(window || '30');
    const result = await computeCorrelation(a, b, windowDays);

    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/signals/correlation/matrix
 *
 * Compute full pairwise correlation matrix
 */
router.get(
  '/correlation/matrix',
  authenticate,
  cacheRoute('signals:correlation-matrix', 1800),
  asyncHandler(async (req: AuthRequest, res) => {
    const { commodities, window } = req.query as { commodities?: string; window?: string };

    const windowDays = parseInt(window || '30');

    let commodityIds: string[];
    if (commodities) {
      commodityIds = commodities.split(',').filter(Boolean);
    } else {
      // Use all available commodities
      const available = await getAvailableCommodities();
      commodityIds = available.map((c) => c.slug);
    }

    if (commodityIds.length < 2) {
      throw new BadRequestError('At least 2 commodities required for correlation');
    }

    const matrix = await computeCorrelationMatrix(commodityIds, windowDays);

    res.json({ success: true, data: matrix });
  })
);

/**
 * GET /api/signals/commodities
 *
 * List available commodities for correlation analysis
 */
router.get(
  '/commodities',
  authenticate,
  asyncHandler(async (_req, res) => {
    const commodities = await getAvailableCommodities();
    res.json({ success: true, data: commodities });
  })
);

// ─── Parameterized routes ───

/**
 * GET /api/signals/:commodityId
 *
 * Generate a trading signal for a commodity by running predictions
 * from multiple models and computing consensus.
 */
router.get(
  '/:commodityId',
  authenticate,
  cacheRoute('signals:commodity', 300), // cache for 5 minutes
  asyncHandler(async (req: AuthRequest, res) => {
    const { commodityId } = req.params;
    const params = signalQuerySchema.parse(req.query);

    const models = params.models
      ? params.models.split(',').filter(m => m)
      : undefined;

    const signal = await generateSignal({
      commodityId,
      timeseriesPath: params.timeseriesPath,
      horizon: params.horizon,
      currentPrice: params.currentPrice,
      models,
    });

    // Check for signal changes and send notifications (non-blocking)
    const io = req.app.get('io');
    checkSignalChange(commodityId, signal.type, signal.confidence, io).catch(() => {});

    res.json({
      success: true,
      data: {
        commodityId,
        ...signal,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/signals/:commodityId/predictions
 *
 * Get all cached predictions for a commodity (quick load for dashboard)
 */
router.get(
  '/:commodityId/predictions',
  authenticate,
  cacheRoute('signals:predictions', 300),
  asyncHandler(async (req: AuthRequest, res) => {
    const { commodityId } = req.params;
    const horizon = parseInt(req.query.horizon as string) || 10;
    const models = getAllModels();

    const predictions = await getAllCachedPredictions(commodityId, horizon, models);

    res.json({
      success: true,
      data: {
        commodityId,
        horizon,
        predictions: Object.fromEntries(predictions),
        cachedAt: new Date().toISOString(),
      },
    });
  })
);

export { router as signalsRouter };
