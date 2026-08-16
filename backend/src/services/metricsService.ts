/**
 * Performance metrics service.
 *
 * Owns the in-memory endpoint-metrics store (process-wide singleton) and the
 * Redis-backed Web Vitals persistence/aggregation. Routes in
 * `routes/metrics.ts` own the HTTP boundary (auth, response shaping, the
 * `res.on("finish")` timing hook); this service owns the data structures and
 * the computation.
 *
 * The endpoint store is a module-level singleton — there is exactly one per
 * Node process, which matches the semantics of the previous in-route Map.
 */

import { logger } from "@/lib";
import { MS_PER_DAY, MS_PER_WEEK } from "@/lib/constants";
import { redis } from "@/lib/redis";

// --- In-memory endpoint metrics store (process singleton) ---

interface EndpointMetrics {
	count: number;
	totalDuration: number;
	durations: number[];
	errorCount: number;
}

/** Keep only the last N durations per endpoint to bound memory. */
const MAX_DURATIONS = 100;

const endpointMetrics = new Map<string, EndpointMetrics>();
let totalRequestCount = 0;
let totalErrorCount = 0;

/** HTTP status codes >= 400 count as errors for errorRate. */
export function isErrorStatus(statusCode: number): boolean {
	return statusCode >= 400;
}

/**
 * Record a request's duration (+ final status code). Called from the metrics
 * route's `res.on("finish")` hook. Mutates the process-wide store.
 */
export function recordRequest(endpoint: string, durationMs: number, statusCode?: number): void {
	totalRequestCount++;
	const isError = statusCode !== undefined && isErrorStatus(statusCode);
	if (isError) totalErrorCount++;

	const existing = endpointMetrics.get(endpoint);
	if (existing) {
		existing.count++;
		existing.totalDuration += durationMs;
		if (isError) existing.errorCount++;
		existing.durations.push(durationMs);
		if (existing.durations.length > MAX_DURATIONS) {
			existing.durations.shift();
		}
	} else {
		endpointMetrics.set(endpoint, {
			count: 1,
			totalDuration: durationMs,
			durations: [durationMs],
			errorCount: isError ? 1 : 0,
		});
	}
}

/** Total number of requests recorded this process lifetime. */
export function getTotalRequestCount(): number {
	return totalRequestCount;
}

/** Total number of error (>=400) responses recorded this process lifetime. */
export function getTotalErrorCount(): number {
	return totalErrorCount;
}

// --- Formatting helpers ---

export function formatUptime(seconds: number): string {
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

export function formatBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	return `${value.toFixed(2)} ${units[unitIndex]}`;
}

// --- Shared stats helpers ---

/**
 * Compute a percentile from a *sorted* ascending number array.
 */
export function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
	return sorted[idx];
}

interface EndpointPercentiles {
	count: number;
	avgResponseTime: number;
	minResponseTime: number;
	maxResponseTime: number;
	p50: number;
	p95: number;
	p99: number;
}

/**
 * Snapshot every tracked endpoint with full percentile stats.
 * Used by GET /api/metrics (the comprehensive dashboard payload).
 */
export function getEndpointSnapshot(): Record<string, EndpointPercentiles> {
	const endpoints: Record<string, EndpointPercentiles> = {};

	for (const [endpoint, metrics] of endpointMetrics.entries()) {
		const sorted = [...metrics.durations].sort((a, b) => a - b);
		const len = sorted.length;

		endpoints[endpoint] = {
			count: metrics.count,
			avgResponseTime: parseFloat((metrics.totalDuration / metrics.count).toFixed(2)),
			minResponseTime: len > 0 ? parseFloat(sorted[0].toFixed(2)) : 0,
			maxResponseTime: len > 0 ? parseFloat(sorted[len - 1].toFixed(2)) : 0,
			p50: len > 0 ? parseFloat(sorted[Math.floor(len * 0.5)].toFixed(2)) : 0,
			p95: len > 0 ? parseFloat(sorted[Math.floor(len * 0.95)].toFixed(2)) : 0,
			p99: len > 0 ? parseFloat(sorted[Math.min(Math.floor(len * 0.99), len - 1)].toFixed(2)) : 0,
		};
	}

	return endpoints;
}

/**
 * Build a histogram of response-time buckets for the dashboard chart.
 */
