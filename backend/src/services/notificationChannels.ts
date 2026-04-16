/**
 * Notification Channel Service
 *
 * Delivers notifications through multiple channels:
 * - Email (via nodemailer SMTP)
 * - Slack (via incoming webhook)
 *
 * Channel selection is based on user notification preferences.
 * Falls back gracefully when a channel is unavailable.
 */

import nodemailer from 'nodemailer';
import { logger } from '@/lib';

export type NotificationChannel = 'email' | 'slack' | 'websocket';

export interface ChannelConfig {
  email: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromAddress: string;
  };
  slack: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
  };
}

export interface NotificationPayload {
  type: 'anomaly' | 'signal_change' | 'forecast_ready';
  severity: 'info' | 'warning' | 'critical';
  commodityId: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Lazy-initialized transport
let emailTransport: nodemailer.Transporter | null = null;

/**
 * Get email transport (singleton)
 */
function getEmailTransport(): nodemailer.Transporter | null {
  if (emailTransport) return emailTransport;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn('SMTP not configured — email notifications disabled');
    return null;
  }

  emailTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return emailTransport;
}

/**
 * Get Slack webhook URL from environment
 */
function getSlackConfig(): { webhookUrl: string; channel: string } | null {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return null;
  }
  return {
    webhookUrl,
    channel: process.env.SLACK_CHANNEL || '#alerts',
  };
}

/**
 * Send notification via email
 */
async function sendEmail(
  to: string[],
  payload: NotificationPayload
): Promise<boolean> {
  const transport = getEmailTransport();
  if (!transport || to.length === 0) return false;

  const fromAddress = process.env.SMTP_FROM || 'noreply@iotdb-enhanced.local';

  const severityEmoji = payload.severity === 'critical'
    ? '🔴'
    : payload.severity === 'warning'
    ? '🟡'
    : '🔵';

  const subject = `${severityEmoji} [${payload.severity.toUpperCase()}] ${payload.type.replace('_', ' ')} — ${payload.commodityId}`;

  try {
    await transport.sendMail({
      from: `"IoTDB Alerts" <${fromAddress}>`,
      to: to.join(', '),
      subject,
      text: payload.message + '\n\n' + JSON.stringify(payload.data, null, 2),
      html: `
        <h2>${severityEmoji} ${payload.type.replace('_', ' ').toUpperCase()}</h2>
        <p><strong>Commodity:</strong> ${payload.commodityId}</p>
        <p><strong>Severity:</strong> ${payload.severity}</p>
        <p><strong>Message:</strong> ${payload.message}</p>
        <p><strong>Time:</strong> ${payload.timestamp}</p>
        <hr />
        <pre>${JSON.stringify(payload.data, null, 2)}</pre>
      `,
    });

    logger.info(`Email notification sent to ${to.length} recipients`);
    return true;
  } catch (error) {
    logger.error(`Email notification failed: ${error}`);
    return false;
  }
}

/**
 * Send notification via Slack webhook
 */
async function sendSlack(
  payload: NotificationPayload
): Promise<boolean> {
  const config = getSlackConfig();
  if (!config) return false;

  const color = payload.severity === 'critical'
    ? '#FF0000'
    : payload.severity === 'warning'
    ? '#FFA500'
    : '#36A64F';

  const body = {
    channel: config.channel,
    attachments: [
      {
        color,
        title: `${payload.type.replace('_', ' ').toUpperCase()} — ${payload.commodityId}`,
        text: payload.message,
        fields: [
          { title: 'Severity', value: payload.severity, short: true },
          { title: 'Commodity', value: payload.commodityId, short: true },
          { title: 'Time', value: payload.timestamp, short: false },
        ],
        footer: 'IoTDB Enhanced Trading Platform',
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error(`Slack webhook returned ${response.status}`);
      return false;
    }

    logger.info('Slack notification sent');
    return true;
  } catch (error) {
    logger.error(`Slack notification failed: ${error}`);
    return false;
  }
}

/**
 * Dispatch notification through all configured channels
 *
 * @param payload - The notification event
 * @param channels - Which channels to use
 * @param emailRecipients - Email addresses (required if channels includes 'email')
 * @returns Results per channel
 */
export async function dispatchNotification(
  payload: NotificationPayload,
  channels: NotificationChannel[],
  emailRecipients: string[] = []
): Promise<Record<NotificationChannel, boolean>> {
  const results: Record<string, boolean> = {};

  const promises = channels.map(async (channel) => {
    switch (channel) {
      case 'email':
        results.email = await sendEmail(emailRecipients, payload);
        break;
      case 'slack':
        results.slack = await sendSlack(payload);
        break;
      case 'websocket':
        // WebSocket dispatching is handled by alertNotifications.ts
        results.websocket = true;
        break;
    }
  });

  await Promise.allSettled(promises);

  return results as Record<NotificationChannel, boolean>;
}

/**
 * Check which channels are configured
 */
export function getConfiguredChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = ['websocket'];

  if (getEmailTransport()) {
    channels.push('email');
  }

  if (getSlackConfig()) {
    channels.push('slack');
  }

  return channels;
}
