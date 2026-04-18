/**
 * Health check routes
 * Provides system health status and readiness checks
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@/lib';
import { asyncHandler } from '@/middleware/errorHandler';
import { success, error } from '@/lib/response';
import { getRedisClient } from '@/lib/redis';
import { iotdbClient } from '@/services/iotdb';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Basic health check
 *     description: Returns basic server health information including uptime and environment.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                       description: Process uptime in seconds
 *                     environment:
 *                       type: string
 *                       example: development
 */
/**
 * GET /health
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  return success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness check
 *     description: Verifies all dependent services (database, Redis, IoTDB) are connected and ready.
 *     responses:
 *       200:
 *         description: All services are ready
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
 *                     status:
 *                       type: string
 *                       example: ready
 *                     checks:
 *                       type: object
 *                       properties:
 *                         database: { type: boolean }
 *                         redis: { type: boolean }
 *                         iotdb: { type: boolean }
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       503:
 *         description: One or more services are not ready
 */
/**
 * GET /health/ready
 * Readiness check - verifies all services are connected
 */
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  const checks = {
    database: false,
    redis: false,
    iotdb: false,
  };

  let allHealthy = true;

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    allHealthy = false;
  }

  // Check Redis connection
  try {
    const redis = await getRedisClient();
    checks.redis = redis ? await redis.ping().then(() => true).catch(() => false) : false;
  } catch {
    checks.redis = false;
  }

  // Check IoTDB connection
  try {
    checks.iotdb = await iotdbClient.healthCheck();
  } catch {
    checks.iotdb = false;
  }

  if (allHealthy) {
    return success(res, {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  } else {
    return error(res, 'Service not ready', 503, 'SERVICE_NOT_READY', { checks });
  }
}));

/**
 * @openapi
 * /health/live:
 *   get:
 *     tags: [Health]
 *     summary: Liveness check
 *     description: Verifies the process is running and responsive. Returns memory usage.
 *     responses:
 *       200:
 *         description: Process is alive
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
 *                     status:
 *                       type: string
 *                       example: alive
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                     memory:
 *                       type: object
 *                       properties:
 *                         rss: { type: integer }
 *                         heapTotal: { type: integer }
 *                         heapUsed: { type: integer }
 *                         external: { type: integer }
 */
/**
 * GET /health/live
 * Liveness check - verifies the process is running
 */
router.get('/live', (req: Request, res: Response) => {
  return success(res, {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

export default router;
