/**
 * Performance metrics routes
 * Provides real-time server performance data and Web Vitals for the monitoring dashboard
 *
 * Business logic + the in-memory store live in `services/metricsService`.
 * This module owns only the HTTP boundary: auth, validation, response shaping,
 * and the `res.on("finish")` timing hook (which needs the raw req/res).
 */

import { type Request, type Response, Router } from "express";
import { logger } from "@/lib";
import { error, success, validationError } from "@/lib/response";
import { authenticate } from "@/middleware/auth";
import {
	formatBytes,
	formatUptime,
	getActiveUserCount,
	getEndpointSnapshot,
	getGlobalDurationsSorted,
	getResponseTimeDistribution,
	getSummaryWebVitals,
	getTotalErrorCount,
	getTotalRequestCount,
	getWebVitalsHistory,
	getWebVitalsSummary,
	INTERVAL_SECONDS,
	PERIOD_SECONDS,
	percentile,
	recordRequest,
	storeWebVital,
	VALID_WEB_VITAL_NAMES,
	type WebVitalName,
} from "@/services/metricsService";

const router = Router();

// Protect all metrics endpoints except web-vitals ingestion
router.use((req, _res, next) => {
	// POST /web-vitals is public (frontend sends data)
	if (req.method === "POST" && req.path === "/web-vitals") {
		return next();
	}
	authenticate(req as unknown as Request, _res as unknown as Response, next);
});

// --- Metrics tracking middleware ---

router.use((req: Request, res: Response, next) => {
	const start = process.hrtime.bigint();

	res.on("finish", () => {
		const elapsedNs = process.hrtime.bigint() - start;
		const elapsedMs = Number(elapsedNs) / 1_000_000;
		const endpoint = `${req.method} ${req.route?.path || req.path}`;
		recordRequest(endpoint, elapsedMs);
	});

	next();
});

// --- Server Metrics Routes ---

/**
 * GET /api/metrics
 * Returns comprehensive server performance metrics
 */
router.get("/", authenticate, (_req: Request, res: Response) => {
	const mem = process.memoryUsage();
	const cpu = process.cpuUsage();
	const uptimeSeconds = process.uptime();

	const endpoints = getEndpointSnapshot();

	// Reconstruct total duration from per-endpoint avg*count to avoid exposing
	// the raw store. avg is already rounded to 2dp — close enough for a dashboard.
	let globalTotalDuration = 0;
	for (const metrics of Object.values(endpoints)) {
		globalTotalDuration += metrics.avgResponseTime * metrics.count;
	}
	const totalReq = getTotalRequestCount();
	const avgResponseTime =
		totalReq > 0 ? parseFloat((globalTotalDuration / totalReq).toFixed(2)) : 0;

	const responseTimeDistribution = getResponseTimeDistribution();

	return success(res, {
		timestamp: new Date().toISOString(),
		uptime: {
			seconds: parseFloat(uptimeSeconds.toFixed(2)),
			formatted: formatUptime(uptimeSeconds),
		},
		memory: {
			rss: mem.rss,
			rssFormatted: formatBytes(mem.rss),
			heapTotal: mem.heapTotal,
			heapTotalFormatted: formatBytes(mem.heapTotal),
			heapUsed: mem.heapUsed,
			heapUsedFormatted: formatBytes(mem.heapUsed),
			external: mem.external,
			externalFormatted: formatBytes(mem.external),
			arrayBuffers: mem.arrayBuffers,
			heapUsagePercent: parseFloat(((mem.heapUsed / mem.heapTotal) * 100).toFixed(2)),
		},
		cpu: {
			userMicroseconds: cpu.user,
			systemMicroseconds: cpu.system,
			userMs: parseFloat((cpu.user / 1000).toFixed(2)),
			systemMs: parseFloat((cpu.system / 1000).toFixed(2)),
		},
		requests: {
			total: totalReq,
			avgResponseTime,
		},
		endpoints,
		responseTimeDistribution,
	});
});

/**
 * GET /api/metrics/endpoints
 * Returns per-endpoint breakdown
 */
