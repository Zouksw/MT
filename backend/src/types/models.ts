/**
 * Model Type Definitions
 *
 * Prisma-based type definitions mirroring the database schema.
 * These types should match Prisma's generated types but are explicitly
 * defined here for clarity and to avoid circular dependencies.
 */

// ============================================================================
// Enums (matching Prisma schema)
// ============================================================================

/**
 * User roles
 */
export type UserRole = "ADMIN" | "EDITOR" | "VIEWER";

/**
 * Storage format types
 */
export type StorageFormat = "IOTDB_CACHE" | "INFLUXDB" | "OPENML" | "CSV";

/**
 * ML algorithm types
 */
export type ModelAlgorithm =
	| "ARIMA"
	| "PROPHET"
	| "LSTM"
	| "TRANSFORMER"
	| "ENSEMBLE";

/**
 * Anomaly severity levels
 */
export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Detection methods
 */
export type DetectionMethod = "STATISTICAL" | "ML_AUTOENCODER" | "RULE_BASED";

/**
 * Alert types
 */
export type AlertType = "ANOMALY" | "FORECAST_READY" | "SYSTEM";

/**
 * Alert severity levels
 */
export type AlertSeverity = "INFO" | "WARNING" | "ERROR";

/**
 * Audit action types
 */
export type AuditAction =
	| "CREATE"
	| "READ"
	| "UPDATE"
	| "DELETE"
	| "EXPORT"
	| "LOGIN";

// ============================================================================
// Input Types (for Prisma operations)
// ============================================================================

/**
 * User create input
 */
export interface UserCreateInput {
	email: string;
	passwordHash: string;
	name: string;
	role?: UserRole;
	avatarUrl?: string | null;
	preferences?: unknown | null;
}

/**
 * User update input
 */
export interface UserUpdateInput {
	email?: string;
	name?: string;
	avatarUrl?: string | null;
	preferences?: unknown | null;
	lastLoginAt?: Date | null;
}

/**
 * Dataset create input
 */
export interface DatasetCreateInput {
	organizationId: string;
	ownerId: string;
	name: string;
	slug: string;
	description?: string | null;
	storageFormat: StorageFormat;
	filePath?: string | null;
	isPublic?: boolean;
	isImported?: boolean;
	metadata?: unknown | null;
}

/**
 * Dataset update input
 */
export interface DatasetUpdateInput {
	name?: string;
	description?: string | null;
	isPublic?: boolean;
	lastAccessedAt?: Date | null;
	metadata?: unknown | null;
}

/**
 * Timeseries create input
 */
export interface TimeseriesCreateInput {
	datasetId: string;
	name: string;
	slug: string;
	description?: string | null;
	colorHex?: string | null;
	unit?: string | null;
	timezone?: string;
	isAnomalyDetectionEnabled?: boolean;
}

/**
 * Timeseries update input
 */
export interface TimeseriesUpdateInput {
	name?: string;
	description?: string | null;
	colorHex?: string | null;
	unit?: string | null;
	timezone?: string;
	isAnomalyDetectionEnabled?: boolean;
}

/**
 * Datapoint value type
 * @internal Import from './api' instead
 */
type DatapointValue = string | number | boolean | null;

/**
 * Datapoint create input
 */
export interface DatapointCreateInput {
	timeseriesId: string;
	timestamp: Date;
	valueJson: DatapointValue;
	qualityScore?: number | null;
	isOutlier?: boolean;
	isAnomaly?: boolean;
}

/**
 * Forecasting Model create input
 */
export interface ModelCreateInput {
	timeseriesId: string;
	trainedById?: string | null;
	algorithm: ModelAlgorithm;
	hyperparameters: Record<string, unknown>;
	trainingMetrics?: Record<string, unknown> | null;
	version?: number;
	isActive?: boolean;
	trainedAt?: Date | null;
	deployedAt?: Date | null;
}

/**
 * Forecast create input
 */
export interface ForecastCreateInput {
	modelId: string;
	timeseriesId: string;
	timestamp: Date;
	predictedValue: number;
	lowerBound?: number | null;
	upperBound?: number | null;
	confidence: number;
	anomalyProbability?: number | null;
	isAnomaly?: boolean;
}

/**
 * Anomaly create input
 */
export interface AnomalyCreateInput {
	timeseriesId: string;
	datapointId?: bigint | null;
	severity: AnomalySeverity;
	detectionMethod: DetectionMethod;
	score?: number | null;
	context?: Record<string, unknown> | null;
	isInvestigated?: boolean;
	resolutionNotes?: string | null;
	isResolved?: boolean;
	resolvedAt?: Date | null;
}

/**
 * Alert create input
 */
export interface AlertCreateInput {
	userId: string;
	timeseriesId: string;
	type: AlertType;
	severity: AlertSeverity;
	message: string;
	metadata?: Record<string, unknown> | null;
	isRead?: boolean;
	sentAt?: Date | null;
}

/**
 * API Key create input
 */
export interface ApiKeyCreateInput {
	userId: string;
	name: string;
	keyHash: string;
	lastCharacters: number;
	isActive?: boolean;
	expiresAt?: Date | null;
}

/**
 * Session create input
 */
export interface SessionCreateInput {
	userId: string;
	tokenHash: string;
	ipAddress?: string | null;
	userAgent?: string | null;
	expiresAt: Date;
	isActive?: boolean;
	lastActivityAt?: Date | null;
}

/**
 * Audit Log create input
 */
export interface AuditLogCreateInput {
	userId: string;
	resourceType: string;
	resourceId?: string | null;
	action: AuditAction;
	ipAddress?: string | null;
	userAgent?: string | null;
	success: boolean;
	errorCode?: string | null;
}

