/**
 * Alert Rules Service
 *
 * Manages alert rule creation, evaluation, and updates.
 * Uses AlertRule model from Prisma schema for persistent storage.
 */

import { prisma, logger } from '@/lib';
import type { Prisma } from '@prisma/client';
import { dispatchNotification, type NotificationChannel as ChannelType } from './notificationChannels';
import type {
  AlertRule,
  AlertCondition,
  AlertEvaluationData,
  TriggerAlertParams,
  NotificationChannel,
  AlertWithMetadata,
} from './alert-types';

type AlertType = 'ANOMALY' | 'FORECAST_READY' | 'SYSTEM';
type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR';

type PrismaAlertRule = Awaited<ReturnType<typeof prisma.alertRule.findUnique>> & {
  id: string;
};

function mapRule(rule: PrismaAlertRule): AlertRule {
  return {
    id: rule.id,
    userId: rule.userId,
    timeseriesId: rule.timeseriesId,
    name: rule.name,
    description: rule.description || undefined,
    type: rule.type as AlertType,
    condition: rule.conditions as unknown as AlertCondition,
    severity: rule.severity as AlertSeverity,
    enabled: rule.enabled,
    notificationChannels: rule.channels as unknown as NotificationChannel[],
    cooldownMinutes: rule.cooldownMinutes,
    lastTriggeredAt: rule.lastTriggeredAt || undefined,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt || rule.createdAt,
  };
}

/**
 * Adapt AlertWithMetadata + NotificationChannel to notificationChannels.ts interfaces
 */
async function sendNotification(channel: NotificationChannel, alert: AlertWithMetadata): Promise<void> {
  const payload = {
    type: 'anomaly' as const,
    severity: alert.severity === 'ERROR' ? 'critical' as const : alert.severity === 'WARNING' ? 'warning' as const : 'info' as const,
    commodityId: alert.timeseriesId,
    message: alert.message,
    data: (alert.metadata as Record<string, unknown>) ?? {},
    timestamp: alert.createdAt.toISOString(),
  };

  const channels: ChannelType[] = [channel.type as ChannelType];
  const emailRecipients = channel.type === 'email' && channel.config?.email ? [channel.config.email] : [];

  await dispatchNotification(payload, channels, emailRecipients);
}

/**
 * Create a new alert rule
 */
export async function createAlertRule(params: {
  userId: string;
  timeseriesId: string;
  name: string;
  type?: 'ANOMALY' | 'FORECAST_READY' | 'SYSTEM';
  condition: AlertCondition;
  severity?: 'INFO' | 'WARNING' | 'ERROR';
  notificationChannels: NotificationChannel[];
  cooldownMinutes?: number;
  description?: string;
}): Promise<AlertRule> {
  const {
    userId,
    timeseriesId,
    name,
    type = 'ANOMALY',
    condition,
    severity = 'WARNING',
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
      conditions: condition as unknown as Prisma.InputJsonValue,
      severity,
      channels: notificationChannels as unknown as Prisma.InputJsonValue,
      cooldownMinutes,
    },
  });

  logger.info(`[ALERT_RULE] Created alert rule ${rule.id} for user ${userId}`);

  return mapRule(rule);
}

/**
 * Get alert rule by ID
 */
export async function getAlertRule(id: string): Promise<AlertRule | null> {
  const rule = await prisma.alertRule.findUnique({
    where: { id },
  });

  if (!rule) return null;

  return mapRule(rule);
}

/**
 * List alert rules for a user
 */
export async function listAlertRules(userId: string, options?: {
  enabled?: boolean;
  timeseriesId?: string;
}): Promise<AlertRule[]> {
  const where: Prisma.AlertRuleWhereInput = { userId };
  
  if (options?.enabled !== undefined) {
    where.enabled = options.enabled;
  }
  
  if (options?.timeseriesId) {
    where.timeseriesId = options.timeseriesId;
  }

  const rules = await prisma.alertRule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return rules.map(rule => mapRule(rule));
}

/**
 * Update alert rule
 */
