/**
 * Form Data Type Definitions
 *
 * Provides strongly-typed interfaces for form submissions
 * replacing `any` types in form handlers
 */

// ============================================================================
// Authentication Forms
// ============================================================================

/**
 * Login form data
 */
export interface LoginFormData {
	email: string;
	password: string;
	remember?: boolean;
}

/**
 * Registration form data
 */
export interface RegisterFormData {
	email: string;
	password: string;
	confirmPassword: string;
	name: string;
	agreeToTerms?: boolean;
}

/**
 * Password reset request form data
 */
export interface ForgotPasswordFormData {
	email: string;
}

/**
 * Update password form data
 */
export interface UpdatePasswordFormData {
	currentPassword?: string;
	newPassword: string;
	confirmPassword: string;
	token?: string;
}

// ============================================================================
// Alert Forms
// ============================================================================

/**
 * Alert severity levels
 */
export type FormAlertSeverity = "INFO" | "WARNING" | "ERROR";

/**
 * Alert type
 */
export type AlertType = "ANOMALY" | "FORECAST_READY" | "SYSTEM";

/**
 * Create alert form data
 */
export interface CreateAlertFormData {
	name: string;
	timeseriesId: string;
	type: AlertType;
	severity: FormAlertSeverity;
	condition: string;
	threshold?: number;
	message: string;
	isEnabled?: boolean;
}

/**
 * Alert rule form data
 */
export interface AlertRuleFormData {
	name: string;
	timeseriesId: string;
	condition: string;
	threshold?: number;
	severity: FormAlertSeverity;
	notificationChannels: NotificationChannelFormData[];
	cooldownMinutes?: number;
	isEnabled?: boolean;
}

/**
 * Notification channel form data
 */
export interface NotificationChannelFormData {
	type: "email" | "webhook" | "slack";
	config: EmailNotificationConfig | WebhookNotificationConfig | SlackNotificationConfig;
	isEnabled?: boolean;
}

/**
 * Email notification config
 */
export interface EmailNotificationConfig {
	recipients: string[];
	subject?: string;
}

/**
 * Webhook notification config
 */
export interface WebhookNotificationConfig {
	url: string;
	headers?: Record<string, string>;
}

/**
 * Slack notification config
 */
export interface SlackNotificationConfig {
	webhookUrl: string;
	channel?: string;
}

// ============================================================================
// API Key Forms
// ============================================================================

/**
 * Create API key form data
 */
export interface CreateApiKeyFormData {
	name: string;
	permissions: string[];
	expiresAt?: string;
}

/**
 * Edit API key form data
 */
export interface EditApiKeyFormData extends CreateApiKeyFormData {
	isActive: boolean;
}

// ============================================================================
// Timeseries Forms
// ============================================================================

/**
 * Timeseries data type
 */
export type TimeseriesDataType = "TEXT" | "BOOLEAN" | "INT32" | "INT64" | "FLOAT" | "DOUBLE";

/**
 * Timeseries encoding
 */
export type TimeseriesEncoding = "PLAIN" | "RLE" | "DIFF" | "GORILLA" | "TS_2DIFF";

/**
 * Timeseries compression
 */
export type TimeseriesCompression = "UNCOMPRESSED" | "SNAPPY" | "GZIP" | "LZ4";

/**
 * Create timeseries form data
 */
export interface CreateTimeseriesFormData {
	name: string;
	path: string;
	dataType: TimeseriesDataType;
	encoding: TimeseriesEncoding;
	compression: TimeseriesCompression;
	datasetId: string;
	description?: string;
	unit?: string;
}

/**
 * Edit timeseries form data
 */
export interface EditTimeseriesFormData extends Partial<CreateTimeseriesFormData> {
	id: string;
}

// ============================================================================
// AI/ML Forms
// ============================================================================

/**
 * ML algorithm type
 */