// ============================================================================
// Where Condition Types
// ============================================================================

/**
 * Generic where condition for queries
 */
export type WhereCondition<T> = {
	[K in keyof T]?: T[K] extends string
		? string | { equals?: string; contains?: string; in?: string[] }
		: T[K] extends boolean
			? boolean
			: T[K] extends number
				? number | { gt?: number; gte?: number; lt?: number; lte?: number }
				: T[K] extends Date
					? Date | { gt?: Date; gte?: Date; lt?: Date; lte?: Date }
					: unknown;
};

/**
 * User where conditions
 */
export interface UserWhere
	extends WhereCondition<Omit<UserCreateInput, "passwordHash">> {
	id?: string;
	email?: string;
	role?: UserRole | { in: UserRole[] };
}

/**
 * Dataset where conditions
 */
export interface DatasetWhere {
	id?: string;
	ownerId?: string;
	organizationId?: string;
	slug?: string;
	isPublic?: boolean;
}

/**
 * Timeseries where conditions
 */
export interface TimeseriesWhere {
	id?: string;
	datasetId?: string;
	slug?: string;
	isAnomalyDetectionEnabled?: boolean;
}

/**
 * Alert where conditions
 */
export interface AlertWhere {
	id?: string;
	userId?: string;
	timeseriesId?: string;
	type?: AlertType | { in: AlertType[] };
	severity?: AlertSeverity | { in: AlertSeverity[] };
	isRead?: boolean;
}

/**
 * Anomaly where conditions
 */
export interface AnomalyWhere {
	id?: string;
	timeseriesId?: string;
	severity?: AnomalySeverity | { in: AnomalySeverity[] };
	isResolved?: boolean;
}

// ============================================================================
// Order By Types
// ============================================================================

/**
 * Generic order by
 */
export type OrderBy<T> = {
	[K in keyof T]?: "asc" | "desc";
};

/**
 * User order by
 */
export type UserOrderBy = OrderBy<
	Pick<UserCreateInput, "email" | "name"> & { createdAt?: "asc" | "desc" }
>;

/**
 * Dataset order by
 */
export type DatasetOrderBy = OrderBy<
	Pick<DatasetCreateInput, "name"> & {
		createdAt?: "asc" | "desc";
		updatedAt?: "asc" | "desc";
	}
>;

/**
 * Timeseries order by
 */
export type TimeseriesOrderBy = OrderBy<
	Pick<TimeseriesCreateInput, "name"> & { createdAt?: "asc" | "desc" }
>;

/**
 * Alert order by
 */
export type AlertOrderBy = OrderBy<"createdAt" | "sentAt">;

/**
 * Anomaly order by
 */
export type AnomalyOrderBy = OrderBy<"createdAt" | "timestamp">;

// ============================================================================
// Query Options Types
// ============================================================================

/**
 * Base query options
 */
export interface QueryOptions {
	take?: number;
	skip?: number;
}

/**
 * Find many options
 */
export interface FindManyOptions<TWhere, TOrderBy> extends QueryOptions {
	where?: TWhere;
	orderBy?: TOrderBy | TOrderBy[];
	include?: Record<string, boolean>;
}

/**
 * Find unique options
 */
export interface FindUniqueOptions {
	include?: Record<string, boolean>;
}

// ============================================================================
// Relation Types
// ============================================================================

/**
 * User relations
 */
export interface UserRelations {
	datasets?: true;
	apiKeys?: true;
	sessions?: true;
	auditLogs?: true;
	alerts?: true;
	models?: true;
}

/**
 * Dataset relations
 */
export interface DatasetRelations {
	owner?: true;
	organization?: true;
	timeseries?: true;
}

/**
 * Timeseries relations
 */
export interface TimeseriesRelations {
	dataset?: true;
	datapoints?: true;
	alerts?: true;
	anomalies?: true;
	models?: true;
	forecasts?: true;
}

/**
 * Alert relations
 */
export interface AlertRelations {
	user?: true;
	timeseries?: true;
}

/**
 * Anomaly relations
 */
export interface AnomalyRelations {
	timeseries?: true;
}

/**
 * Model relations
 */
export interface ModelRelations {
	timeseries?: true;
	trainedBy?: true;
	forecasts?: true;
}

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Dataset metadata
 */
export interface DatasetMetadata {
	source?: string;
	importDate?: string;
	tags?: string[];
	columns?: Array<{
		name: string;
		type: string;
		unit?: string;
	}>;
}

/**
 * Model training metrics
 */
export interface ModelTrainingMetrics {
	accuracy?: number;
	mae?: number; // Mean Absolute Error
	mse?: number; // Mean Squared Error
	rmse?: number; // Root Mean Squared Error
	trainingTime?: number;
	sampleSize?: number;
}

/**
 * Model hyperparameters
 */
export interface ModelHyperparameters {
	[algorithm: string]: {
		[param: string]: unknown;
	};
}

/**
 * Anomaly context
 */
export interface AnomalyContext {
	value?: number;
	threshold?: number;
	windowSize?: number;
	algorithm?: string;
	relatedAnomalies?: string[];
}

/**
 * Alert metadata
 */
export interface AlertMetadata {
	value?: number;
	threshold?: number;
	ruleId?: string;
	forecastId?: string;
	anomalyId?: string;
	triggeredBy?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract ID type from entity
 */
export type EntityId<T> = T extends { id: infer I } ? I : never;

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Pick only specified keys
 */
export type PickByType<T, U> = {
	[P in keyof T as T[P] extends U ? P : never]: T[P];
};
