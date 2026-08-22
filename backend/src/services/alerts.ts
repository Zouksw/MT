/**
 * Alert Service — single module for the alert domain.
 *
 * Sections: types · rule CRUD + scheduled evaluation · alert CRUD + zod schemas.
 * Merged from alert-types.ts / alert-rules.ts / alerts.ts (round-117) —
 * exports unchanged, callers now import one path.
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { logger, prisma } from "@/lib";
import { BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { batchLatestPrices } from "@/services/inference/authoritativeSources";

// ===========================================================================
// Types (was alert-types.ts)
// ===========================================================================

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

// ===========================================================================
// Rules — CRUD + scheduled evaluation (was alert-rules.ts). evaluateAlertRules
// runs on a timer from server.ts: checks each enabled rule's latest price
// against its threshold condition, creating Alert rows (with cooldown) on match.
// ===========================================================================

/**
 * Only "threshold" conditions have an evaluator in evaluateAlertRules —
 * anomaly/pattern/forecast are schema-accepted but can NEVER fire. Accepting
 * them lets users create rules that display as enabled but are structurally
 * dead (round-106 honesty fix: reject loudly at the boundary instead).
 */
function assertConditionEvaluable(condition: AlertCondition): void {
	if (condition.type !== "threshold") {
		throw new BadRequestError(
			`Condition type "${condition.type}" has no evaluator yet — only "threshold" rules can fire.`,
		);
	}
}

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

	assertConditionEvaluable(condition);

	// round-119: creation used to accept ANY timeseriesId — a rule could be
	// attached to another user's series (or a nonexistent id that silently
	// never evaluates). Enforce owner-scoping with the same 404 for
	// not-found and not-owned, matching the anomalies/models convention.
	const timeseries = await prisma.timeseries.findUnique({
		where: { id: timeseriesId },
		select: { dataset: { select: { ownerId: true } } },
	});
	if (!timeseries || timeseries.dataset.ownerId !== userId) {
		throw new NotFoundError("Timeseries");
	}

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
 * List the user's alert rules, newest first.
 */
export async function listAlertRules(userId: string): Promise<AlertRule[]> {
	const rules = await prisma.alertRule.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});
	return rules.map(mapRule);
}

/**
 * Update an alert rule owned by `userId`. Returns null when the rule does
 * not exist or belongs to another user (404 in both cases — never disclose
 * other users' rule ids).
 */
export async function updateAlertRule(
	userId: string,
	ruleId: string,
	patch: {
		name?: string;
		description?: string;
		type?: AlertType;
		condition?: AlertCondition;
		severity?: AlertSeverity;
		enabled?: boolean;
		notificationChannels?: NotificationChannel[];
		cooldownMinutes?: number;
	},
): Promise<AlertRule | null> {
	const existing = await prisma.alertRule.findFirst({
		where: { id: ruleId, userId },
	});
	if (!existing) return null;

	if (patch.condition !== undefined) {
		assertConditionEvaluable(patch.condition);
	}

	const data: Prisma.AlertRuleUpdateInput = {};
	if (patch.name !== undefined) data.name = patch.name;
	if (patch.description !== undefined) data.description = patch.description;
	if (patch.type !== undefined) data.type = patch.type;
	if (patch.enabled !== undefined) data.enabled = patch.enabled;
	if (patch.condition !== undefined) data.conditions = toJsonInput(patch.condition);
	if (patch.severity !== undefined) data.severity = patch.severity;
	if (patch.notificationChannels !== undefined) {
		data.channels = toJsonInput(patch.notificationChannels);
	}
	if (patch.cooldownMinutes !== undefined) data.cooldownMinutes = patch.cooldownMinutes;

	const updated = await prisma.alertRule.update({ where: { id: existing.id }, data });
	return mapRule(updated);
}

/**
 * Delete an alert rule owned by `userId`. Returns false when the rule does
 * not exist or belongs to another user.
 */
export async function deleteAlertRule(userId: string, ruleId: string): Promise<boolean> {
	const result = await prisma.alertRule.deleteMany({ where: { id: ruleId, userId } });
	return result.count > 0;
}

/**
 * Evaluate all enabled alert rules against the latest data.
 *
 * This is the missing piece that made alert rules a dead-end feature: rules
 * could be created but nothing evaluated them. This function:
 *  1. Loads all enabled rules (with cooldown respected via lastTriggeredAt).
 *  2. For each rule's timeseries, fetches the latest price value.
 *  3. Checks the threshold condition (e.g. value > X).
 *  4. On a match outside cooldown, creates an Alert row + updates lastTriggeredAt.
 *
 * Designed to run on a schedule (called from server.ts every few minutes).
 *
 * @returns number of rules that triggered this run
 */
