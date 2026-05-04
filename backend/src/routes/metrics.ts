/**
 * Performance metrics routes
 * Provides real-time server performance data and Web Vitals for the monitoring dashboard
 */

import { type Request, type Response, Router } from "express";
import { logger } from "@/lib";
import { redis } from "@/lib/redis";
import { error, success, validationError } from "@/lib/response";
import { authenticate } from "@/middleware/auth";

const router = Router();

// Protect all metrics endpoints except web-vitals ingestion
router.use((req, _res, next) => {
	// POST /web-vitals is public (frontend sends data)
	if (req.method === "POST" && req.path === "/web-vitals") {
		return next();
	}
	authenticate(req as unknown as Request, _res as unknown as Response, next);
});

// --- In-memory metrics store ---

interface EndpointMetrics {
	count: number;
	totalDuration: number;
	durations: number[];
}

const endpointMetrics = new Map<string, EndpointMetrics>();
let totalRequestCount = 0;

// Keep only the last 100 durations per endpoint to bound memory
const MAX_DURATIONS = 100;

function recordRequest(endpoint: string, durationMs: number): void {
	totalRequestCount++;

	const existing = endpointMetrics.get(endpoint);
	if (existing) {
		existing.count++;
		existing.totalDuration += durationMs;
		existing.durations.push(durationMs);
		if (existing.durations.length > MAX_DURATIONS) {
			existing.durations.shift();
		}
	} else {
		endpointMetrics.set(endpoint, {
			count: 1,
			totalDuration: durationMs,
			durations: [durationMs],
		});
	}
}

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

// --- Helper functions ---

function formatUptime(seconds: number): string {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	parts.push(`${secs}s`);

	return parts.join(" ");
}

function formatBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	return `${value.toFixed(2)} ${units[unitIndex]}`;
}

// --- Web Vitals helpers ---

type WebVitalName = "LCP" | "FID" | "CLS" | "TTFB" | "INP";

const VALID_WEB_VITAL_NAMES: WebVitalName[] = [
	"LCP",
	"FID",
	"CLS",
	"TTFB",
	"INP",
];

const PERIOD_SECONDS: Record<string, number> = {
	"1h": 3600,
	"6h": 21600,
	"24h": 86400,
	"7d": 604800,
};

const INTERVAL_SECONDS: Record<string, number> = {
	"1m": 60,
	"5m": 300,
	"15m": 900,
	"1h": 3600,
};

/**
 * Get the Redis key for a Web Vital metric
 */
function webVitalKey(name: WebVitalName): string {
	return `metrics:wv:${name}`;
}

/**
 * Compute percentile from a sorted number array
 */
function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
	return sorted[idx];
}

// --- Existing Server Metrics Routes ---

/**
 * GET /api/metrics
 * Returns comprehensive server performance metrics
 */