export async function updateAlertRule(
  id: string,
  updates: Partial<Omit<AlertRule, 'id' | 'userId' | 'timeseriesId' | 'createdAt'>>
): Promise<AlertRule> {
  const data: Prisma.AlertRuleUpdateInput = {};

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.type !== undefined) data.type = updates.type;
  if (updates.condition !== undefined) data.conditions = updates.condition as unknown as Prisma.InputJsonValue;
  if (updates.severity !== undefined) data.severity = updates.severity;
  if (updates.enabled !== undefined) data.enabled = updates.enabled;
  if (updates.notificationChannels !== undefined) data.channels = updates.notificationChannels as unknown as Prisma.InputJsonValue;
  if (updates.cooldownMinutes !== undefined) data.cooldownMinutes = updates.cooldownMinutes;
  if (updates.lastTriggeredAt !== undefined) data.lastTriggeredAt = updates.lastTriggeredAt;
  
  data.updatedAt = new Date();

  const rule = await prisma.alertRule.update({
    where: { id },
    data,
  });

  return mapRule(rule);
}

/**
 * Delete alert rule
 */
export async function deleteAlertRule(id: string): Promise<void> {
  await prisma.alertRule.delete({
    where: { id },
  });

  logger.info(`[ALERT_RULE] Deleted alert rule ${id}`);
}

/**
 * Evaluate an alert rule against data
 */
export async function evaluateAlertRule(
  rule: AlertRule,
  data: AlertEvaluationData
): Promise<boolean> {
  if (!rule.enabled) {
    return false;
  }

  // Check cooldown
  if (rule.lastTriggeredAt && rule.cooldownMinutes) {
    const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60 * 1000);
    if (new Date() < cooldownEnd) {
      return false;
    }
  }

  const { condition } = rule;
  let shouldTrigger = false;

  switch (condition.type) {
    case 'threshold':
      if (condition.operator && condition.value !== undefined) {
        shouldTrigger = evaluateThreshold(data.value, condition.operator, condition.value);
      }
      break;

    case 'anomaly':
      if (data.isAnomaly) {
        shouldTrigger = true;
      }
      break;

    case 'pattern':
      // Pattern-based detection (e.g., flatline, sudden change)
      if (condition.pattern === 'flatline' && data.isFlatline) {
        shouldTrigger = true;
      }
      break;

    default:
      logger.warn(`[ALERT_RULE] Unknown condition type: ${condition.type}`);
  }

  return shouldTrigger;
}

/**
 * Evaluate threshold condition
 */
function evaluateThreshold(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '=':
    case '==':
      return value === threshold;
    case '!=':
      return value !== threshold;
    default:
      return false;
  }
}

/**
 * Trigger an alert based on a rule
 */
export async function triggerAlert(params: TriggerAlertParams): Promise<void> {
  const { ruleId, alertData } = params;

  // Get rule details first (for metrics)
  const rule = await getAlertRule(ruleId);
  if (!rule) {
    logger.error(`[ALERT_RULE] Rule ${ruleId} not found`);
    return;
  }

  // Update last triggered time
  await prisma.alertRule.update({
    where: { id: ruleId },
    data: { lastTriggeredAt: new Date() },
  });

  // Create alert
  const alertRecord = await prisma.alert.create({
    data: {
      userId: rule.userId,
      timeseriesId: rule.timeseriesId,
      alertRuleId: ruleId,
      type: rule.type as AlertType,
      severity: rule.severity as AlertSeverity,
      message: `Alert triggered: ${rule.name}`,
      metadata: alertData as Prisma.InputJsonValue,
    },
  });

  // Convert to AlertWithMetadata format
  const alert: AlertWithMetadata = {
    id: alertRecord.id,
    userId: alertRecord.userId,
    timeseriesId: alertRecord.timeseriesId,
    type: alertRecord.type,
    severity: alertRecord.severity,
    message: alertRecord.message,
    metadata: alertRecord.metadata as Record<string, any> | null,
    isRead: alertRecord.isRead,
    sentAt: alertRecord.sentAt || undefined,
    createdAt: alertRecord.createdAt,
    rule: {
      id: rule.id,
      name: rule.name,
    },
  };

  // Send notifications
  for (const channel of rule.notificationChannels) {
    if (channel.enabled) {
      await sendNotification(channel, alert);
    }
  }

  logger.info(`[ALERT_RULE] Triggered alert ${alert.id} for rule ${ruleId}`);
}

/**
 * Get alert rules for evaluation
 */
export async function getActiveAlertRules(
  timeseriesId?: string
): Promise<AlertRule[]> {
  const where: Prisma.AlertRuleWhereInput = {
    enabled: true,
  };

  if (timeseriesId) {
    where.timeseriesId = timeseriesId;
  }

  const rules = await prisma.alertRule.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return rules.map(rule => mapRule(rule));
}
