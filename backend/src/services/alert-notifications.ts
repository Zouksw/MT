/**
 * Alert Notification Service
 *
 * Handles sending alerts through various channels (email, webhook, Slack).
 *
 * NOTE: This service and @/services/notificationChannels.ts both implement
 * email/Slack/webhook sending independently. They serve different callers:
 *   - This file: called by @/services/tradingSignals.ts (signal pipeline)
 *   - notificationChannels.ts: called by @/services/alert-rules.ts (alert rules pipeline)
 * Post-launch TODO: Merge into a single unified notification pipeline.
 */

import nodemailer from 'nodemailer';
import { logger } from '@/lib';
import type {
  NotificationChannel,
  AlertWithMetadata,
} from './alert-types';

/**
 * Send notification through specified channel
 */
export async function sendNotification(
  channel: NotificationChannel,
  alert: AlertWithMetadata
): Promise<void> {
  try {
    const config = channel.config || {};
    switch (channel.type) {
      case 'email':
        await sendEmailNotification(config.email!, alert);
        break;
      case 'webhook':
        await sendWebhookNotification(config.webhookUrl!, alert);
        break;
      case 'slack':
        await sendSlackNotification(config.slackWebhookUrl!, alert);
        break;
    }
  } catch (error) {
    logger.error(`Failed to send ${channel.type} notification for alert ${alert.id}: ${error}`);
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  email: string,
  alert: AlertWithMetadata
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });

  const severityColors = {
    INFO: '#2196F3',
    WARNING: '#FF9800',
    ERROR: '#F44336',
  };

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@iotdb-enhanced.com',
    to: email,
    subject: `[${alert.severity}] ${alert.type}: ${alert.message}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${severityColors[alert.severity as keyof typeof severityColors] || '#666'};">
          ${alert.type}
        </h2>
        <p><strong>Severity:</strong> ${alert.severity}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        ${alert.timeseriesId ? `<p><strong>Time Series:</strong> ${alert.timeseriesId}</p>` : ''}
        <p><strong>Time:</strong> ${new Date(alert.createdAt).toLocaleString()}</p>
        ${alert.metadata && typeof alert.metadata === 'object' && !Array.isArray(alert.metadata)
          ? `<pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${JSON.stringify(alert.metadata, null, 2)}</pre>`
          : ''}
        <p style="color: #666; font-size: 12px;">This is an automated alert from IoTDB Enhanced Platform.</p>
      </div>
    `,
  });
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(
  webhookUrl: string,
  alert: AlertWithMetadata
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      alert,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(
  webhookUrl: string,
  alert: AlertWithMetadata
): Promise<void> {
  const severityColors = {
    INFO: '#2196F3',
    WARNING: '#FF9800',
    ERROR: '#F44336',
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      attachments: [
        {
          color: severityColors[alert.severity as keyof typeof severityColors] || '#666',
          title: `Alert: ${alert.type}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity,
              short: true,
            },
            {
              title: 'Time',
              value: new Date(alert.createdAt).toLocaleString(),
              short: true,
            },
          ],
          footer: 'IoTDB Enhanced Platform',
        },
      ],
    }),
  });
}
