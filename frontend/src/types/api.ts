/**
 * API Type Definitions
 *
 * Standardized types for API responses and domain models.
 * These types are used across the frontend to ensure type safety.
 *
 * Note: only types actually imported by app code live here. Many call sites
 * define their own local interfaces (e.g. useDashboardStats redeclares
 * DashboardStats, apikeys/page redeclares ApiKey) rather than importing a
 * shared type — those local copies are intentional and were left in place;
 * the unused shared duplicates that used to live here were removed.
 */

// ============================================================================
// Domain Models (only the types with live importers)
// ============================================================================

/**
 * Dataset entity
 */
export interface Dataset {
	id: string;
	name: string;
	slug: string;
	description?: string;
	storageFormat: "TIMESERIES" | "INFLUXDB" | "CSV";
	isPublic: boolean;
	isImported: boolean;
	createdAt: string;
	updatedAt: string;
	_count?: {
		timeseries: number;
	};
}

/**
 * Time series entity
 */
export interface TimeSeries {
	id: string;
	name: string;
	path: string;
	datasetId: string;
	dataType: "TEXT" | "BOOLEAN" | "INT32" | "INT64" | "FLOAT" | "DOUBLE";
	encoding: "PLAIN" | "RLE" | "DIFF" | "GORILLA" | "TS_2DIFF";
	compression: "UNCOMPRESSED" | "SNAPPY" | "GZIP" | "LZO" | "LZ4";
	createdAt: string;
	updatedAt: string;
	dataset?: Dataset;
}

/**
 * Alert severity levels — mirrors the backend Prisma enum AlertSeverity
 * { INFO WARNING ERROR }. Previously drifted to low/medium/high/critical,
 * which made every severity-keyed lookup miss (audit round-104).
 */
export type AlertSeverity = "INFO" | "WARNING" | "ERROR";

/**
 * Alert entity
 */
export interface Alert {
	id: string;
	message: string;
	severity: AlertSeverity;
	isRead: boolean;
	userId: string;
	createdAt: string;
	type?: string;
	details?: Record<string, unknown>;
}

/**
 * AI Model entity
 */
export interface AIModel {
	id: string;
	name: string;
	algorithm: "ARIMA" | "LSTM" | "SVR" | "KMeans";
	timeseriesId: string;
	parameters: Record<string, unknown>;
	status: "training" | "ready" | "error";
	errorMessage?: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Forecast entity
 */
export interface Forecast {
	id: string;
	modelId: string;
	timeseriesId: string;
	startTime: number;
	endTime: number;
	predictedValues: number[];
	confidenceIntervals?: {
		lower: number[];
		upper: number[];
	};
	createdAt: string;
	model?: AIModel;
	timeseries?: TimeSeries;
}
