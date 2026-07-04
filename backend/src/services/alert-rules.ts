/**
 * Alert Rules Service
 *
 * Manages alert rule creation and lookup. The rule-evaluation pipeline
 * (evaluate/trigger/getActive) and rule CRUD beyond create were dead code —
 * no route or scheduler consumed them — and have been removed along with
 * their only caller (alert-rules-complex integration test).
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type {
	AlertCondition,
	AlertRule,
	NotificationChannel,
} from "./alert-types";

type AlertType = "ANOMALY" | "FORECAST_READY" | "SYSTEM";
type AlertSeverity = "INFO" | "WARNING" | "ERROR";

type PrismaAlertRule = Awaited<ReturnType<typeof prisma.alertRule.findUnique>> & {
	id: string;
};

/** Type-safe helper to read a Prisma Json field as a typed object. */
function parseJsonField<T>(value: Prisma.JsonValue): T {
	return value as unknown as T;
}

/** Type-safe helper to write a typed object into a Prisma Json column. */
function toJsonInput(value: unknown): Prisma.InputJsonValue {
	return value as unknown as Prisma.InputJsonValue;
}

function mapRule(rule: PrismaAlertRule): AlertRule {
	return {
		id: rule.id,
		userId: rule.userId,
		timeseriesId: rule.timeseriesId,
		name: rule.name,
		description: rule.description || undefined,
		type: rule.type as AlertType,
		condition: parseJsonField<AlertCondition>(rule.conditions),
		severity: rule.severity as AlertSeverity,
		enabled: rule.enabled,
		notificationChannels: parseJsonField<NotificationChannel[]>(rule.channels),
		cooldownMinutes: rule.cooldownMinutes,
		lastTriggeredAt: rule.lastTriggeredAt || undefined,
		createdAt: rule.createdAt,
		updatedAt: rule.updatedAt || rule.createdAt,
	};
}

/**
 * Create a new alert rule.
 */
export async function createAlertRule(params: {
	userId: string;
	timeseriesId: string;
	name: string;
	type?: AlertType;
	condition: AlertCondition;
	severity?: AlertSeverity;
	notificationChannels: NotificationChannel[];
	cooldownMinutes?: number;
	description?: string;
}): Promise<AlertRule> {
	const {
		userId,
		timeseriesId,
		name,
		type = "ANOMALY",
		condition,
		severity = "WARNING",
		notificationChannels,
		cooldownMinutes = 5,
		description,
	} = params;

	const rule = await prisma.alertRule.create({
		data: {
			userId,
			timeseriesId,
			name,
			description,
			type,
			enabled: true,
			conditions: toJsonInput(condition),
			severity,
			channels: toJsonInput(notificationChannels),
			cooldownMinutes,
		},
	});

	logger.info(`[ALERT_RULE] Created alert rule ${rule.id} for user ${userId}`);

	return mapRule(rule);
}

/**
 * Get alert rule by ID.
 */
export async function getAlertRule(id: string): Promise<AlertRule | null> {
	const rule = await prisma.alertRule.findUnique({
		where: { id },
	});

	if (!rule) return null;

	return mapRule(rule);
}
