/**
 * Alert Service (CRUD Operations)
 *
 * Main entry point for alert functionality.
 * Re-exports types and functions from specialized modules.
 */

import { z } from "zod";
import { prisma } from "@/lib";

// Re-export rule creation (the only live rule-management entry point)
export { createAlertRule, deleteAlertRule, listAlertRules, updateAlertRule } from "./alert-rules";
// Re-export types
export * from "./alert-types";

/**
 * List alerts for a user
 */
export async function listAlerts(
	userId: string,
	filters: {
		unreadOnly?: boolean;
		type?: "ANOMALY" | "FORECAST_READY" | "SYSTEM";
		severity?: "INFO" | "WARNING" | "ERROR";
		limit?: number;
		offset?: number;
	} = {},
) {
	const { unreadOnly, type, severity, limit = 50, offset = 0 } = filters;

	const where: {
		userId: string;
		isRead?: boolean;
		type?: "ANOMALY" | "FORECAST_READY" | "SYSTEM";
		severity?: "INFO" | "WARNING" | "ERROR";
	} = { userId };

	if (unreadOnly) {
		where.isRead = false;
	}

	if (type) {
		where.type = type;
	}

	if (severity) {
		where.severity = severity;
	}

	const [alerts, total] = await Promise.all([
		prisma.alert.findMany({
			where,
			orderBy: { createdAt: "desc" },
			take: limit,
			skip: offset,
			include: {
				timeseries: {
					select: {
						id: true,
						name: true,
						dataset: {
							select: {
								name: true,
							},
						},
					},
				},
			},
		}),
		prisma.alert.count({ where }),
	]);

	return { alerts, total };
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(userId: string, alertId: string) {
	const alert = await prisma.alert.findFirst({
		where: {
			id: alertId,
			userId,
		},
	});

	if (!alert) {
		throw new Error("Alert not found");
	}

	await prisma.alert.update({
		where: { id: alertId },
		data: { isRead: true },
	});

	return { success: true };
}

/**
 * Mark all alerts as read
 */
export async function markAllAlertsAsRead(userId: string) {
	await prisma.alert.updateMany({
		where: {
			userId,
			isRead: false,
		},
		data: { isRead: true },
	});

	return { success: true };
}

/**
 * Delete an alert
 */
export async function deleteAlert(userId: string, alertId: string) {
	const alert = await prisma.alert.findFirst({
		where: {
			id: alertId,
			userId,
		},
	});

	if (!alert) {
		throw new Error("Alert not found");
	}

	await prisma.alert.delete({
		where: { id: alertId },
	});

	return { success: true };
}

/**
 * Get alert statistics
 */
export async function getAlertStats(userId: string) {
	const [total, unread, bySeverity, byType] = await Promise.all([
		prisma.alert.count({ where: { userId } }),
		prisma.alert.count({ where: { userId, isRead: false } }),
		prisma.alert.groupBy({
			by: ["severity"],
			where: { userId },
			_count: true,
		}),
		prisma.alert.groupBy({
			by: ["type"],
			where: { userId },
			_count: true,
		}),
	]);

	return {
		total,
		unread,
		bySeverity: bySeverity.reduce(
			(acc, item) => {
				acc[item.severity] = item._count;
				return acc;
			},
			{} as Record<string, number>,
		),
		byType: byType.reduce(
			(acc, item) => {
				acc[item.type] = item._count;
				return acc;
			},
			{} as Record<string, number>,
		),
	};
}

/**
 * Validation schemas
 */
const conditionSchema = z.object({
	type: z.enum(["threshold", "anomaly", "pattern", "forecast"]),
	operator: z.enum([">", "<", "=", "!=", ">=", "<="]).optional(),
	value: z.number().optional(),
	anomalySeverity: z.array(z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])).optional(),
	windowMinutes: z.number().positive().optional(),
});

const notificationChannelsSchema = z.array(
	z.object({
		type: z.enum(["email", "webhook", "slack"]),
		config: z.object({
			email: z.string().email().optional(),
			webhookUrl: z.string().url().optional(),
			slackWebhookUrl: z.string().url().optional(),
		}),
	}),
);

export const alertSchemas = {
	createRule: z.object({
		timeseriesId: z.string().uuid(),
		name: z.string().min(1).max(255),
		type: z.enum(["ANOMALY", "FORECAST_READY", "SYSTEM"]),
		condition: conditionSchema,
		severity: z.enum(["INFO", "WARNING", "ERROR"]),
		notificationChannels: notificationChannelsSchema,
		cooldownMinutes: z.number().int().min(0).optional(),
	}),
	// PATCH /rules/:id — partial update; `enabled`-only bodies drive the UI
	// toggle. timeseriesId is intentionally not updatable (re-pointing a rule
	// at a different series = create a new rule).
	updateRule: z.object({
		name: z.string().min(1).max(255).optional(),
		type: z.enum(["ANOMALY", "FORECAST_READY", "SYSTEM"]).optional(),
		condition: conditionSchema.optional(),
		severity: z.enum(["INFO", "WARNING", "ERROR"]).optional(),
		enabled: z.boolean().optional(),
		notificationChannels: notificationChannelsSchema.optional(),
		cooldownMinutes: z.number().int().min(0).optional(),
	}),
};
