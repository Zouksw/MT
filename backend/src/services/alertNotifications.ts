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

import type { Prisma } from "@prisma/client";
import type { Server } from "socket.io";
import { logger, prisma } from "@/lib";
import { dispatchNotification, getConfiguredChannels } from "./notificationChannels";
import type { Direction } from "./tradingSignals";

export interface NotificationEvent {
	type: "anomaly" | "forecast_change" | "forecast_ready";
	severity: "info" | "warning" | "critical";
	commodityId: string;
	message: string;
	data: Record<string, unknown>;
	timestamp: string;
}

// Track last forecast direction per commodity for change detection
const lastDirections = new Map<string, Direction>();

const DIRECTION_LABEL: Record<Direction, string> = {
	up: "上涨",
	down: "下跌",
	flat: "横盘",
};

/**
 * Check for forecast-direction changes and emit notifications.
 * Fires when the consensus direction flips (e.g. flat → up).
 */
export async function checkSignalChange(
	commodityId: string,
	newDirection: Direction,
	confidence: number,
	io?: Server,
): Promise<void> {
	const previous = lastDirections.get(commodityId);

	// Update tracked direction
	lastDirections.set(commodityId, newDirection);

	if (!previous || previous === newDirection) return;

	// Direction changed — create notification
	const event: NotificationEvent = {
		type: "forecast_change",
		severity: newDirection === "flat" ? "info" : confidence > 0.7 ? "critical" : "warning",
		commodityId,
		message: `预测方向变化: ${DIRECTION_LABEL[previous]} → ${DIRECTION_LABEL[newDirection]} (置信度: ${Math.round(confidence * 100)}%)`,
		data: { previousDirection: previous, newDirection, confidence },
		timestamp: new Date().toISOString(),
	};

	await emitNotification(event, io);
}

/**
 * Emit notification via WebSocket + persist to alerts
 */
async function emitNotification(event: NotificationEvent, io?: Server): Promise<void> {
	// 1. WebSocket broadcast
	if (io) {
		try {
			io.to(`commodity:${event.commodityId}`).emit("notification", event);
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
				where: { role: "ADMIN" },
				select: { id: true },
			});

			if (admins.length > 0) {
				await prisma.alert.createMany({
					data: admins.map((admin) => ({
						userId: admin.id,
						timeseriesId: timeseries.id,
						type:
							event.type === "anomaly"
								? ("ANOMALY" as const)
								: event.type === "forecast_change"
									? ("FORECAST_READY" as const)
									: ("SYSTEM" as const),
						severity:
							event.severity === "critical"
								? ("ERROR" as const)
								: event.severity === "warning"
									? ("WARNING" as const)
									: ("INFO" as const),
						message: event.message,
						metadata: event.data as unknown as Prisma.InputJsonValue,
					})),
				});
			}
		}
	} catch (error) {
		logger.error(`Failed to persist notification: ${error}`);
	}

	logger.info(`Notification [${event.severity}]: ${event.message}`);

	// 3. Dispatch through email/Slack channels (non-blocking for warning/info)
	if (event.severity === "critical" || event.severity === "warning") {
		try {
			const channels = getConfiguredChannels().filter((c) => c !== "websocket");

			if (channels.length > 0) {
				// Get admin emails for email channel
				let emailRecipients: string[] = [];
				if (channels.includes("email")) {
					const admins = await prisma.user.findMany({
						where: { role: "ADMIN" },
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
