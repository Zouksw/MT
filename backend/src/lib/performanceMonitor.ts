/**
 * Performance Monitoring and Alerting Module
 *
 * Provides comprehensive performance monitoring with:
 * - Request/response time tracking
 * - Database query performance
 * - Memory and CPU usage monitoring
 * - Custom metric collection
 * - Alert thresholds and notifications
 * - Automatic cleanup to prevent memory leaks
 */

import { logger } from "./logger";
import { captureMessage } from "./sentry";

/**
 * Performance metric data point
 */
export interface MetricData {
	name: string;
	value: number;
	unit: "ms" | "bytes" | "count" | "percent";
	tags?: Record<string, string>;
	timestamp: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
	metricName: string;
	threshold: number;
	comparison: "gt" | "lt" | "eq";
	windowMs?: number;
	notificationFn?: (alert: AlertInfo) => void;
}

/**
 * Alert information
 */
export interface AlertInfo {
	metricName: string;
	currentValue: number;
	threshold: number;
	timestamp: number;
	message: string;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
	requestCount: number;
	averageResponseTime: number;
	p50ResponseTime: number;
	p95ResponseTime: number;
	p99ResponseTime: number;
	errorRate: number;
	memoryUsage: number;
	cpuUsage: number;
}

/**
 * Request timing data
 */
interface RequestTiming {
	startTime: number;
	endTime: number;
	duration: number;
	path: string;
	method: string;
	statusCode: number;
	success: boolean;
}

/**
 * Performance Monitor Class
 *
 * Includes automatic cleanup to prevent memory leaks:
 * - LRU eviction for metrics
 * - Size limits per metric
 * - Periodic global cleanup
 */
export class PerformanceMonitor {
	private metrics: Map<string, MetricData[]> = new Map();
	private requestTimings: RequestTiming[] = [];
	private alertConfigs: Map<string, AlertConfig> = new Map();
	private isRunning = false;

