/**
 * API Type Definitions
 *
 * Standardized types for API responses and domain models.
 * These types are used across the frontend to ensure type safety.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Standard API response wrapper
 * Changed default from `any` to `unknown` for type safety
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data: T;
	message?: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
	success: false;
	error: {
		message: string;
		code?: string;
		details?: unknown;
	};
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
	items: T[];
	pagination: PaginationMeta;
}

// ============================================================================
// Domain Models
// ============================================================================

/**
 * User roles
 * Must match backend UserRole enum in Prisma schema
 */
export type UserRole = "ADMIN" | "EDITOR" | "VIEWER";

/**
 * User entity
 */
export interface User {
	id: string;
	email: string;
	name?: string;
	role: UserRole;
	createdAt: string;
	updatedAt: string;
}

/**
 * Dataset entity
 */
export interface Dataset {
	id: string;
	name: string;
	slug: string;
	description?: string;
	storageFormat: "TSFILE" | "IoTDB" | "PARQUET";
	isPublic: boolean;
	isImported: boolean;
	organizationId?: string;
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
 * Data point for time series
 */
export interface DataPoint {
	timestamp: number;
	value: number | string | boolean;
}

/**
 * Alert severity levels
 */
export type AlertSeverity = "low" | "medium" | "high" | "critical";

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
 * Anomaly entity
 */
export interface Anomaly {
	id: string;
	timeseriesId: string;
	timestamp: number;
	value: number;
	score: number;
	severity: "low" | "medium" | "high";
	isResolved: boolean;
	resolvedAt?: string;
	createdAt: string;
	timeseries?: TimeSeries;
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
 * API Key entity
 */
export interface ApiKey {
	id: string;
	name: string;
	key: string;
	isActive: boolean;
	lastUsed?: string;
	expiresAt?: string;
	createdAt: string;
	permissions: string[];
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Dashboard statistics
 */
export interface DashboardStats {
	totalDatasets: number;
	totalTimeseries: number;
	totalDataPoints: number;
	recentAlerts: Alert[];
	recentForecasts: Forecast[];
	systemHealth: {
		database: boolean;
		iotdb: boolean;
		redis: boolean;
	};
}

/**
 * Recent activity item
 */
export interface RecentActivity {
	id: string;
	type: "alert" | "forecast" | "anomaly";
	title: string;
	description: string;
	timestamp: string;
	severity?: AlertSeverity;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Create dataset request
 */
export interface CreateDatasetRequest {
	name: string;
	description?: string;
	storageFormat: "TSFILE" | "IoTDB" | "PARQUET";
	isPublic: boolean;
}

/**
 * Query request
 */
export interface QueryRequest {
	timeseries: string;
	startTime?: number;
	endTime?: number;
	limit?: number;
	aggregation?: string;
}

/**
 * Insert data request
 */
export interface InsertDataRequest {
	timeseries: string;
	dataPoints: DataPoint[];
}

/**
 * AI prediction request
 */
export interface PredictionRequest {
	modelId: string;
	timeseries: string;
	startTime: number;
	endTime: number;
}

/**
 * Anomaly detection request
 */
export interface AnomalyDetectionRequest {
	timeseries: string;
	startTime: number;
	endTime: number;
	algorithm: "zscore" | "isolation_forest";
	threshold?: number;
	windowSize?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if response is an API response
 */
export function isApiResponse<T>(obj: unknown): obj is ApiResponse<T> {
	return typeof obj === "object" && obj !== null && "success" in obj;
}

/**
 * Check if response is an error response
 */
export function isApiErrorResponse(obj: unknown): obj is ApiErrorResponse {
	return isApiResponse(obj) && obj.success === false;
}

/**
 * Check if response is a success response
 */
export function isSuccessResponse<T>(obj: unknown): obj is ApiResponse<T> {
	return isApiResponse(obj) && obj.success === true;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract data type from paginated response
 */
export type ExtractData<T> = T extends ApiResponse<infer D> ? D : never;

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Required properties
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