router.get("/endpoints", authenticate, (_req: Request, res: Response) => {
	const snapshot = getEndpointSnapshot();
	const endpoints: Record<
		string,
		{ count: number; avgResponseTime: number; p50: number; p95: number; p99: number }
	> = {};

	for (const [endpoint, m] of Object.entries(snapshot)) {
		endpoints[endpoint] = {
			count: m.count,
			avgResponseTime: m.avgResponseTime,
			p50: m.p50,
			p95: m.p95,
			p99: m.p99,
		};
	}

	return success(res, { endpoints });
});

// --- Web Vitals Routes ---

/**
 * POST /api/metrics/web-vitals
 * Receive frontend Web Vitals data and store in Redis
 *
 * Body: { name: 'LCP'|'FID'|'CLS'|'TTFB'|'INP', value: number, path: string, timestamp?: number }
 */
router.post("/web-vitals", async (req: Request, res: Response) => {
	const { name, value, path, timestamp } = req.body;

	// Validate required fields
	if (!name || !VALID_WEB_VITAL_NAMES.includes(name)) {
		return validationError(res, {
			field: "name",
			issue: `Invalid metric name. Must be one of: ${VALID_WEB_VITAL_NAMES.join(", ")}`,
			context: { value: name },
		});
	}

	// Finite check (round-106): Infinity passed `value < 0` and persisted as
	// an unparseable metric; NaN likewise (NaN < 0 is false).
	if (typeof value !== "number" || value < 0 || !Number.isFinite(value)) {
		return validationError(res, {
			field: "value",
			issue: "Value must be a finite non-negative number",
			context: { value: String(value) },
		});
	}

	if (!path || typeof path !== "string") {
		return validationError(res, {
			field: "path",
			issue: "Path must be a non-empty string",
			context: { value: String(path) },
		});
	}
	// Bound the public unauthenticated beacon's string field (round-106).
	if (path.length > 500) {
		return validationError(res, {
			field: "path",
			issue: "Path must be at most 500 characters",
			context: { length: String(path.length) },
		});
	}

	try {
		const ts = timestamp || Date.now();
		await storeWebVital(name as WebVitalName, value, path, ts);
		return success(res, { stored: true });
	} catch (err) {
		logger.error("[METRICS] Failed to store web vital", {
			error: (err as Error).message,
		});
		return error(res, "Failed to store web vital data", 500);
	}
});

/**
 * GET /api/metrics/web-vitals
 * Get Web Vitals summary for the given period
 *
 * Query params: period (1h|6h|24h|7d, default 24h)
 * Returns: { lcp: { avg, p50, p95, count }, fid: {...}, cls: {...}, ttfb: {...}, inp: {...} }
 */
router.get("/web-vitals", authenticate, async (req: Request, res: Response) => {
	const period = (req.query.period as string) || "24h";
	const periodSeconds = PERIOD_SECONDS[period];

	if (!periodSeconds) {
		return validationError(res, {
			field: "period",
			issue: "Period must be one of: 1h, 6h, 24h, 7d",
			context: { value: period },
		});
	}

	try {
		const result = await getWebVitalsSummary(periodSeconds);
		return success(res, result);
	} catch (err) {
		logger.error("[METRICS] Failed to get web vitals summary", {
			error: (err as Error).message,
		});
		return error(res, "Failed to retrieve web vitals summary", 500);
	}
});

/**
 * GET /api/metrics/web-vitals/history
 * Get time-series data for charts
 *
 * Query params: metric (LCP|FID|CLS), period (1h|6h|24h|7d), interval (1m|5m|15m|1h)
 * Returns array of { timestamp, avg, p95, count }
 */
router.get("/web-vitals/history", authenticate, async (req: Request, res: Response) => {
	const metric = (req.query.metric as string) || "LCP";
	const period = (req.query.period as string) || "24h";
	const interval = (req.query.interval as string) || "1h";

	if (!VALID_WEB_VITAL_NAMES.includes(metric as WebVitalName)) {
		return validationError(res, {
			field: "metric",
			issue: `Metric must be one of: ${VALID_WEB_VITAL_NAMES.join(", ")}`,
			context: { value: metric },
		});
	}

	const periodSeconds = PERIOD_SECONDS[period];
	const intervalSeconds = INTERVAL_SECONDS[interval];

	if (!periodSeconds) {
		return validationError(res, {
			field: "period",
			issue: "Period must be one of: 1h, 6h, 24h, 7d",
			context: { value: period },
		});
	}

	if (!intervalSeconds) {
		return validationError(res, {
			field: "interval",
			issue: "Interval must be one of: 1m, 5m, 15m, 1h",
			context: { value: interval },
		});
	}

	try {
		const history = await getWebVitalsHistory(
			metric as WebVitalName,
			periodSeconds,
			intervalSeconds,
		);
		return success(res, history);
	} catch (err) {
		logger.error("[METRICS] Failed to get web vitals history", {
			error: (err as Error).message,
		});
		return error(res, "Failed to retrieve web vitals history", 500);
	}
});