export async function evaluateAlertRules(): Promise<number> {
	const now = new Date();

	// Load enabled rules. We can't express cooldown in SQL cleanly (it's
	// lastTriggeredAt + cooldownMinutes per row), so load all enabled and
	// check cooldown per-row in code.
	const rules = await prisma.alertRule.findMany({
		where: { enabled: true },
		select: {
			id: true,
			userId: true,
			timeseriesId: true,
			name: true,
			type: true,
			conditions: true,
			severity: true,
			cooldownMinutes: true,
			lastTriggeredAt: true,
		},
	});

	let triggered = 0;
	let skippedCooldown = 0;
	let skippedNoData = 0;

	// Pre-fetch commodity slugs for all rule timeseriesIds so we can apply
	// authoritative-source resolution per commodity (round-67). Without this,
	// conflict commodities (brl_usd/corn_cme/natural_gas_cme) evaluate alert
	// thresholds against whichever source wrote most recently — e.g. a brl_usd
	// threshold set for the ~5.0 fred scale would wrongly fire (or never fire)
	// against exchange_rate_api's inverted ~0.2.
	const ruleCommodityIds = [...new Set(rules.map((r) => r.timeseriesId))];
	const commoditySlugs = await prisma.commodity.findMany({
		where: { id: { in: ruleCommodityIds } },
		select: { id: true, slug: true },
	});

	// Round-87: batch-fetch the latest daily price per commodity via DISTINCT ON
	// (one query total) instead of a findFirst per rule inside the loop (N
	// queries). Uses the shared authoritative-source-aware helper so conflict
	// commodities read the correct source.
	const latestPrices = await batchLatestPrices(commoditySlugs);

	for (const rule of rules) {
		try {
			// Cooldown: skip if last triggered within cooldownMinutes
			if (rule.lastTriggeredAt) {
				const cooldownMs = rule.cooldownMinutes * 60 * 1000;
				if (rule.lastTriggeredAt.getTime() + cooldownMs > now.getTime()) {
					skippedCooldown++;
					continue;
				}
			}

			// Read the pre-fetched latest price (round-87: was a per-rule
			// findFirst inside the loop — now batched above via DISTINCT ON).
			const latestPrice = latestPrices.get(rule.timeseriesId);

			if (!latestPrice) {
				skippedNoData++;
				continue;
			}

			const value = Number(latestPrice.close);
			const condition = parseJsonField<AlertCondition>(rule.conditions);

			// Evaluate the threshold condition
			if (!isConditionMet(condition, value)) continue;

			// Condition met — create the alert
			await prisma.alert.create({
				data: {
					userId: rule.userId,
					timeseriesId: rule.timeseriesId,
					alertRuleId: rule.id,
					type: rule.type as "ANOMALY" | "FORECAST_READY" | "SYSTEM",
					severity: rule.severity as "INFO" | "WARNING" | "ERROR",
					message: buildAlertMessage(rule.name, condition, value),
					metadata: toJsonInput({
						ruleName: rule.name,
						value,
						condition,
						priceDate: latestPrice.date,
					}),
				},
			});

			// Update lastTriggeredAt to enforce cooldown on next run
			await prisma.alertRule.update({
				where: { id: rule.id },
				data: { lastTriggeredAt: now },
			});

			triggered++;
			logger.info(
				`[ALERT_RULE] Triggered "${rule.name}" (value ${value} met condition) for user ${rule.userId}`,
			);
		} catch (error) {
			// Individual rule failures must not abort the batch
			logger.error(`[ALERT_RULE] Failed to evaluate rule ${rule.id}: ${error}`);
		}
	}

	logger.info(
		`[ALERT_RULE] Evaluated ${rules.length} rules: ${triggered} triggered, ${skippedCooldown} in cooldown, ${skippedNoData} no data`,
	);

	return triggered;
}

/**
 * Check whether a value satisfies an alert condition.
 * Supports threshold-type rules with >, <, >=, <=, =, != operators.
 *
 * Exported so the truth-table regression test (alertRules.test.ts) exercises
 * the REAL production function rather than a locally-mirrored copy (which
 * drifted silently if this changed — a tautology). Pure function, no I/O.
 */
export function isConditionMet(condition: AlertCondition, value: number): boolean {
	if (condition.type !== "threshold") return false;

	const target = condition.threshold ?? condition.value;
	if (target == null || !Number.isFinite(target)) return false;

	switch (condition.operator) {
		case ">":
			return value > target;
		case "<":
			return value < target;
		case ">=":
			return value >= target;
		case "<=":
			return value <= target;
		case "=":
			return Math.abs(value - target) < 0.0001;
		case "!=":
			return Math.abs(value - target) >= 0.0001;
		default:
			return false;
	}
}

/** Build a human-readable alert message from the rule + condition. */
function buildAlertMessage(ruleName: string, condition: AlertCondition, value: number): string {
	const target = condition.threshold ?? condition.value;
	const op = condition.operator ?? "?";
	return `${ruleName}: ${value.toFixed(2)} ${op} ${target}`;
}

// ===========================================================================
// Alerts — CRUD + stats (was alerts.ts own code)
// ===========================================================================

// Re-export rule creation (the only live rule-management entry point)
// Re-export types

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
 * Get a single alert by id, owner-scoped. 404 covers both "missing" and
 * "not owned" so existence isn't disclosed cross-user.
 */
export async function getAlertById(userId: string, alertId: string) {
	const alert = await prisma.alert.findFirst({
		where: { id: alertId, userId },
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
	});

	if (!alert) {
		throw new NotFoundError("Alert");
	}

	return alert;
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
