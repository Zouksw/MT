import { Router } from 'express';
import { AnomalySeverity, DetectionMethod, AlertSeverity, AlertType, Prisma } from '@prisma/client';
import { prisma, logger } from '@/lib';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { asyncHandler, NotFoundError, BadRequestError } from '@/middleware/errorHandler';
import { getPagination, paginationSchema } from '@/schemas/common';
import { anomaliesQuerySchema, detectAnomaliesSchema, updateAnomalySchema, bulkResolveSchema } from '@/schemas/anomalies';
import { success, paginated, successWithMessage } from '@/lib/response';

const router = Router();

// Get authenticated user ID, fallback to default for compatibility
const getUser = (req: AuthRequest) => req.userId || '00000000-0000-0000-0000-000000000001';

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
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { timeseriesId, severity } = req.query;
  const { skip, take } = getPagination(req.query);
  const params = anomaliesQuerySchema.parse(req.query);

  const where: Prisma.AnomalyWhereInput = {};
  if (timeseriesId) where.timeseriesId = timeseriesId as string;
  if (severity) where.severity = severity as AnomalySeverity;
  if (params.isResolved !== undefined) where.isResolved = params.isResolved;

  const [anomalies, total] = await Promise.all([
    prisma.anomaly.findMany({
      where,
      skip,
      take,
      include: {
        timeseries: {
          select: { id: true, name: true, slug: true, unit: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.anomaly.count({ where }),
  ]);

  return paginated(res, anomalies, {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  });
}));

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
router.get('/:id', asyncHandler(async (req, res) => {
  const anomaly = await prisma.anomaly.findUnique({
    where: { id: req.params.id },
    include: {
      timeseries: {
        include: {
          dataset: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  if (!anomaly) {
    throw new NotFoundError('Anomaly');
  }

  return success(res, { anomaly });
}));

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
 *                 enum: [STATISTICAL, RULE_BASED, ML_AUTOENCODER]
 *                 description: Detection method (ML_AUTOENCODER not yet implemented)
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
router.post('/detect', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const validatedData = detectAnomaliesSchema.parse(req.body);

  const timeseries = await prisma.timeseries.findUnique({
    where: { id: validatedData.timeseriesId },
  });

  if (!timeseries) {
    throw new NotFoundError('Timeseries');
  }

  // Get data points for analysis
  const dataPoints = await prisma.datapoint.findMany({
    where: {
      timeseriesId: validatedData.timeseriesId,
      ...(validatedData.start && { timestamp: { gte: new Date(validatedData.start) } }),
      ...(validatedData.end && { timestamp: { lte: new Date(validatedData.end) } }),
    },
    orderBy: { timestamp: 'asc' },
    take: 100000,
  });

  if (dataPoints.length < validatedData.windowSize) {
    throw new BadRequestError(`Not enough data points. Need at least ${validatedData.windowSize} points`);
  }

  // Detect anomalies based on method
  const detectedAnomalies: Array<{
    timeseriesId: string;
    datapointId: bigint;
    severity: AnomalySeverity;
    detectionMethod: DetectionMethod;
    score: string;
    context: Prisma.InputJsonValue;
  }> = [];

  if (validatedData.method === 'STATISTICAL') {
    // Z-score based detection
    const values = dataPoints.map(dp => Number(dp.valueJson) || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const zThreshold = 3; // 3 standard deviations

    for (let i = validatedData.windowSize; i < dataPoints.length; i++) {
      const value = Number(dataPoints[i].valueJson) || 0;
      const zScore = Math.abs((value - mean) / stdDev);

      if (zScore > zThreshold) {
        const severity = zScore > 5 ? 'CRITICAL' : zScore > 4 ? 'HIGH' : zScore > 3 ? 'MEDIUM' : 'LOW';
        const score = zScore / 5; // Normalize to 0-1

        detectedAnomalies.push({
          timeseriesId: validatedData.timeseriesId,
          datapointId: BigInt(dataPoints[i].id),
          severity: severity as AnomalySeverity,
          detectionMethod: 'STATISTICAL' as DetectionMethod,
          score: score.toFixed(2),
          context: {
            value,
            mean: mean.toFixed(2),
            stdDev: stdDev.toFixed(2),
            zScore: zScore.toFixed(2),
            windowSize: validatedData.windowSize,
          },
        });
      }
    }
  } else if (validatedData.method === 'RULE_BASED') {
    // Simple rule-based: detect sudden changes
    const threshold = validatedData.threshold;
    const windowSize = validatedData.windowSize;

    for (let i = windowSize; i < dataPoints.length; i++) {
      const currentValue = Number(dataPoints[i].valueJson) || 0;
      const windowValues = dataPoints.slice(i - windowSize, i).map(dp => Number(dp.valueJson) || 0);
      const windowMean = windowValues.reduce((a, b) => a + b, 0) / windowSize;

      const percentChange = Math.abs((currentValue - windowMean) / (windowMean || 1));

      if (percentChange > (1 - threshold)) {
        const severity = percentChange > 0.5 ? 'CRITICAL' : percentChange > 0.3 ? 'HIGH' : 'MEDIUM';
        const score = Math.min(percentChange * 2, 1);

        detectedAnomalies.push({
          timeseriesId: validatedData.timeseriesId,
          datapointId: BigInt(dataPoints[i].id),
          severity: severity as AnomalySeverity,
          detectionMethod: 'RULE_BASED' as DetectionMethod,
          score: score.toFixed(2),
          context: {
            currentValue,
            windowMean: windowMean.toFixed(2),
            percentChange: (percentChange * 100).toFixed(2) + '%',
          },
        });
      }
    }
  } else {
    // ML_AUTOENCODER - not yet implemented
    throw new BadRequestError(
      'ML_AUTOENCODER detection method is not yet implemented. ' +
      'Please use STATISTICAL or RULE_BASED methods. ' +
      'Contact administrator for AI feature availability.'
    );
  }

  // Batch create anomalies
  const created = await prisma.anomaly.createMany({
    data: detectedAnomalies,
    skipDuplicates: true,
  });

  // Update timeseries anomaly detection status
  await prisma.timeseries.update({
    where: { id: validatedData.timeseriesId },
    data: { isAnomalyDetectionEnabled: true },
  });

  // Create alerts for high/critical anomalies
  const highSeverityAnomalies = detectedAnomalies.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL');
  if (highSeverityAnomalies.length > 0) {
    const userId = getUser(req);
    await prisma.alert.createMany({
      data: highSeverityAnomalies.slice(0, 10).map(anomaly => ({
        userId,
        timeseriesId: validatedData.timeseriesId,
        type: 'ANOMALY' as AlertType,
        severity: (anomaly.severity === 'CRITICAL' ? 'ERROR' : 'WARNING') as AlertSeverity,
        message: `${anomaly.severity} severity anomaly detected (${anomaly.score} anomaly score)`,
        metadata: {
          ...anomaly,
          datapointId: anomaly.datapointId.toString(),
        },
      })),
    });
  }

  // Emit WebSocket event
  const io = req.app.get('io');
  if (io) {
    try {
      io.to(`timeseries:${validatedData.timeseriesId}`).emit('anomalies:detected', {
        timeseriesId: validatedData.timeseriesId,
        count: detectedAnomalies.length,
        method: validatedData.method,
      });
    } catch (wsError) {
      // Log WebSocket error but don't fail the request
      logger.warn('WebSocket emit failed for anomalies:detected event', {
        timeseriesId: validatedData.timeseriesId,
        error: wsError instanceof Error ? wsError.message : 'Unknown error'
      });
    }
  }

  return success(res, {
    anomalies: detectedAnomalies.slice(0, 100), // Return first 100
    meta: {
      timeseriesId: validatedData.timeseriesId,
      method: validatedData.method,
      dataPointsAnalyzed: dataPoints.length,
      anomaliesDetected: detectedAnomalies.length,
      anomaliesCreated: created.count,
    },
  }, 201);
}));

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
router.patch('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const validatedData = updateAnomalySchema.parse(req.body);

  const anomaly = await prisma.anomaly.update({
    where: { id: req.params.id },
    data: {
      ...validatedData,
      ...(validatedData.isResolved && { resolvedAt: new Date() }),
    },
    include: {
      timeseries: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return success(res, { anomaly });
}));

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
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  await prisma.anomaly.delete({
    where: { id: req.params.id },
  });

  return successWithMessage(res, {}, 'Anomaly deleted successfully');
}));

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
router.get('/stats/timeseries/:timeseriesId', asyncHandler(async (req, res) => {
  const { timeseriesId } = req.params;
  const { start, end } = req.query;

  const where: Prisma.AnomalyWhereInput = { timeseriesId };
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start as string);
    if (end) where.createdAt.lte = new Date(end as string);
  }

  const [total, bySeverity, resolved, unresolved] = await Promise.all([
    prisma.anomaly.count({ where }),
    prisma.anomaly.groupBy({
      by: ['severity'],
      where,
      _count: true,
    }),
    prisma.anomaly.count({ where: { ...where, isResolved: true } }),
    prisma.anomaly.count({ where: { ...where, isResolved: false } }),
  ]);

  const severityBreakdown = bySeverity.reduce((acc: Record<string, number>, item) => {
    acc[item.severity] = item._count;
    return acc;
  }, {} as Record<string, number>);

  return success(res, {
    stats: {
      total,
      resolved,
      unresolved,
      resolutionRate: total > 0 ? (resolved / total * 100).toFixed(1) + '%' : '0%',
      severityBreakdown,
    },
  });
}));

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
router.post('/bulk-resolve', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const validatedData = bulkResolveSchema.parse(req.body);

  const where: Prisma.AnomalyWhereInput = { isResolved: false };
  if (validatedData.timeseriesId) where.timeseriesId = validatedData.timeseriesId;
  if (validatedData.severity) where.severity = validatedData.severity as AnomalySeverity;
  if (validatedData.start || validatedData.end) {
    where.createdAt = {};
    if (validatedData.start) where.createdAt.gte = new Date(validatedData.start);
    if (validatedData.end) where.createdAt.lte = new Date(validatedData.end);
  }

  const result = await prisma.anomaly.updateMany({
    where,
    data: {
      isResolved: true,
      resolvedAt: new Date(),
    },
  });

  return successWithMessage(res, { count: result.count }, `Resolved ${result.count} anomalies`);
}));

export { router as anomaliesRouter };