/**
 * GET /api/metrics/api-latency
 * Get API response time stats from in-memory metrics
 *
 * Returns: { overall: { avg, p50, p95, p99 }, endpoints: { [path]: { avg, p50, p95, p99, count } } }
 */
router.get("/api-latency", authenticate, (_req: Request, res: Response) => {
	const globalDurations = getGlobalDurationsSorted();
	const snapshot = getEndpointSnapshot();

	const endpoints: Record<
		string,
		{ avg: number; p50: number; p95: number; p99: number; count: number }
	> = {};

	for (const [endpoint, m] of Object.entries(snapshot)) {
		endpoints[endpoint] = {
			avg: m.avgResponseTime,
			p50: m.p50,
			p95: m.p95,
			p99: m.p99,
			count: m.count,
		};
	}

	const overallAvg =
		globalDurations.length > 0
			? parseFloat((globalDurations.reduce((s, v) => s + v, 0) / globalDurations.length).toFixed(2))
			: 0;

	return success(res, {
		overall: {
			avg: overallAvg,
			p50: parseFloat(percentile(globalDurations, 0.5).toFixed(2)),
			p95: parseFloat(percentile(globalDurations, 0.95).toFixed(2)),
			p99: parseFloat(percentile(globalDurations, 0.99).toFixed(2)),
		},
		endpoints,
	});
});

/**
 * GET /api/metrics/summary
 * Dashboard summary card data combining web vitals and server metrics
 *
 * Returns: { webVitals: { lcp, fid, cls }, apiLatency: { avg, p95 }, errorRate, uptime, activeUsers }
 */
router.get("/summary", authenticate, async (_req: Request, res: Response) => {
	try {
		const uptimeSeconds = process.uptime();
		const globalDurations = getGlobalDurationsSorted();
		const totalReq = getTotalRequestCount();

		const apiLatencyAvg =
			globalDurations.length > 0
				? parseFloat(
						(globalDurations.reduce((s, v) => s + v, 0) / globalDurations.length).toFixed(2),
					)
				: 0;
		const apiLatencyP95 = parseFloat(percentile(globalDurations, 0.95).toFixed(2));

		// Real error rate: share of recorded responses with status >= 400
		// (round-106 — the field used to be "percent of requests slower than
		// 5s", a latency proxy mislabelled as an error rate: a slow-but-
		// successful scrape inflated "errors" while fast 500s counted as
		// none). slowRequestRate keeps the old signal under an honest name.
		const totalErr = getTotalErrorCount();
		const errorRate = totalReq > 0 ? parseFloat(((totalErr / totalReq) * 100).toFixed(2)) : 0;
		let slowCount = 0;
		for (const d of globalDurations) {
			if (d > 5000) slowCount++;
		}
		const slowRequestRate =
			globalDurations.length > 0
				? parseFloat(((slowCount / globalDurations.length) * 100).toFixed(2))
				: 0;

		// Fetch web vitals + active users in parallel
		const [summaryWv, activeUsers] = await Promise.all([
			getSummaryWebVitals(),
			getActiveUserCount(),
		]);

		return success(res, {
			webVitals: summaryWv,
			apiLatency: {
				avg: apiLatencyAvg,
				p95: apiLatencyP95,
			},
			errorRate,
			slowRequestRate,
			uptime: parseFloat(uptimeSeconds.toFixed(2)),
			activeUsers,
		});
	} catch (err) {
		logger.error("[METRICS] Failed to get summary", {
			error: (err as Error).message,
		});
		return error(res, "Failed to retrieve metrics summary", 500);
	}
});

export { router as metricsRouter };
