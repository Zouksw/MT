/**
 * Alert Notification Service
 *
 * Sends notifications for:
 * 1. Anomaly alerts (price deviation, model disagreement)
 * 2. Trading signal changes (BUY→SELL, etc.)
 * 3. Forecast ready notifications
 *
 * Channels: WebSocket (real-time), Email (SMTP), Slack (webhook)
 */

import { prisma } from '@/lib';
import { logger } from '@/lib';
import type { SignalType } from './tradingSignals';
import { dispatchNotification, getConfiguredChannels } from './notificationChannels';

export interface NotificationEvent {
  type: 'anomaly' | 'signal_change' | 'forecast_ready';
  severity: 'info' | 'warning' | 'critical';
  commodityId: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface SignalChange {
  commodityId: string;
  previousSignal: SignalType;
  newSignal: SignalType;
  confidence: number;
}

// Track last signals per commodity for change detection
const lastSignals = new Map<string, SignalType>();

/**
 * Check for signal changes and emit notifications
 */
export async function checkSignalChange(
  commodityId: string,
  newSignal: SignalType,
  confidence: number,
  io?: any
): Promise<void> {
  const previous = lastSignals.get(commodityId);

  // Update tracked signal
  lastSignals.set(commodityId, newSignal);

  if (!previous || previous === newSignal) return;

  // Signal changed — create notification
  const event: NotificationEvent = {
    type: 'signal_change',
    severity: newSignal === 'HOLD' ? 'info' : confidence > 0.7 ? 'critical' : 'warning',
    commodityId,
    message: `Signal changed: ${previous} → ${newSignal} (confidence: ${Math.round(confidence * 100)}%)`,
    data: { previousSignal: previous, newSignal, confidence },
    timestamp: new Date().toISOString(),
  };

  await emitNotification(event, io);
}

/**
 * Create anomaly notification
 */
export async function notifyAnomaly(
  commodityId: string,
  anomalyType: string,
  message: string,
  severity: 'info' | 'warning' | 'critical' = 'warning',
  data: Record<string, unknown> = {},
  io?: any
): Promise<void> {
  const event: NotificationEvent = {
    type: 'anomaly',
    severity,
    commodityId,
    message: `[${anomalyType}] ${message}`,
    data: { anomalyType, ...data },
    timestamp: new Date().toISOString(),
  };

  await emitNotification(event, io);
}

/**
 * Create forecast ready notification
 */
export async function notifyForecastReady(
  commodityId: string,
  modelCount: number,
  io?: any
): Promise<void> {
  const event: NotificationEvent = {
    type: 'forecast_ready',
    severity: 'info',
    commodityId,
    message: `Forecast updated: ${modelCount} models available`,
    data: { modelCount },
    timestamp: new Date().toISOString(),
  };

  await emitNotification(event, io);
}

/**
 * Emit notification via WebSocket + persist to alerts
 */
async function emitNotification(event: NotificationEvent, io?: any): Promise<void> {
  // 1. WebSocket broadcast
  if (io) {
    try {
      io.to(`commodity:${event.commodityId}`).emit('notification', event);
      // Also broadcast to all authenticated admin users
      io.emit(`alert:${event.type}`, event);
    } catch (error) {
      logger.warn(`WebSocket notification failed: ${error}`);
    }
  }

  // 2. Create alert in database for persistence
  try {
    // Find the timeseries for this commodity
    const timeseries = await prisma.timeseries.findFirst({
      where: { dataset: { slug: event.commodityId } },
    });

    if (timeseries) {
      // Find admin users to notify
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      if (admins.length > 0) {
        await prisma.alert.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            timeseriesId: timeseries.id,
            type: event.type === 'anomaly'
              ? 'ANOMALY' as const
              : event.type === 'signal_change'
              ? 'FORECAST_READY' as const
              : 'SYSTEM' as const,
            severity: event.severity === 'critical'
              ? 'ERROR' as const
              : event.severity === 'warning'
              ? 'WARNING' as const
              : 'INFO' as const,
            message: event.message,
            metadata: event.data as any,
          })),
        });
      }
    }
  } catch (error) {
    logger.error(`Failed to persist notification: ${error}`);
  }

  logger.info(`Notification [${event.severity}]: ${event.message}`);

  // 3. Dispatch through email/Slack channels (non-blocking for warning/info)
  if (event.severity === 'critical' || event.severity === 'warning') {
    try {
      const channels = getConfiguredChannels().filter((c) => c !== 'websocket');

      if (channels.length > 0) {
        // Get admin emails for email channel
        let emailRecipients: string[] = [];
        if (channels.includes('email')) {
          const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { email: true },
          });
          emailRecipients = admins.map((a) => a.email);
        }

        // Don't await — fire and forget to avoid blocking the request
        dispatchNotification(event, channels, emailRecipients).catch((err) => {
          logger.error(`Channel dispatch failed: ${err}`);
        });
      }
    } catch (error) {
      logger.error(`Channel dispatch setup failed: ${error}`);
    }
  }
}
