/**
 * IoTDB test helpers
 *
 * Provides utility functions for setting up and tearing down
 * test time series data in IoTDB.
 */

export interface TimeSeriesTestData {
	name: string;
	dataType: "INT32" | "INT64" | "FLOAT" | "DOUBLE" | "BOOLEAN" | "TEXT";
	encoding: "PLAIN" | "RLE" | "DIFF" | "TS_2DIFF" | "GORILLA";
	compression?: "SNAPPY" | "LZ4" | "GZIP" | "UNCOMPRESSED";
}

/**
 * Generates a unique test time series name
 *
 * @param prefix - Prefix for the time series (default: 'root.test')
 * @returns Unique time series name with timestamp
 *
 * @example
 * ```typescript
 * const timeseries = generateTestTimeseries('root.test.performance');
 * // Returns: 'root.test.performance_1648123456789'
 * ```
 */
export function generateTestTimeseries(prefix = "root.test"): string {
	const timestamp = Date.now();
	const random = Math.floor(Math.random() * 1000);
	return `${prefix}_${timestamp}_${random}`;
}

/**
 * Creates test time series data
 *
 * @param overrides - Partial data to override defaults
 * @returns Test time series data object
 *
 * @example
 * ```typescript
 * const timeseries = createTestTimeseriesData({
 *   name: 'root.sg.device1.temperature',
 *   dataType: 'DOUBLE'
 * });
 * ```
 */
export function createTestTimeseriesData(
	overrides: Partial<TimeSeriesTestData> = {},
): TimeSeriesTestData {
	return {
		name: generateTestTimeseries(),
		dataType: "DOUBLE",
		encoding: "GORILLA",
		compression: "SNAPPY",
		...overrides,
	};
}

/**
 * Creates multiple test time series
 *
 * @param count - Number of time series to create
 * @param prefix - Prefix for all time series
 * @returns Array of test time series data
 *
 * @example
 * ```typescript
 * const timeseries = createTestTimeseriesBatch(5, 'root.test.metrics');
 * ```
 */
export function createTestTimeseriesBatch(
	count: number,
	prefix = "root.test",
): TimeSeriesTestData[] {
	const series: TimeSeriesTestData[] = [];
	for (let i = 0; i < count; i++) {
		series.push(
			createTestTimeseriesData({
				name: generateTestTimeseries(`${prefix}.${i}`),
			}),
		);
	}
	return series;
}

/**
 * Generates test data points for a time series
 *
 * @param count - Number of data points to generate
 * @param startTime - Start timestamp (default: 1 hour ago)
 * @param intervalMs - Interval between points in milliseconds (default: 60000 = 1 minute)
 * @returns Array of timestamp-value pairs
 *
 * @example
 * ```typescript
 * const dataPoints = generateTestDataPoints(100);
 * // Returns 100 points, 1 minute apart, starting 1 hour ago
 * ```
 */
export function generateTestDataPoints(
	count: number,
	startTime?: number,
	intervalMs = 60000,
): Array<{ timestamp: number; value: number }> {
	const start = startTime || Date.now() - 3600000; // 1 hour ago
	const points: Array<{ timestamp: number; value: number }> = [];

	for (let i = 0; i < count; i++) {
		points.push({
			timestamp: start + i * intervalMs,
			value: Math.random() * 100,
		});
	}

	return points;
}

/**
 * Generates test data points with trend
 *
 * @param count - Number of data points
 * @param trend - 'up', 'down', or 'random' (default: 'random')
 * @param startTime - Start timestamp
 * @param intervalMs - Interval between points
 * @returns Array of timestamp-value pairs with trend
 *
 * @example
 * ```typescript
 * const uptrend = generateTestDataPointsWithTrend(100, 'up');
 * const downtrend = generateTestDataPointsWithTrend(100, 'down');
 * ```
 */
export function generateTestDataPointsWithTrend(
	count: number,
	trend: "up" | "down" | "random" = "random",
	startTime?: number,
	intervalMs = 60000,
): Array<{ timestamp: number; value: number }> {
	const start = startTime || Date.now() - 3600000;
	const points: Array<{ timestamp: number; value: number }> = [];
	let value = 50; // Starting value

	for (let i = 0; i < count; i++) {
		// Add trend and random noise
		const trendDelta = trend === "up" ? 0.5 : trend === "down" ? -0.5 : 0;
		const noise = (Math.random() - 0.5) * 2; // -1 to 1
		value = Math.max(0, Math.min(100, value + trendDelta + noise)); // Clamp to 0-100

		points.push({
			timestamp: start + i * intervalMs,
			value,
		});
	}

	return points;
}

/**
 * Generates anomaly test data
 *
 * @param normalCount - Number of normal points
 * @param anomalyCount - Number of anomaly points
 * @param anomalyValue - Value for anomalies (default: 200)
 * @returns Array of timestamp-value pairs with anomalies
 *
 * @example
 * ```typescript
 * const data = generateAnomalyTestData(100, 5, 200);
 * // Returns 100 normal points + 5 anomalies with value 200
 * ```
 */
export function generateAnomalyTestData(
	normalCount: number,
	anomalyCount: number,
	anomalyValue = 200,
): Array<{ timestamp: number; value: number; isAnomaly: boolean }> {
	const points = generateTestDataPoints(normalCount);
	const anomalies: Array<{
		timestamp: number;
		value: number;
		isAnomaly: boolean;
	}> = [];

	// Add anomalies
	for (let i = 0; i < anomalyCount; i++) {
		const lastPoint = points[points.length - 1];
		anomalies.push({
			timestamp: lastPoint.timestamp + 60000,
			value: anomalyValue + (Math.random() - 0.5) * 10, // Anomaly with slight noise
			isAnomaly: true,
		});
	}

	return [...points.map((p) => ({ ...p, isAnomaly: false })), ...anomalies];
}

/**
 * Formats a list of time series for IoTDB queries
 *
 * @param timeseries - Array of time series names
 * @returns Comma-separated string for queries
 *
 * @example
 * ```typescript
 * const paths = formatTimeseriesList(['root.sg1.d1.temp', 'root.sg1.d2.temp']);
 * // Returns: 'root.sg1.d1.temp,root.sg1.d2.temp'
 * ```
 */
export function formatTimeseriesList(timeseries: string[]): string {
	return timeseries.join(",");
}

/**
 * Extracts the device name from a time series path
 *
 * @param timeseries - Full time series path
 * @returns Device name (second-to-last segment)
 *
 * @example
 * ```typescript
 * const device = extractDeviceName('root.sg.device1.temperature');
 * // Returns: 'device1'
 * ```
 */
export function extractDeviceName(timeseries: string): string {
	const parts = timeseries.split(".");
	return parts.length > 1 ? parts[parts.length - 2] : timeseries;
}