export type MLAlgorithm = "ARIMA" | "PROPHET" | "LSTM" | "TRANSFORMER" | "ENSEMBLE";

/**
 * Train model form data
 */
export interface TrainModelFormData {
	name: string;
	timeseriesId: string;
	algorithm: MLAlgorithm;
	horizon: number;
	confidenceLevel: number;
	hyperparameters?: ModelHyperparameters;
}

/**
 * Model hyperparameters
 */
export interface ModelHyperparameters {
	[key: string]: string | number | boolean;
}

/**
 * Prediction form data
 */
export interface PredictionFormData {
	modelId: string;
	timeseriesId: string;
	horizon: number;
	confidenceLevel: number;
	startTime?: string;
	endTime?: string;
}

// ============================================================================
// Dataset Forms
// ============================================================================

/**
 * Storage format
 */
export type StorageFormat = "TIMESERIES" | "INFLUXDB" | "OPENML" | "CSV";

/**
 * Create dataset form data
 */
export interface CreateDatasetFormData {
	name: string;
	slug?: string;
	description?: string;
	storageFormat: StorageFormat;
	isPublic: boolean;
}

/**
 * Import dataset form data
 */
export interface ImportDatasetFormData {
	file?: File;
	url?: string;
	name: string;
	storageFormat: StorageFormat;
}

// ============================================================================
// Settings Forms
// ============================================================================

/**
 * Profile update form data
 */
export interface ProfileFormData {
	name?: string;
	email?: string;
	avatarUrl?: string;
	currentPassword?: string;
}

/**
 * Notification preferences form data
 */
export interface NotificationPreferencesFormData {
	emailAlerts: boolean;
	webhookUrl?: string;
	alertSeverity: ("INFO" | "WARNING" | "ERROR")[];
	digestFrequency: "immediate" | "hourly" | "daily";
}

/**
 * Session management form data
 */
export interface SessionFormData {
	deviceId?: string;
	isActive: boolean;
}

// ============================================================================
// Common Form Types
// ============================================================================

/**
 * Form validation error
 */
export interface FormValidationError {
	field: string;
	message: string;
}

/**
 * Form submission state
 */
export interface FormState<T> {
	data: T;
	errors: FormValidationError[];
	isSubmitting: boolean;
	isDirty: boolean;
}

/**
 * Form field config
 */
export interface FormFieldConfig<T> {
	name: keyof T;
	label: string;
	type:
		| "text"
		| "email"
		| "password"
		| "number"
		| "select"
		| "multiselect"
		| "checkbox"
		| "textarea";
	required?: boolean;
	placeholder?: string;
	options?: Array<{ label: string; value: string | number }>;
	validation?: {
		min?: number;
		max?: number;
		pattern?: RegExp;
		custom?: (value: unknown) => string | undefined;
	};
}

/**
 * Form config
 */
export interface FormConfig<T> {
	fields: FormFieldConfig<T>[];
	submitLabel?: string;
	cancelLabel?: string;
	onSubmit: (data: T) => Promise<void>;
	onCancel?: () => void;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation rule
 */
export interface ValidationRule {
	required?: boolean;
	min?: number;
	max?: number;
	pattern?: RegExp;
	minLength?: number;
	maxLength?: number;
	custom?: (value: unknown) => boolean | string;
}

/**
 * Validation schema
 */
export type ValidationSchema<T> = {
	[K in keyof T]?: ValidationRule;
};

/**
 * Validation result
 */
export interface ValidationResult {
	isValid: boolean;
	errors: FormValidationError[];
}

// ============================================================================
// Form Utilities
// ============================================================================

/**
 * Extract field names from form data
 */
export type FormFieldNames<T> = (keyof T)[];

/**
 * Make all form fields optional for editing
 */
export type PartialFormData<T> = {
	[K in keyof T]?: T[K];
};

/**
 * Required form fields for creation
 */
export type RequiredFormData<T> = {
	[K in keyof T]-?: T[K];
};