router.get("/", authenticate, (_req: Request, res: Response) => {
	const mem = process.memoryUsage();
	const cpu = process.cpuUsage();
	const uptimeSeconds = process.uptime();

	// Compute per-endpoint stats
	const endpoints: Record<
		string,
		{
			count: number;
			avgResponseTime: number;
			minResponseTime: number;
			maxResponseTime: number;
			p50: number;
			p95: number;
			p99: number;
		}
	> = {};

	let globalTotalDuration = 0;

	for (const [endpoint, metrics] of endpointMetrics.entries()) {
		const sorted = [...metrics.durations].sort((a, b) => a - b);
		const len = sorted.length;

		const p50 = len > 0 ? sorted[Math.floor(len * 0.5)] : 0;
		const p95 = len > 0 ? sorted[Math.floor(len * 0.95)] : 0;
		const p99 = len > 0 ? sorted[Math.min(Math.floor(len * 0.99), len - 1)] : 0;

		endpoints[endpoint] = {
			count: metrics.count,
			avgResponseTime: parseFloat(
				(metrics.totalDuration / metrics.count).toFixed(2),
			),
			minResponseTime: len > 0 ? parseFloat(sorted[0].toFixed(2)) : 0,
			maxResponseTime: len > 0 ? parseFloat(sorted[len - 1].toFixed(2)) : 0,
			p50: parseFloat(p50.toFixed(2)),
			p95: parseFloat(p95.toFixed(2)),
			p99: parseFloat(p99.toFixed(2)),
		};

		globalTotalDuration += metrics.totalDuration;
	}

	const avgResponseTime =
		totalRequestCount > 0
			? parseFloat((globalTotalDuration / totalRequestCount).toFixed(2))
			: 0;

	// Build response time distribution for charts
	const buckets = [
		{ label: "0-50ms", min: 0, max: 50 },
		{ label: "50-100ms", min: 50, max: 100 },
		{ label: "100-250ms", min: 100, max: 250 },
		{ label: "250-500ms", min: 250, max: 500 },
		{ label: "500-1000ms", min: 500, max: 1000 },
		{ label: "1000ms+", min: 1000, max: Infinity },
	];

	const responseTimeDistribution = buckets.map((bucket) => {
		let count = 0;
		for (const metrics of endpointMetrics.values()) {
			for (const duration of metrics.durations) {
				if (duration >= bucket.min && duration < bucket.max) {
					count++;
				}
			}
		}
		return { range: bucket.label, count };
	});

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
			heapUsagePercent: parseFloat(
				((mem.heapUsed / mem.heapTotal) * 100).toFixed(2),
			),
		},
		cpu: {
			userMicroseconds: cpu.user,
			systemMicroseconds: cpu.system,
			userMs: parseFloat((cpu.user / 1000).toFixed(2)),
			systemMs: parseFloat((cpu.system / 1000).toFixed(2)),
		},
		requests: {
			total: totalRequestCount,
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
router.get("/endpoints", (_req: Request, res: Response) => {
	const endpoints: Record<
		string,
		{
			count: number;
			avgResponseTime: number;
			p50: number;
			p95: number;
			p99: number;
		}
	> = {};

	for (const [endpoint, metrics] of endpointMetrics.entries()) {
		const sorted = [...metrics.durations].sort((a, b) => a - b);
		const len = sorted.length;

		endpoints[endpoint] = {
			count: metrics.count,
			avgResponseTime: parseFloat(
				(metrics.totalDuration / metrics.count).toFixed(2),
			),
			p50: len > 0 ? parseFloat(sorted[Math.floor(len * 0.5)].toFixed(2)) : 0,
			p95: len > 0 ? parseFloat(sorted[Math.floor(len * 0.95)].toFixed(2)) : 0,
			p99:
				len > 0
					? parseFloat(
							sorted[Math.min(Math.floor(len * 0.99), len - 1)].toFixed(2),
						)
					: 0,
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
	try {
		const { name, value, path, timestamp } = req.body;

		// Validate required fields
		if (!name || !VALID_WEB_VITAL_NAMES.includes(name)) {
			return validationError(res, {
				field: "name",
				issue: `Invalid metric name. Must be one of: ${VALID_WEB_VITAL_NAMES.join(", ")}`,
				context: { value: name },
			});
		}

		if (typeof value !== "number" || value < 0) {
			return validationError(res, {
				field: "value",
				issue: "Value must be a non-negative number",
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

		const ts = timestamp || Date.now();
		const key = webVitalKey(name as WebVitalName);
		const metricData = JSON.stringify({ value, path, timestamp: ts });

		const client = await redis();
		await client.zAdd(key, { score: ts, value: metricData });

		// Trim entries older than 7 days to prevent unbounded growth
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		await client.zRemRangeByScore(key, "-inf", sevenDaysAgo);

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
router.get("/web-vitals", async (req: Request, res: Response) => {
	try {
		const period = (req.query.period as string) || "24h";
		const periodSeconds = PERIOD_SECONDS[period];

		if (!periodSeconds) {
			return validationError(res, {
				field: "period",
				issue: "Period must be one of: 1h, 6h, 24h, 7d",
				context: { value: period },
			});
		}

		const now = Date.now();
		const minScore = now - periodSeconds * 1000;

		const client = await redis();
		const result: Record<
			string,
			{ avg: number; p50: number; p95: number; count: number }
		> = {};

		for (const name of VALID_WEB_VITAL_NAMES) {
			const key = webVitalKey(name);
			const entries = await client.zRangeByScore(key, minScore, now);

			if (entries.length === 0) {
				result[name.toLowerCase()] = { avg: 0, p50: 0, p95: 0, count: 0 };
				continue;
			}

			const values = entries
				.map((entry) => {
					try {
						return JSON.parse(entry);
					} catch {
						return null;
					}
				})
				.filter(
					(v): v is { value: number; path: string; timestamp: number } =>
						v !== null,
				)
				.map((v) => v.value)
				.sort((a, b) => a - b);

			const count = values.length;
			const avg = count > 0 ? values.reduce((sum, v) => sum + v, 0) / count : 0;

			result[name.toLowerCase()] = {
				avg: parseFloat(avg.toFixed(2)),
				p50: parseFloat(percentile(values, 0.5).toFixed(2)),
				p95: parseFloat(percentile(values, 0.95).toFixed(2)),
				count,
			};
		}

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
router.get("/web-vitals/history", async (req: Request, res: Response) => {
	try {
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

		const now = Date.now();
		const minScore = now - periodSeconds * 1000;

		const client = await redis();
		const key = webVitalKey(metric as WebVitalName);
		const entries = await client.zRangeByScore(key, minScore, now);

		// Parse all entries
		const parsed = entries
			.map((entry) => {
				try {
					return JSON.parse(entry) as {
						value: number;
						path: string;
						timestamp: number;
					};
				} catch {
					return null;
				}
			})
			.filter(
				(v): v is { value: number; path: string; timestamp: number } =>
					v !== null,
			);

		// Bucket entries into intervals
		const buckets: { timestamp: number; values: number[] }[] = [];
		const bucketStart = minScore - (minScore % (intervalSeconds * 1000));

		for (let t = bucketStart; t <= now; t += intervalSeconds * 1000) {
			buckets.push({ timestamp: t, values: [] });
		}

		for (const entry of parsed) {
			const bucketIndex = Math.floor(
				(entry.timestamp - bucketStart) / (intervalSeconds * 1000),
			);
			if (bucketIndex >= 0 && bucketIndex < buckets.length) {
				buckets[bucketIndex].values.push(entry.value);
			}
		}

		const history = buckets
			.filter((b) => b.values.length > 0)
			.map((b) => {
				const sorted = [...b.values].sort((a, c) => a - c);
				const count = sorted.length;
				const avg = sorted.reduce((sum, v) => sum + v, 0) / count;
				return {
					timestamp: b.timestamp,
					avg: parseFloat(avg.toFixed(2)),
					p95: parseFloat(percentile(sorted, 0.95).toFixed(2)),
					count,
				};
			});

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
router.get("/api-latency", (_req: Request, res: Response) => {
	const endpoints: Record<
		string,
		{
			avg: number;
			p50: number;
			p95: number;
			p99: number;
			count: number;
		}
	> = {};

	let globalDurations: number[] = [];

	for (const [endpoint, metrics] of endpointMetrics.entries()) {
		const sorted = [...metrics.durations].sort((a, b) => a - b);
		const len = sorted.length;

		endpoints[endpoint] = {
			avg:
				len > 0
					? parseFloat((metrics.totalDuration / metrics.count).toFixed(2))
					: 0,
			p50: len > 0 ? parseFloat(sorted[Math.floor(len * 0.5)].toFixed(2)) : 0,
			p95: len > 0 ? parseFloat(sorted[Math.floor(len * 0.95)].toFixed(2)) : 0,
			p99:
				len > 0
					? parseFloat(
							sorted[Math.min(Math.floor(len * 0.99), len - 1)].toFixed(2),
						)
					: 0,
			count: metrics.count,
		};

		globalDurations = globalDurations.concat(sorted);
	}

	globalDurations.sort((a, b) => a - b);

	const overallAvg =
		globalDurations.length > 0
			? parseFloat(
					(
						globalDurations.reduce((s, v) => s + v, 0) / globalDurations.length
					).toFixed(2),
				)
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
router.get("/summary", async (_req: Request, res: Response) => {
	try {
		const uptimeSeconds = process.uptime();

		// Get web vitals from Redis (last 24h)
		const now = Date.now();
		const minScore = now - 24 * 60 * 60 * 1000;
		const client = await redis();

		const webVitals: Record<string, { avg: number; count: number }> = {};

		for (const name of ["LCP", "FID", "CLS"] as const) {
			const key = webVitalKey(name);
			const entries = await client.zRangeByScore(key, minScore, now);

			const values = entries
				.map((entry) => {
					try {
						return (JSON.parse(entry) as { value: number }).value;
					} catch {
						return null;
					}
				})
				.filter((v): v is number => v !== null);

			const count = values.length;
			const avg = count > 0 ? values.reduce((s, v) => s + v, 0) / count : 0;
			webVitals[name.toLowerCase()] = {
				avg: parseFloat(avg.toFixed(2)),
				count,
			};
		}

		// Compute API latency from in-memory metrics
		let globalDurations: number[] = [];
		let errorCount = 0;

		for (const metrics of endpointMetrics.values()) {
			globalDurations = globalDurations.concat(metrics.durations);
		}

		// Count error-status requests from the stored durations as a rough proxy
		// (We don't track status codes explicitly, so we estimate from latency spikes)
		// For a real error rate, we would need a separate counter
		globalDurations.sort((a, b) => a - b);

		const apiLatencyAvg =
			globalDurations.length > 0
				? parseFloat(
						(
							globalDurations.reduce((s, v) => s + v, 0) /
							globalDurations.length
						).toFixed(2),
					)
				: 0;

		const apiLatencyP95 = parseFloat(
			percentile(globalDurations, 0.95).toFixed(2),
		);

		// Estimate active users from Redis session keys (best effort)
		let activeUsers = 0;
		try {
			const sessionKeys = await client.keys("sess:*");
			activeUsers = sessionKeys.length;
		} catch {
			// Session keys not available or Redis error - fall back to 0
		}

		// Calculate error rate: count endpoints with p99 > 1s as a heuristic
		// This is a rough approximation; a production system would track HTTP errors explicitly
		for (const metrics of endpointMetrics.values()) {
			for (const d of metrics.durations) {
				if (d > 5000) errorCount++; // Requests over 5s are likely errors/timeouts
			}
		}
		const errorRate =
			totalRequestCount > 0
				? parseFloat(((errorCount / totalRequestCount) * 100).toFixed(2))
				: 0;

		return success(res, {
			webVitals: {
				lcp: webVitals.lcp?.avg ?? 0,
				fid: webVitals.fid?.avg ?? 0,
				cls: webVitals.cls?.avg ?? 0,
			},
			apiLatency: {
				avg: apiLatencyAvg,
				p95: apiLatencyP95,
			},
			errorRate,
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
