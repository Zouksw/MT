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

import nodemailer from "nodemailer";
import { logger } from "@/lib";

// "websocket" was removed from the channel union (round-112) together with
// the zero-consumer Socket.IO server — it was a no-op case that always
// returned true without delivering anything.
export type NotificationChannel = "email" | "slack";

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
	type: "anomaly" | "forecast_change" | "forecast_ready";
	severity: "info" | "warning" | "critical";
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
	const port = parseInt(process.env.SMTP_PORT || "587", 10);
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	if (!host || !user || !pass) {
		logger.warn("SMTP not configured — email notifications disabled");
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
		channel: process.env.SLACK_CHANNEL || "#alerts",
	};
}

/**
 * Send notification via email
 */
async function sendEmail(to: string[], payload: NotificationPayload): Promise<boolean> {
	const transport = getEmailTransport();
	if (!transport || to.length === 0) return false;

	const fromAddress = process.env.SMTP_FROM || "noreply@mt.local";

	const severityEmoji =
		payload.severity === "critical" ? "🔴" : payload.severity === "warning" ? "🟡" : "🔵";

	const subject = `${severityEmoji} [${payload.severity.toUpperCase()}] ${payload.type.replace("_", " ")} — ${payload.commodityId}`;

	try {
		await transport.sendMail({
			from: `"MT Alerts" <${fromAddress}>`,
			to: to.join(", "),
			subject,
			text: `${payload.message}\n\n${JSON.stringify(payload.data, null, 2)}`,
			html: `
        <h2>${severityEmoji} ${payload.type.replace("_", " ").toUpperCase()}</h2>
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
async function sendSlack(payload: NotificationPayload): Promise<boolean> {
	const config = getSlackConfig();
	if (!config) return false;

	const color =
		payload.severity === "critical"
			? "#FF0000"
			: payload.severity === "warning"
				? "#FFA500"
				: "#36A64F";

	const body = {
		channel: config.channel,
		attachments: [
			{
				color,
				title: `${payload.type.replace("_", " ").toUpperCase()} — ${payload.commodityId}`,
				text: payload.message,
				fields: [
					{ title: "Severity", value: payload.severity, short: true },
					{ title: "Commodity", value: payload.commodityId, short: true },
					{ title: "Time", value: payload.timestamp, short: false },
				],
				footer: "MT",
				ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
			},
		],
	};

	try {
		const response = await fetch(config.webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			logger.error(`Slack webhook returned ${response.status}`);
			return false;
		}

		logger.info("Slack notification sent");
		return true;
	} catch (error) {
		logger.error(`Slack notification failed: ${error}`);
		return false;
	}
}

/**
 * Ops email (round-115): plain operational mail (data digest) to the
 * address(es) in OPS_ALERT_EMAIL. Reuses the user-alert transport; returns
 * false when SMTP or the recipient env is not configured — the daily digest
 * job treats that as a no-op, never an error.
 */
export async function sendOpsEmail(subject: string, text: string): Promise<boolean> {
	const transport = getEmailTransport();
	const to = (process.env.OPS_ALERT_EMAIL ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (!transport || to.length === 0) return false;

	const fromAddress = process.env.SMTP_FROM || "noreply@mt.local";
	try {
		await transport.sendMail({
			from: `"MT Ops" <${fromAddress}>`,
			to: to.join(", "),
			subject,
			text,
		});
		logger.info(`Ops email sent to ${to.length} recipient(s): ${subject}`);
		return true;
	} catch (err) {
		logger.warn(`Ops email failed: ${err instanceof Error ? err.message : String(err)}`);
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
	emailRecipients: string[] = [],
): Promise<Record<NotificationChannel, boolean>> {
	const results: Record<string, boolean> = {};

	const promises = channels.map(async (channel) => {
		switch (channel) {
			case "email":
				results.email = await sendEmail(emailRecipients, payload);
				break;
			case "slack":
				results.slack = await sendSlack(payload);
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
	const channels: NotificationChannel[] = [];

	if (getEmailTransport()) {
		channels.push("email");
	}

	if (getSlackConfig()) {
		channels.push("slack");
	}

	return channels;
}
