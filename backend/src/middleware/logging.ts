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
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
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
export const detailedRequestLogger = (req: Request, res: Response, next: NextFunction) => {
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

// Export combined middleware
export const loggingMiddleware = [
	requestLoggingMiddleware,
	detailedRequestLogger,
	slowQueryLogger(1000),
];