	// Cleanup configuration
	private metricsRetentionMs = 3600000; // 1 hour
	private maxRequestTimings = 10000; // Max 10k request timings
	private maxMetricsPerName = 1000; // Max 1000 metrics per name
	private maxMetricNames = 100; // Max 100 different metric names
	private cleanupIntervalMs = 300000; // Cleanup every 5 minutes
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		this.setupDefaultAlerts();
	}

	/**
	 * Setup default alert configurations
	 */
	private setupDefaultAlerts(): void {
		this.addAlert({
			metricName: "response_time",
			threshold: Number(process.env.ALERT_RESPONSE_TIME_MS) || 5000,
			comparison: "gt",
			windowMs: 60000,
			notificationFn: (alert) => this.sendAlert(alert),
		});

		this.addAlert({
			metricName: "error_rate",
			threshold: Number(process.env.ALERT_ERROR_RATE_PCT) || 5,
			comparison: "gt",
			windowMs: 60000,
			notificationFn: (alert) => this.sendAlert(alert),
		});

		this.addAlert({
			metricName: "memory_usage",
			threshold: Number(process.env.ALERT_MEMORY_PCT) || 90,
			comparison: "gt",
			notificationFn: (alert) => this.sendAlert(alert),
		});

		this.addAlert({
			metricName: "cpu_usage",
			threshold: Number(process.env.ALERT_CPU_PCT) || 90,
			comparison: "gt",
			notificationFn: (alert) => this.sendAlert(alert),
		});
	}

	/**
	 * Add custom alert configuration
	 */
	addAlert(config: AlertConfig): void {
		this.alertConfigs.set(config.metricName, config);
	}

	/**
	 * Record a metric value with LRU eviction
	 */
	recordMetric(
		name: string,
		value: number,
		unit: MetricData["unit"] = "ms",
		tags?: Record<string, string>,
	): void {
		const metric: MetricData = {
			name,
			value,
			unit,
			tags,
			timestamp: Date.now(),
		};

		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);

			// Check total number of metric names
			if (this.metrics.size > this.maxMetricNames) {
				this.evictOldestMetricName();
			}
		}

		const metrics = this.metrics.get(name)!;
		metrics.push(metric);

		// Enforce per-metric size limit (LRU eviction)
		if (metrics.length > this.maxMetricsPerName) {
			// Remove oldest metric
			metrics.shift();
		}

		// Cleanup old metrics
		this.cleanupMetrics(name);

		// Check alerts
		this.checkAlerts(name, value);
	}

	/**
	 * Evict the oldest metric name to free memory
	 */
	private evictOldestMetricName(): void {
		let oldestName: string | null = null;
		let oldestTime = Infinity;

		for (const [name, metrics] of this.metrics.entries()) {
			if (metrics.length > 0) {
				const oldestMetric = metrics[0];
				if (oldestMetric && oldestMetric.timestamp < oldestTime) {
					oldestTime = oldestMetric.timestamp;
					oldestName = name;
				}
			}
		}

		if (oldestName) {
			this.metrics.delete(oldestName);
			logger.debug(`[PERF] Evicted metric: ${oldestName}`);
		}
	}

	/**
	 * Record HTTP request timing
	 */
	recordRequest(req: { path: string; method: string }, res: { statusCode: number }, duration: number): void {
		const timing: RequestTiming = {
			startTime: Date.now() - duration,
			endTime: Date.now(),
			duration,
			path: req.path,
			method: req.method,
			statusCode: res.statusCode,
			success: res.statusCode >= 200 && res.statusCode < 400,
		};

		this.requestTimings.push(timing);

		// Enforce size limit with LRU eviction
		if (this.requestTimings.length > this.maxRequestTimings) {
			// Remove oldest 10% of timings
			const removeCount = Math.floor(this.maxRequestTimings * 0.1);
			this.requestTimings = this.requestTimings.slice(removeCount);
		}

		// Record response time metric
		this.recordMetric("response_time", duration, "ms", {
			path: req.path,
			method: req.method,
			statusCode: res.statusCode.toString(),
		});

		// Record error count if not successful
		if (!timing.success) {
			this.recordMetric("error_count", 1, "count", {
				path: req.path,
				method: req.method,
				statusCode: res.statusCode.toString(),
			});
		}
	}

	/**
	 * Get percentile value from array of numbers
	 */
	private getPercentile(values: number[], percentile: number): number {
		if (values.length === 0) return 0;

		const sorted = values.slice().sort((a, b) => a - b);
		const index = Math.ceil((percentile / 100) * sorted.length) - 1;
		return sorted[index] || 0;
	}

	/**
	 * Calculate performance statistics
	 */
	getStats(): PerformanceStats {
		const durations = this.requestTimings.map((t) => t.duration);
		const errorCount = this.requestTimings.filter((t) => !t.success).length;
		const totalRequests = this.requestTimings.length;

		return {
			requestCount: totalRequests,
			averageResponseTime:
				durations.length > 0
					? durations.reduce((a, b) => a + b, 0) / durations.length
					: 0,
			p50ResponseTime: this.getPercentile(durations, 50),
			p95ResponseTime: this.getPercentile(durations, 95),
			p99ResponseTime: this.getPercentile(durations, 99),
			errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
			memoryUsage:
				(process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) *
				100,
			cpuUsage: this.getCpuUsage(),
		};
	}

	/**
	 * Get CPU usage (approximation)
	 */
	private getCpuUsage(): number {
		const usage = process.cpuUsage();
		// Simple approximation - in production use proper CPU monitoring
		return Math.min(usage.user / 1000000, 100);
	}

	/**
	 * Cleanup old metrics for a specific name
	 */
	private cleanupMetrics(metricName: string): void {
		const metrics = this.metrics.get(metricName);
		if (!metrics) return;

		const cutoff = Date.now() - this.metricsRetentionMs;

		// Filter in place to avoid creating new arrays
		let writeIndex = 0;
		for (let i = 0; i < metrics.length; i++) {
			if (metrics[i].timestamp > cutoff) {
				if (writeIndex !== i) {
					metrics[writeIndex] = metrics[i];
				}
				writeIndex++;
			}
		}

		// Truncate array
		metrics.length = writeIndex;
	}

	/**
	 * Global cleanup to prevent memory leaks
	 */
	private performGlobalCleanup(): void {
		const _now = Date.now();
		let totalMetrics = 0;
		let totalEvicted = 0;

		for (const [name, metrics] of this.metrics.entries()) {
			const _beforeLength = metrics.length;

			// Remove old metrics
			this.cleanupMetrics(name);

			// If still too many, remove oldest
			if (metrics.length > this.maxMetricsPerName) {
				const removeCount = metrics.length - this.maxMetricsPerName;
				metrics.splice(0, removeCount);
				totalEvicted += removeCount;
			}

			totalMetrics += metrics.length;
		}

		// Cleanup request timings
		if (this.requestTimings.length > this.maxRequestTimings) {
			const removeCount = this.requestTimings.length - this.maxRequestTimings;
			this.requestTimings = this.requestTimings.slice(removeCount);
			totalEvicted += removeCount;
		}

		logger.debug(
			`[PERF] Cleanup: ${totalMetrics} metrics, ${totalEvicted} evicted`,
		);
	}

	/**
	 * Check if any alerts should be triggered
	 */
	private checkAlerts(metricName: string, value: number): void {
		const config = this.alertConfigs.get(metricName);
		if (!config) return;

		let shouldAlert = false;
		switch (config.comparison) {
			case "gt":
				shouldAlert = value > config.threshold;
				break;
			case "lt":
				shouldAlert = value < config.threshold;
				break;
			case "eq":
				shouldAlert = value === config.threshold;
				break;
		}

		if (shouldAlert && config.notificationFn) {
			const alert: AlertInfo = {
				metricName,
				currentValue: value,
				threshold: config.threshold,
				timestamp: Date.now(),
				message: `Alert: ${metricName} is ${value} (threshold: ${config.threshold})`,
			};

			config.notificationFn(alert);
		}
	}

	/**
	 * Send alert notification
	 */
	private sendAlert(alert: AlertInfo): void {
		// Log alert
		logger.warn(alert.message);

		// Send to Sentry
		captureMessage(alert.message, "warning");

		// TODO: Add other notification channels (Slack, email, PagerDuty, etc.)
	}

	/**
	 * Get metrics for a specific name
	 */
	getMetrics(name: string): MetricData[] {
		return this.metrics.get(name) || [];
	}

	/**
	 * Get all metric names
	 */
	getMetricNames(): string[] {
		return Array.from(this.metrics.keys());
	}

	/**
	 * Get memory usage statistics
	 */
	getMemoryUsage(): {
		metricsCount: number;
		requestTimingsCount: number;
		totalMetrics: number;
	} {
		let totalMetrics = 0;
		for (const metrics of this.metrics.values()) {
			totalMetrics += metrics.length;
		}

		return {
			metricsCount: this.metrics.size,
			requestTimingsCount: this.requestTimings.length,
			totalMetrics,
		};
	}

	/**
	 * Clear all metrics
	 */
	clearMetrics(): void {
		this.metrics.clear();
		this.requestTimings = [];
	}

	/**
	 * Start monitoring with periodic cleanup
	 */
	start(): void {
		if (this.isRunning) return;

		this.isRunning = true;

		// Start periodic monitoring
		this.monitoringInterval = setInterval(() => {
			this.collectSystemMetrics();
		}, 60000); // Every minute

		// Start periodic cleanup
		this.cleanupInterval = setInterval(() => {
			this.performGlobalCleanup();
		}, this.cleanupIntervalMs);

		logger.info("Performance monitoring started with periodic cleanup");
	}

	/**
	 * Stop monitoring
	 */
	stop(): void {
		if (!this.isRunning) return;

		this.isRunning = false;

		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}

		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		logger.info("Performance monitoring stopped");
	}

	/**
	 * Collect system metrics
	 */
	private collectSystemMetrics(): void {
		const memoryUsage = process.memoryUsage();

		// Memory metrics
		this.recordMetric(
			"memory_usage",
			(memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
			"percent",
		);
		this.recordMetric("memory_heap_used", memoryUsage.heapUsed, "bytes");
		this.recordMetric("memory_heap_total", memoryUsage.heapTotal, "bytes");
		this.recordMetric("memory_rss", memoryUsage.rss, "bytes");

		// CPU metrics
		this.recordMetric("cpu_usage", this.getCpuUsage(), "percent");

		// Event loop lag
		const start = Date.now();
		setImmediate(() => {
			const lag = Date.now() - start;
			this.recordMetric("event_loop_lag", lag, "ms");
		});

		// Error rate
		const stats = this.getStats();
		this.recordMetric("error_rate", stats.errorRate, "percent");

		// Memory usage stats for monitoring
		const memStats = this.getMemoryUsage();
		this.recordMetric("perf_metrics_count", memStats.metricsCount, "count");
		this.recordMetric("perf_total_metrics", memStats.totalMetrics, "count");
	}

	private monitoringInterval: NodeJS.Timeout | null = null;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let performanceMonitorInstance: PerformanceMonitor | null = null;

/**
 * Get performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
	if (!performanceMonitorInstance) {
		performanceMonitorInstance = new PerformanceMonitor();
	}
	return performanceMonitorInstance;
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(): void {
	const monitor = getPerformanceMonitor();
	monitor.start();
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Express middleware to track request performance
 */
export function performanceMiddleware(req: { path: string; method: string }, res: { statusCode: number; on(event: string, callback: () => void): void }, next: () => void) {
	const startTime = Date.now();

	// Capture response finish
	res.on("finish", () => {
		const duration = Date.now() - startTime;
		const monitor = getPerformanceMonitor();
		monitor.recordRequest(req, res, duration);
	});

	next();
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Record a custom metric
 */
export function recordMetric(
	name: string,
	value: number,
	unit?: MetricData["unit"],
	tags?: Record<string, string>,
): void {
	const monitor = getPerformanceMonitor();
	monitor.recordMetric(name, value, unit, tags);
}

/**
 * Get current performance stats
 */
export function getPerformanceStats(): PerformanceStats {
	const monitor = getPerformanceMonitor();
	return monitor.getStats();
}

/**
 * Add custom alert
 */
export function addPerformanceAlert(config: AlertConfig): void {
	const monitor = getPerformanceMonitor();
	monitor.addAlert(config);
}
