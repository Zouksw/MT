/**
 * API Response Type Definitions
 *
 * Standardized types for all API responses following Linus's philosophy:
 * "Good programmers worry about data structures."
 */

// ============================================================================
// Base Response Types
// ============================================================================

/**
 * Standard API response wrapper
 * All API responses follow this structure
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	message?: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
	success: false;
	error: {
		message: string;
		code: string;
		details?: ErrorDetail;
	};
}

/**
 * Error detail structure
 */
export interface ErrorDetail {
	field?: string;
	issue?: string;
	context?: Record<string, unknown>;
	checks?: Record<string, boolean | string>;
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
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
	items: T[];
	pagination: PaginationMeta;
}

// ============================================================================
// Domain Entity Response Types
// ============================================================================

/**
 * User response (exclude sensitive data)
 */
export interface UserResponse {
	id: string;
	email: string;
	name: string | null;
	role: "ADMIN" | "EDITOR" | "VIEWER";
	avatarUrl: string | null;
	createdAt: string;
	updatedAt: string | null;
	lastLoginAt: string | null;
}

/**
 * Dataset response
 */
export interface DatasetResponse {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	storageFormat: "IOTDB_CACHE" | "INFLUXDB" | "OPENML" | "CSV";
	isPublic: boolean;
	isImported: boolean;
	organizationId: string;
	sizeBytes: string | null;
	rowsCount: number | null;
	createdAt: string;
	updatedAt: string | null;
	lastAccessedAt: string | null;
	owner?: UserResponse;
	_count?: {
		timeseries: number;
	};
}

/**
 * Timeseries response
 */
export interface TimeseriesResponse {
	id: string;
	datasetId: string;
	name: string;
	slug: string;
	description: string | null;
	colorHex: string | null;
	unit: string | null;
	timezone: string;
	isAnomalyDetectionEnabled: boolean;
	createdAt: string;
	updatedAt: string | null;
	dataset?: DatasetResponse;
}

/**
 * Datapoint response
 */
export interface DatapointResponse {
	id: string;
	timeseriesId: string;
	timestamp: string;
	value: DatapointValue;
	qualityScore: string | null;
	isOutlier: boolean;
	isAnomaly: boolean;
	createdAt: string;
}

/**
 * Datapoint value type
 */
export type DatapointValue = string | number | boolean | null;

/**
 * Alert response
 */
export interface AlertResponse {
	id: string;
	userId: string;
	timeseriesId: string;
	type: "ANOMALY" | "FORECAST_READY" | "SYSTEM";
	severity: "INFO" | "WARNING" | "ERROR";
	message: string;
	metadata: Record<string, unknown> | null;
	isRead: boolean;
	sentAt: string | null;
	createdAt: string;
	timeseries?: TimeseriesResponse;
}

/**
 * Anomaly response
 */
export interface AnomalyResponse {
	id: string;
	timeseriesId: string;
	datapointId: string | null;
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	detectionMethod: "STATISTICAL" | "ML_AUTOENCODER" | "RULE_BASED";
	score: string | null;
	context: Record<string, unknown> | null;
	isInvestigated: boolean;
	resolutionNotes: string | null;
	isResolved: boolean;
	resolvedAt: string | null;
	createdAt: string;
	timeseries?: TimeseriesResponse;
}

/**
 * Forecasting Model response
 */
export interface ModelResponse {
	id: string;
	timeseriesId: string;
	trainedById: string | null;
	algorithm: "ARIMA" | "PROPHET" | "LSTM" | "TRANSFORMER" | "ENSEMBLE";
	hyperparameters: Record<string, unknown>;
	trainingMetrics: Record<string, unknown> | null;
	version: number;
	isActive: boolean;
	trainedAt: string | null;
	deployedAt: string | null;
	createdAt: string;
	timeseries?: TimeseriesResponse;
	trainedBy?: UserResponse;
}

