/**
 * Alert Rules Service
 *
 * Manages alert rule creation, lookup, and scheduled evaluation. The
 * evaluation pipeline (evaluateAlertRules) runs on a timer from server.ts,
 * checking each enabled rule's latest price against its threshold condition
 * and creating Alert rows (with cooldown enforcement) on matches.
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { AlertCondition, AlertRule, NotificationChannel } from "./alert-types";

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

			// Fetch the latest price for this rule's timeseries
			const latestPrice = await prisma.commodityPrice.findFirst({
				where: { commodityId: rule.timeseriesId, interval: "daily" },
				orderBy: { date: "desc" },
				select: { close: true, date: true },
			});

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
 */
function isConditionMet(condition: AlertCondition, value: number): boolean {
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