export function getResponseTimeDistribution(): { range: string; count: number }[] {
	const buckets = [
		{ label: "0-50ms", min: 0, max: 50 },
		{ label: "50-100ms", min: 50, max: 100 },
		{ label: "100-250ms", min: 100, max: 250 },
		{ label: "250-500ms", min: 250, max: 500 },
		{ label: "500-1000ms", min: 500, max: 1000 },
		{ label: "1000ms+", min: 1000, max: Infinity },
	];

	return buckets.map((bucket) => {
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
}

/**
 * Flatten all per-endpoint durations into one global sorted array.
 * Used by api-latency and summary endpoints for process-wide percentiles.
 */
export function getGlobalDurationsSorted(): number[] {
	let globalDurations: number[] = [];
	for (const metrics of endpointMetrics.values()) {
		globalDurations = globalDurations.concat(metrics.durations);
	}
	globalDurations.sort((a, b) => a - b);
	return globalDurations;
}

// --- Web Vitals (Redis-backed) ---

export type WebVitalName = "LCP" | "FID" | "CLS" | "TTFB" | "INP";

export const VALID_WEB_VITAL_NAMES: WebVitalName[] = ["LCP", "FID", "CLS", "TTFB", "INP"];

export const PERIOD_SECONDS: Record<string, number> = {
	"1h": 3600,
	"6h": 21600,
	"24h": 86400,
	"7d": 604800,
};

export const INTERVAL_SECONDS: Record<string, number> = {
	"1m": 60,
	"5m": 300,
	"15m": 900,
	"1h": 3600,
};

function webVitalKey(name: WebVitalName): string {
	return `metrics:wv:${name}`;
}

interface StoredWebVital {
	value: number;
	path: string;
	timestamp: number;
}

/**
 * Persist a single Web Vital sample. Trims entries older than 7 days.
 */
export async function storeWebVital(
	name: WebVitalName,
	value: number,
	path: string,
	timestamp: number,
): Promise<void> {
	const key = webVitalKey(name);
	const metricData = JSON.stringify({ value, path, timestamp });

	const client = await redis();
	await client.zAdd(key, { score: timestamp, value: metricData });
	// Trim entries older than 7 days to prevent unbounded growth
	const sevenDaysAgo = Date.now() - MS_PER_WEEK;
	await client.zRemRangeByScore(key, "-inf", sevenDaysAgo);
}

/**
 * Aggregate Web Vitals over a period. Returns { avg, p50, p95, count } per
 * metric name (lower-cased key).
 */
export async function getWebVitalsSummary(
	periodSeconds: number,
): Promise<Record<string, { avg: number; p50: number; p95: number; count: number }>> {
	const now = Date.now();
	const minScore = now - periodSeconds * 1000;
	const client = await redis();

	const result: Record<string, { avg: number; p50: number; p95: number; count: number }> = {};

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
					return JSON.parse(entry) as StoredWebVital;
				} catch (err) {
					logger.warn("[METRICS] Failed to parse web vital entry", err);
					return null;
				}
			})
			.filter((v): v is StoredWebVital => v !== null)
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

	return result;
}

/**
 * Time-series history for a single Web Vital metric, bucketed by interval.
 */
export async function getWebVitalsHistory(
	metric: WebVitalName,
	periodSeconds: number,
	intervalSeconds: number,
): Promise<{ timestamp: number; avg: number; p95: number; count: number }[]> {
	const now = Date.now();
	const minScore = now - periodSeconds * 1000;

	const client = await redis();
	const key = webVitalKey(metric);
	const entries = await client.zRangeByScore(key, minScore, now);

	const parsed = entries
		.map((entry) => {
			try {
				return JSON.parse(entry) as StoredWebVital;
			} catch (err) {
				logger.warn("[METRICS] Failed to parse web vital history entry", err);
				return null;
			}
		})
		.filter((v): v is StoredWebVital => v !== null);

	// Bucket entries into intervals
	const buckets: { timestamp: number; values: number[] }[] = [];
	const bucketStart = minScore - (minScore % (intervalSeconds * 1000));

	for (let t = bucketStart; t <= now; t += intervalSeconds * 1000) {
		buckets.push({ timestamp: t, values: [] });
	}

	for (const entry of parsed) {
		const bucketIndex = Math.floor((entry.timestamp - bucketStart) / (intervalSeconds * 1000));
		if (bucketIndex >= 0 && bucketIndex < buckets.length) {
			buckets[bucketIndex].values.push(entry.value);
		}
	}

	return buckets
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
}

/**
 * Active-user estimate from Redis session keys (best effort).
 */
export async function getActiveUserCount(): Promise<number> {
	try {
		const client = await redis();
		// SCAN, not KEYS: KEYS blocks the single-threaded Redis server while
		// traversing the whole keyspace — a latency spike on every metrics
		// dashboard load as the session count grows (round-106).
		let count = 0;
		let cursor = 0;
		do {
			const { cursor: next, keys } = await client.scan(cursor, {
				MATCH: "sess:*",
				COUNT: 200,
			});
			cursor = next;
			count += keys.length;
		} while (cursor !== 0);
		return count;
	} catch (err) {
		logger.warn("[METRICS] Failed to count active user sessions", err);
		return 0;
	}
}

/**
 * LCP/FID/CLS averages over the last 24h, for the dashboard summary card.
 */
export async function getSummaryWebVitals(): Promise<{
	lcp: number;
	fid: number;
	cls: number;
}> {
	const now = Date.now();
	const minScore = now - MS_PER_DAY;
	const client = await redis();

	const webVitals: Record<string, { avg: number; count: number }> = {};

	for (const name of ["LCP", "FID", "CLS"] as const) {
		const key = webVitalKey(name);
		const entries = await client.zRangeByScore(key, minScore, now);

		const values = entries
			.map((entry) => {
				try {
					return (JSON.parse(entry) as { value: number }).value;
				} catch (err) {
					logger.warn("[METRICS] Failed to parse web vital summary entry", err);
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

	return {
		lcp: webVitals.lcp?.avg ?? 0,
		fid: webVitals.fid?.avg ?? 0,
		cls: webVitals.cls?.avg ?? 0,
	};
}
