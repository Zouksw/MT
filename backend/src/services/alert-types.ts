/**
 * Alert Types
 *
 * Type definitions for alert system
 */

/**
 * Alert condition types
 */
export interface AlertCondition {
	type: "threshold" | "anomaly" | "pattern";
	operator?: ">" | "<" | ">=" | "<=" | "=" | "!=";
	value?: number;
	threshold?: number;
	pattern?: string;
	metric?: string;
	window?: number;
	sensitivity?: number;
	duration?: number;
}

/**
 * Alert evaluation data
 */
export interface AlertEvaluationData {
	value: number;
	timestamp: number;
	timeseriesId: string;
	isAnomaly?: boolean;
	isFlatline?: boolean;
	metric?: string;
	window?: number;
	previousValue?: number;
	changePercent?: number;
}

/**
 * Alert rule (in-memory representation)
 */
export interface AlertRule {
	id: string;
	userId: string;
	timeseriesId: string;
	name: string;
	description?: string;
	type: "ANOMALY" | "FORECAST_READY" | "SYSTEM";
	condition: AlertCondition;
	severity: "INFO" | "WARNING" | "ERROR";
	enabled: boolean;
	notificationChannels: NotificationChannel[];
	cooldownMinutes: number;
	lastTriggeredAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Notification channels
 */
export interface NotificationChannel {
	type: "email" | "webhook" | "slack";
	enabled: boolean;
	config?: Record<string, unknown>;
}

/**
 * Trigger alert parameters
 */
export interface TriggerAlertParams {
	ruleId: string;
	alertData: Record<string, unknown>;
}

/**
 * Alert with metadata
 */
export interface AlertWithMetadata {
	id: string;
	userId: string;
	timeseriesId: string;
	type: string;
	severity: string;
	message: string;
	metadata?: Record<string, unknown> | null;
	isRead: boolean;
	sentAt?: Date | null;
	createdAt: Date;
	rule?: {
		id: string;
		name: string;
	};
}
