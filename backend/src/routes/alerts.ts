/**
 * Alerts Routes
 * Endpoints for managing alerts and notifications
 */

import { type Response, Router } from "express";
import { success } from "@/lib/response";
import { type AuthRequest, authenticate } from "@/middleware/auth";
import { asyncHandler, NotFoundError, UnauthorizedError } from "@/middleware/errorHandler";
import { validate } from "@/middleware/security";
import { limitSchema } from "@/schemas/common";
import {
	alertSchemas,
	createAlertRule,
	deleteAlert,
	deleteAlertRule,
	getAlertById,
	getAlertStats,
	listAlertRules,
	listAlerts,
	markAlertAsRead,
	markAllAlertsAsRead,
	updateAlertRule,
} from "@/services/alerts";

const router = Router();

/**
 * @openapi
 * /api/alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: List all alerts
 *     description: Retrieves alerts for the authenticated user with optional filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean }
 *         description: Show only unread alerts
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *         description: Filter by alert type
 *       - in: query
 *         name: severity
 *         schema: { type: string }
 *         description: Filter by severity
 *     responses:
 *       200:
 *         description: List of alerts
 *       401:
 *         description: Not authenticated
 */
/**
 * GET /api/alerts
 * List all alerts for the authenticated user
 */
router.get(
	"/",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const { unreadOnly, type, severity } = req.query;
		const params = limitSchema.parse(req.query);

		const result = await listAlerts(req.userId, {
			unreadOnly: unreadOnly === "true",
			type: type as "ANOMALY" | "FORECAST_READY" | "SYSTEM" | undefined,
			severity: severity as "INFO" | "WARNING" | "ERROR" | undefined,
			limit: params.limit,
			offset: 0,
		});

		return success(res, result);
	}),
);

/**
 * @openapi
 * /api/alerts/stats:
 *   get:
 *     tags: [Alerts]
 *     summary: Get alert statistics
 *     description: Returns alert statistics for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert statistics
 *       401:
 *         description: Not authenticated
 */
/**
 * GET /api/alerts/stats
 * Get alert statistics for the authenticated user
 */
router.get(
	"/stats",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const stats = await getAlertStats(req.userId);

		return success(res, stats);
	}),
);

/**
 * @openapi
 * /api/alerts/rules:
 *   post:
 *     tags: [Alerts]
 *     summary: Create an alert rule
 *     description: Creates a new alert rule for a time series with specified conditions and notification settings.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeseriesId, name, type, condition, severity]
 *             properties:
 *               timeseriesId:
 *                 type: string
 *               name:
 *                 type: string
 *                 example: High Temperature Alert
 *               type:
 *                 type: string
 *                 description: Alert rule type
 *               condition:
 *                 type: object
 *                 description: Rule condition configuration
 *               severity:
 *                 type: string
 *                 enum: [INFO, WARNING, ERROR, CRITICAL]
 *               notificationChannels:
 *                 type: array
 *                 items: { type: string }
 *               cooldownMinutes:
 *                 type: integer
 *                 description: Minimum time between repeated alerts
 *                 example: 30
 *     responses:
 *       201:
 *         description: Alert rule created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
/**
 * POST /api/alerts/rules
 * Create a new alert rule
 */
router.post(
	"/rules",
	authenticate,
	validate(alertSchemas.createRule),
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const { timeseriesId, name, type, condition, severity, notificationChannels, cooldownMinutes } =
			req.body;

		const rule = await createAlertRule({
			userId: req.userId,
			timeseriesId,
			name,
			type,
			condition,
			severity,
			notificationChannels,
			cooldownMinutes,
		});

		return success(res, rule, 201);
	}),
);

/**
 * GET /api/alerts/rules
 * List the authenticated user's alert rules
 *
 * The rules page previously "listed" rules by reading
 * user.preferences.alertRules from /api/auth/me — a source nothing ever
 * writes (rules live in the alertRule table), so the table was permanently
 * empty even after a successful create.
 */
router.get(
	"/rules",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const rules = await listAlertRules(req.userId);

		return success(res, { rules, total: rules.length });
	}),
);

/**
 * PATCH /api/alerts/rules/:id
 * Update one of the user's own alert rules (partial; `enabled`-only bodies
 * drive the UI toggle). Non-existent or foreign rule ids → 404.
 */
router.patch(
	"/rules/:id",
	authenticate,
	validate(alertSchemas.updateRule),
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const rule = await updateAlertRule(req.userId, req.params.id, req.body);
		if (!rule) {
			throw new NotFoundError("Alert rule not found");
		}

		return success(res, rule);
	}),
);

/**
 * DELETE /api/alerts/rules/:id
 * Delete one of the user's own alert rules. Non-existent or foreign rule
 * ids → 404 (deleteMany scoped to userId, so cross-user deletes are a no-op).
 */
router.delete(
	"/rules/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const deleted = await deleteAlertRule(req.userId, req.params.id);
		if (!deleted) {
			throw new NotFoundError("Alert rule not found");
		}

		return success(res, { id: req.params.id, deleted: true });
	}),
);

/**
 * @openapi
 * /api/alerts/{id}/read:
 *   patch:
 *     tags: [Alerts]
 *     summary: Mark an alert as read
 *     description: Marks a specific alert as read for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert marked as read
 *       401:
 *         description: Not authenticated
 */
/**
 * PATCH /api/alerts/:id/read
 * Mark an alert as read
 */
router.patch(
	"/:id/read",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const { id } = req.params;

		const result = await markAlertAsRead(req.userId, id);

		return success(res, result);
	}),
);

/**
 * @openapi
 * /api/alerts/read-all:
 *   patch:
 *     tags: [Alerts]
 *     summary: Mark all alerts as read
 *     description: Marks all unread alerts as read for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All alerts marked as read
 *       401:
 *         description: Not authenticated
 */
/**
 * PATCH /api/alerts/read-all
 * Mark all alerts as read
 */
router.patch(
	"/read-all",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const result = await markAllAlertsAsRead(req.userId);

		return success(res, result);
	}),
);

/**
 * @openapi
 * /api/alerts/{id}:
 *   delete:
 *     tags: [Alerts]
 *     summary: Delete an alert
 *     description: Permanently deletes an alert.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert deleted successfully
 *       401:
 *         description: Not authenticated
 */
/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const { id } = req.params;

		const result = await deleteAlert(req.userId, id);

		return success(res, result);
	}),
);

/**
 * GET /api/alerts/:id - Alert detail
 *
 * Registered last so it cannot swallow the literal routes above (/stats,
 * /rules). The /alerts/show/[id] page has always fetched here; until this
 * route existed the page 404'd for every alert id (round-107 e2e audit).
 */
router.get(
	"/:id",
	authenticate,
	asyncHandler(async (req: AuthRequest, res: Response) => {
		if (!req.userId) {
			throw new UnauthorizedError();
		}

		const alert = await getAlertById(req.userId, req.params.id);

		// Bare object (not { alert }): the page's useOne unwrap reads data.data
		// and expects the alert fields directly.
		return success(res, alert);
	}),
);

export default router;
