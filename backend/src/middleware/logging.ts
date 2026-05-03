import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

// Extend Express Request type to include correlation ID
declare global {
	namespace Express {
		interface Request {
			correlationId?: string;
			userId?: string;
			startTime?: number;
		}
	}
}

// Request logging middleware with correlation ID
export const requestLoggingMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	// Generate or retrieve correlation ID
	req.correlationId = (req.headers["x-correlation-id"] as string) || uuidv4();
	req.startTime = Date.now();

	// Log request
	logger.http("HTTP_REQUEST", "Incoming request", {
		correlationId: req.correlationId,
		method: req.method,
		url: req.url,
		ip: req.ip,
		userAgent: req.get("user-agent"),
		userId: req.userId,
	});

	// Log response
	res.on("finish", () => {
		const duration = req.startTime ? Date.now() - req.startTime : 0;

		logger.http("HTTP_RESPONSE", "Request completed", {
			correlationId: req.correlationId,
			method: req.method,
			url: req.url,
			statusCode: res.statusCode,
			duration: `${duration}ms`,
			userId: req.userId,
		});
	});

	// Add correlation ID to response headers
	res.setHeader("X-Correlation-ID", req.correlationId);

	next();
};

// Error logging middleware
export const errorLoggingMiddleware = (
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const duration = req.startTime ? Date.now() - req.startTime : 0;

	logger.error("MIDDLEWARE_ERROR", err.message, {
		correlationId: req.correlationId,
		method: req.method,
		url: req.url,
		statusCode: res.statusCode,
		duration: `${duration}ms`,
		userId: req.userId,
		stack: err.stack,
	});

	next(err);
};

// Request response logger for detailed debugging
export const detailedRequestLogger = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	if (process.env.LOG_LEVEL === "debug") {
		const originalSend = res.send;
		res.send = function (data) {
			logger.debug("RESPONSE_BODY", "Response data", {
				correlationId: req.correlationId,
				method: req.method,
				url: req.url,
				body: data?.toString().substring(0, 1000), // Truncate large responses
			});
			return originalSend.call(this, data);
		};
	}
	next();
};

// Slow query logging middleware
export const slowQueryLogger = (threshold: number = 1000) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const startTime = Date.now();

		res.on("finish", () => {
			const duration = Date.now() - startTime;
			if (duration > threshold) {
				logger.warn("SLOW_REQUEST", "Request exceeded threshold", {
					correlationId: req.correlationId,
					method: req.method,
					url: req.url,
					duration: `${duration}ms`,
					threshold: `${threshold}ms`,
					userId: req.userId,
				});
			}
		});

		next();
	};
};

// Security event logging
export const securityEventLogger = (
	eventType: string,
	details: Record<string, any>,
	req?: Request,
) => {
	logger.warn("SECURITY_EVENT", `Security event: ${eventType}`, {
		eventType,
		correlationId: req?.correlationId,
		ip: req?.ip,
		userAgent: req?.get("user-agent"),
		userId: req?.userId,
		...details,
	});
};

// API activity logging for audit trail
export const auditLogger = (
	action: string,
	entityType: string,
	entityId: string,
	userId: string,
	details?: Record<string, any>,
) => {
	logger.info("AUDIT_LOG", `${action} ${entityType}`, {
		action,
		entityType,
		entityId,
		userId,
		details,
	});
};

// Performance logging
export const performanceLogger = (
	operation: string,
	duration: number,
	metadata?: Record<string, any>,
) => {
	logger.info("PERFORMANCE", `Operation: ${operation}`, {
		operation,
		duration: `${duration}ms`,
		...metadata,
	});
};

// Health check logger
export const healthLogger = (
	status: "healthy" | "unhealthy",
	details: Record<string, any>,
) => {
	logger.info("HEALTH_CHECK", `Health status: ${status}`, {
		status,
		...details,
	});
};

// Database operation logger
export const dbLogger = (
	operation: string,
	table: string,
	duration: number,
	success: boolean,
	details?: Record<string, any>,
) => {
	const level = success ? "info" : "error";
	logger[level](
		`DB_OPERATION_${operation.toUpperCase()}`,
		`${operation} on ${table}`,
		{
			operation,
			table,
			duration: `${duration}ms`,
			status: success ? "success" : "error",
			...details,
		},
	);
};

// IoTDB operation logger
export const iotdbLogger = (
	operation: string,
	device?: string,
	duration?: number,
	success: boolean = true,
	details?: Record<string, any>,
) => {
	const level = success ? "info" : "error";
	logger[level](
		`IOTDB_OPERATION_${operation.toUpperCase()}`,
		`${operation} ${device || ""}`,
		{
			operation,
			device,
			duration: duration ? `${duration}ms` : undefined,
			status: success ? "success" : "error",
			...details,
		},
	);
};

// AI model operation logger
export const aiLogger = (
	operation: string,
	modelName: string,
	duration?: number,
	success: boolean = true,
	details?: Record<string, any>,
) => {
	const level = success ? "info" : "error";
	logger[level](
		`AI_OPERATION_${operation.toUpperCase()}`,
		`${operation} ${modelName}`,
		{
			operation,
			modelName,
			duration: duration ? `${duration}ms` : undefined,
			status: success ? "success" : "error",
			...details,
		},
	);
};

// Export combined middleware
export const loggingMiddleware = [
	requestLoggingMiddleware,
	detailedRequestLogger,
	slowQueryLogger(1000),
];
