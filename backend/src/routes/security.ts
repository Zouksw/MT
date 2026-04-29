/**
 * Security Routes
 *
 * Handles security-related endpoints including audit logs
 */

import { Router, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma, logger } from '@/lib';
import { authenticate, type AuthRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { error, success, forbidden } from '@/lib/response';

const router = Router();

/**
 * Incoming audit log from frontend
 */
interface IncomingAuditLog {
  event: string;
  timestamp?: string;
  sessionId: string;
  details?: Record<string, unknown>;
  severity: string;
  userAgent?: string;
  url?: string;
}

/**
 * Prisma where condition for SecurityAuditLog
 */
interface SecurityAuditLogWhere {
  userId?: string;
  event?: string;
  severity?: string;
  timestamp?: {
    gte?: Date;
    lte?: Date;
  };
}

/**
 * @openapi
 * /api/security/audit:
 *   post:
 *     tags: [Security]
 *     summary: Submit audit logs
 *     description: Receives and stores security audit logs from the frontend. Validates event types and severity levels.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [logs]
 *             properties:
 *               logs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [event, sessionId, severity]
 *                   properties:
 *                     event:
 *                       type: string
 *                       enum: [LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, TOKEN_EXPIRED, TOKEN_REFRESHED, CSRF_VIOLATION, XSS_ATTEMPT, RATE_LIMIT_EXCEEDED, PERMISSION_DENIED, SUSPICIOUS_ACTIVITY, INVALID_INPUT, API_ERROR, NETWORK_ERROR]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     sessionId:
 *                       type: string
 *                     details:
 *                       type: object
 *                     severity:
 *                       type: string
 *                       enum: [low, medium, high, critical]
 *                     userAgent:
 *                       type: string
 *                     url:
 *                       type: string
 *     responses:
 *       200:
 *         description: Audit logs recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer }
 *       400:
 *         description: Invalid logs format or validation error
 */
/**
 * POST /api/security/audit
 * Receives audit logs from the frontend
 */
router.post('/audit', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { logs } = req.body;

  // Validate request
  if (!Array.isArray(logs) || logs.length === 0) {
    return error(res, 'Invalid logs format', 400, 'VALIDATION_ERROR');
  }

  // Validate each log entry
  const validEvents = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'LOGOUT',
    'TOKEN_EXPIRED',
    'TOKEN_REFRESHED',
    'CSRF_VIOLATION',
    'XSS_ATTEMPT',
    'RATE_LIMIT_EXCEEDED',
    'PERMISSION_DENIED',
    'SUSPICIOUS_ACTIVITY',
    'INVALID_INPUT',
    'API_ERROR',
    'NETWORK_ERROR',
  ];

  const validSeverities = ['low', 'medium', 'high', 'critical'];

  for (const log of logs) {
    if (!log.event || !validEvents.includes(log.event)) {
      logger.warn('Invalid audit log event:', log.event);
      return error(res, `Invalid event: ${log.event}`, 400, 'VALIDATION_ERROR');
    }

    if (!log.sessionId) {
      return error(res, 'sessionId is required', 400, 'VALIDATION_ERROR');
    }

    if (!log.severity || !validSeverities.includes(log.severity)) {
      return error(res, `Invalid severity: ${log.severity}`, 400, 'VALIDATION_ERROR');
    }

    // Validate details is an object
    if (log.details && typeof log.details !== 'object') {
      return error(res, 'details must be an object', 400, 'VALIDATION_ERROR');
    }
  }

  // Get userId from authenticated user (if available)
  const userId = req.user?.id || null;

  // Prepare logs for database
  const processedLogs = logs.map((log: IncomingAuditLog) => ({
    event: log.event,
    timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
    userId,
    sessionId: log.sessionId,
    details: (log.details || {}) as Prisma.InputJsonValue,
    severity: log.severity,
    userAgent: log.userAgent || null,
    url: log.url || null,
  }));

  // Batch insert logs
  await prisma.securityAuditLog.createMany({
    data: processedLogs,
    skipDuplicates: true,
  });

  logger.info(`Received ${logs.length} audit logs`);

  return success(res, { count: logs.length });
}));

