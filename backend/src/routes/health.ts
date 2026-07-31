/**
 * Health check routes
 * Provides system health status and readiness checks
 */

import { type Request, type Response, Router } from "express";
import { logger, prisma } from "@/lib";
import { getRedisClient } from "@/lib/redis";
import { error, success } from "@/lib/response";
import { asyncHandler } from "@/middleware/errorHandler";
import { getDataHealth } from "@/services/dataHealth";
import { checkReadiness as inferenceReadiness } from "@/services/inference";

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
router.get("/", (_req: Request, res: Response) => {
	return success(res, {
		status: "ok",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		environment: process.env.NODE_ENV || "development",
	});
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness check
 *     description: Verifies all dependent services (database, Redis, inference) are connected and ready.
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
 *                         inference: { type: boolean, description: "true iff chronos ensemble ready (not just process alive)" }
 *                         inferenceDetail:
 *                           type: object
 *                           description: "Liveness vs readiness split"
 *                           properties:
 *                             alive: { type: boolean }
 *                             ready: { type: boolean }
 *                             readyVariants: { type: array, items: { type: string } }
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
router.get(
	"/ready",
	asyncHandler(async (_req: Request, res: Response) => {
		const checks = {
			database: false,
			redis: false,
			inference: false as boolean,
			// Inference readiness detail: alive (process up) vs ready (chronos
			// ensemble usable). They differ when the process is up but chronos
			// weights are missing — baselines still serve, so the platform is
			// degraded, not down. The flat `inference` boolean above stays
			// backward-compatible (true iff ready).
			inferenceDetail: {
				alive: false,
				ready: false,
				readyVariants: [] as string[],
			},
			// Data-layer health (round-48): infra can be all-green while the DATA
			// layer is silently failing (scrapers dormant, no fresh prices,
			// predictions unverifiable). Surfaced here so an operator sees the
			// difference between "service up" and "data flowing". Does NOT affect
			// the HTTP status — data staleness is an operational concern, not a
			// service-down condition (the SLA is infra readiness).
			dataLayer: null as null | {
				anyDataFlowing: boolean;
				freshSourceCount: number;
				registeredSourceCount: number;
				predictionBacklog: number;
				predictionVerified: number;
				verificationRatio: number;
				hasVerificationDebt: boolean;
			},
		};

		let allHealthy = true;

		// Check database connection
		try {
			await prisma.$queryRaw`SELECT 1`;
			checks.database = true;
		} catch (_error) {
			allHealthy = false;
		}

		// Check Redis connection
		try {
			const redis = await getRedisClient();
			checks.redis = redis
				? await redis
						.ping()
						.then(() => true)
						.catch(() => false)
				: false;
		} catch (error) {
			logger.warn("[HEALTH] Redis check failed", error);
			checks.redis = false;
		}

		// Check inference service — readiness (chronos usable), not just liveness.
		// The process being up (alive) doesn't mean chronos is available; /ready
		// probes the actual model ensemble. Report both so operators can see
		// "degraded" vs "down".
		try {
			const readiness = await inferenceReadiness();
			checks.inferenceDetail = {
				alive: readiness.alive,
				ready: readiness.ready,
				readyVariants: readiness.readyVariants,
			};
			checks.inference = readiness.ready;
			if (!readiness.ready && readiness.alive) {
				logger.warn("[HEALTH] Inference process alive but chronos not ready", {
					readyVariants: readiness.readyVariants,
				});
			}
		} catch (error) {
			logger.warn("[HEALTH] Inference readiness check failed", error);
			checks.inference = false;
		}

		// Data-layer snapshot (best-effort: never fails the readiness check).
		// A short 3-day window is the freshness bar — a source writing less
		// often than that is effectively stale to a daily user.
		try {
			const dh = await getDataHealth(3);
			checks.dataLayer = {
				anyDataFlowing: dh.anyDataFlowing,
				freshSourceCount: dh.freshSourceCount,
				registeredSourceCount: dh.registeredSourceCount,
				predictionBacklog: dh.predictionBacklog,
				predictionVerified: dh.predictionVerified,
				verificationRatio: dh.verificationRatio,
				hasVerificationDebt: dh.hasVerificationDebt,
			};
		} catch (error) {
			// Data-health is observability; a failure here must not flip the
			// service to 503. Logged for diagnosis.
			logger.warn("[HEALTH] Data-layer health check failed", error);
		}

		if (allHealthy) {
			return success(res, {
				status: "ready",
				checks,
				timestamp: new Date().toISOString(),
			});
		} else {
			return error(res, "Service not ready", 503, "SERVICE_NOT_READY", {
				checks,
			});
		}
	}),
);

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
router.get("/live", (_req: Request, res: Response) => {
	return success(res, {
		status: "alive",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		memory: process.memoryUsage(),
	});
});

export default router;