/**
 * Forecast response
 */
export interface ForecastResponse {
	id: string;
	modelId: string;
	timeseriesId: string;
	timestamp: string;
	predictedValue: string;
	lowerBound: string | null;
	upperBound: string | null;
	confidence: string;
	anomalyProbability: string | null;
	isAnomaly: boolean;
	createdAt: string;
	model?: ModelResponse;
	timeseries?: TimeseriesResponse;
}

/**
 * API Key response
 */
export interface ApiKeyResponse {
	id: string;
	userId: string;
	name: string;
	lastCharacters: number;
	isActive: boolean;
	usageCount: number;
	expiresAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
	// Note: keyHash is never exposed
}

/**
 * API Key creation response (includes the actual key)
 */
export interface ApiKeyCreationResponse extends ApiKeyResponse {
	apiKey: string; // Only shown once during creation
}

/**
 * Session response
 */
export interface SessionResponse {
	id: string;
	userId: string;
	ipAddress: string | null;
	userAgent: string | null;
	expiresAt: string;
	isActive: boolean;
	lastActivityAt: string | null;
	createdAt: string;
}

/**
 * Audit Log response
 */
export interface AuditLogResponse {
	id: string;
	userId: string;
	resourceType: string;
	resourceId: string | null;
	action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "EXPORT" | "LOGIN";
	ipAddress: string | null;
	userAgent: string | null;
	success: boolean;
	errorCode: string | null;
	createdAt: string;
	user?: UserResponse;
}

// ============================================================================
// IoTDB Specific Types
// ============================================================================

/**
 * IoTDB query result
 */
export interface IoTDBQueryResult {
	timeseries: string;
	dataPoints: Array<{
		timestamp: number;
		value: unknown;
	}>;
	count: number;
}

/**
 * IoTDB batch insert result
 */
export interface BatchResult {
	success: boolean;
	count: number;
	errors?: Array<{
		index: number;
		error: string;
	}>;
}

/**
 * IoTDB data point
 */
export interface IoTDBDataPoint {
	timestamp: number;
	value: unknown;
}

/**
 * AI prediction result
 */
export interface PredictionResult {
	timestamps: number[];
	predictedValues: number[];
	confidenceIntervals?: {
		lower: number[];
		upper: number[];
	};
	model: string;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
	timestamp: number;
	value: number;
	isAnomaly: boolean;
	score: number;
	threshold: number;
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
	recentAlerts: AlertResponse[];
	recentForecasts: ForecastResponse[];
	systemHealth: {
		database: boolean;
		iotdb: boolean;
		redis: boolean;
	};
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
	page?: number;
	limit?: number;
	sortBy?: string;
	order?: "asc" | "desc";
}

/**
 * Time range query
 */
export interface TimeRangeQuery {
	startTime?: string;
	endTime?: string;
	limit?: number;
	aggregation?: string;
}

/**
 * Filter parameters
 */
export interface FilterParams {
	search?: string;
	status?: string;
	startDate?: string;
	endDate?: string;
}

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * JWT payload
 */
export interface JwtPayload {
	userId: string;
	email: string;
	role: string;
	iat?: number;
	exp?: number;
}

/**
 * Auth tokens response
 */
export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

/**
 * Register request
 */
export interface RegisterRequest {
	email: string;
	password: string;
	name: string;
}

/**
 * Login request
 */
export interface LoginRequest {
	email: string;
	password: string;
}

/**
 * Auth response
 */
export interface AuthResponse extends AuthTokens {
	user: UserResponse;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a valid API error response
 */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
	return (
		typeof value === "object" &&
		value !== null &&
		"success" in value &&
		(value as { success: boolean }).success === false &&
		"error" in value
	);
}

/**
 * Check if value is a valid success response
 */
export function isSuccessResponse<T>(value: unknown): value is ApiResponse<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		"success" in value &&
		(value as { success: boolean }).success === true
	);
}