/**
 * @openapi
 * /api/security/audit:
 *   get:
 *     tags: [Security]
 *     summary: Get audit logs (admin only)
 *     description: Retrieves security audit logs with filtering and pagination. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         description: Filter by user ID
 *       - in: query
 *         name: event
 *         schema: { type: string }
 *         description: Filter by event type
 *       - in: query
 *         name: severity
 *         schema: { type: string }
 *         description: Filter by severity
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Audit logs with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items: { type: object }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         total: { type: integer }
 *                         pages: { type: integer }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
/**
 * GET /api/security/audit
 * Retrieves audit logs (admin only)
 */
router.get('/audit', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    userId,
    event,
    severity,
    startDate,
    endDate,
    page = '1',
    limit = '50',
  } = req.query;

  // Check if user is admin
  if (req.user?.role !== 'ADMIN') {
    return forbidden(res, 'Admin access required');
  }

  // Build query conditions
  const query: SecurityAuditLogWhere = {};

  if (userId) {
    query.userId = userId as string;
  }

  if (event) {
    query.event = event as string;
  }

  if (severity) {
    query.severity = severity as string;
  }

  if (startDate || endDate) {
    query.timestamp = {
      gte: startDate ? new Date(startDate as string) : undefined,
      lte: endDate ? new Date(endDate as string) : undefined,
    } as any;
  }

  // Parse pagination parameters
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Fetch logs with pagination
  const logs = await prisma.securityAuditLog.findMany({
    where: query,
    orderBy: { timestamp: 'desc' },
    take: limitNum,
    skip,
  });

  // Get total count for pagination
  const total = await prisma.securityAuditLog.count({ where: query });

  return success(res, {
    logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
}));

/**
 * @openapi
 * /api/security/audit/stats:
 *   get:
 *     tags: [Security]
 *     summary: Get audit log statistics (admin only)
 *     description: Returns aggregated security audit statistics grouped by event type and severity. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Audit statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     byEvent:
 *                       type: object
 *                       additionalProperties: { type: integer }
 *                     bySeverity:
 *                       type: object
 *                       additionalProperties: { type: integer }
 *                     recentCritical:
 *                       type: array
 *                       items: { type: object }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
/**
 * GET /api/security/audit/stats
 * Get audit log statistics
 */
router.get('/audit/stats', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  // Check if user is admin
  if (req.user?.role !== 'ADMIN') {
    return forbidden(res, 'Admin access required');
  }

  const { startDate, endDate } = req.query;

  // Build date filter
  const dateFilter: SecurityAuditLogWhere = {};
  if (startDate || endDate) {
    dateFilter.timestamp = {};
    if (startDate) {
      dateFilter.timestamp.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.timestamp.lte = new Date(endDate as string);
    }
  }

  // Get total count
  const totalEvents = await prisma.securityAuditLog.count({
    where: dateFilter,
  });

  // Get all logs for aggregation
  const allLogs = await prisma.securityAuditLog.findMany({
    where: dateFilter,
    select: {
      event: true,
      severity: true,
      timestamp: true,
      details: true,
    },
  });

  // Aggregate by event type
  const byEvent: Record<string, number> = {};
  allLogs.forEach((log) => {
    byEvent[log.event] = (byEvent[log.event] || 0) + 1;
  });

  // Aggregate by severity
  const bySeverity: Record<string, number> = {};
  allLogs.forEach((log) => {
    bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
  });

  // Get recent critical events
  const criticalEvents = await prisma.securityAuditLog.findMany({
    where: {
      ...dateFilter,
      severity: 'critical',
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  return success(res, {
    total: totalEvents,
    byEvent,
    bySeverity,
    recentCritical: criticalEvents,
  });
}));

export default router;
