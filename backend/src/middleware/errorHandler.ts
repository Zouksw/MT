import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "@/lib";

export interface AppError extends Error {
	statusCode?: number;
	isOperational?: boolean;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
	logger.error("Error occurred:", {
		message: err.message,
		stack: err.stack,
		path: req.path,
		method: req.method,
	});

	// Handle Zod validation errors
	if (err instanceof ZodError) {
		return res.status(400).json({
			success: false,
			error: {
				message: "Validation error",
				code: "VALIDATION_ERROR",
				details: err.errors,
			},
		});
	}

	// Handle Prisma-specific errors
	if (err.constructor.name === "PrismaClientKnownRequestError") {
		const prismaError = err as unknown as Record<string, unknown>;

		// Unique constraint violation
		if (prismaError.code === "P2002") {
			return res.status(409).json({
				success: false,
				error: {
					message: "Resource already exists",
					code: "CONFLICT",
					details:
						(prismaError.meta as Record<string, unknown>)?.target || "Unique constraint violated",
				},
			});
		}

		// Record not found
		if (prismaError.code === "P2025") {
			return res.status(404).json({
				success: false,
				error: {
					message: "Resource not found",
					code: "NOT_FOUND",
				},
			});
		}

		// Foreign key constraint
		if (prismaError.code === "P2003") {
			return res.status(400).json({
				success: false,
				error: {
					message: "Invalid reference",
					code: "BAD_REQUEST",
					details: "Related resource not found",
				},
			});
		}
	}

	// Handle JWT errors
	if (err.name === "JsonWebTokenError") {
		return res.status(401).json({
			success: false,
			error: {
				message: "Invalid token",
				code: "UNAUTHORIZED",
			},
		});
	}

	if (err.name === "TokenExpiredError") {
		return res.status(401).json({
			success: false,
			error: {
				message: "Token expired",
				code: "UNAUTHORIZED",
			},
		});
	}

	// Handle custom application errors
	const appError = err as AppError;
	const statusCode = appError.statusCode || 500;
	const message = appError.isOperational
		? appError.message
		: process.env.NODE_ENV === "production"
			? "Internal server error"
			: appError.message;

	// Map status codes to error codes
	const errorCodes: Record<number, string> = {
		400: "BAD_REQUEST",
		401: "UNAUTHORIZED",
		403: "FORBIDDEN",
		404: "NOT_FOUND",
		409: "CONFLICT",
		429: "RATE_LIMIT_EXCEEDED",
		500: "SERVER_ERROR",
		503: "SERVICE_UNAVAILABLE",
	};

	res.status(statusCode).json({
		success: false,
		error: {
			message,
			code: errorCodes[statusCode] || "UNKNOWN_ERROR",
		},
	});
}

/**
 * Create a custom application error
 */
export class ApiError extends Error implements AppError {
	statusCode: number;
	isOperational: boolean;

	constructor(statusCode: number, message: string, isOperational = true) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = <Req extends Request = Request>(
	fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req as Req, res, next)).catch(next);
	};
};

/**
 * Common error constructors for convenient error throwing
 */
export class BadRequestError extends ApiError {
	constructor(message: string) {
		super(400, message);
	}
}

export class UnauthorizedError extends ApiError {
	constructor(message: string = "Unauthorized") {
		super(401, message);
	}
}

export class ForbiddenError extends ApiError {
	constructor(message: string = "Forbidden") {
		super(403, message);
	}
}

export class NotFoundError extends ApiError {
	constructor(resource: string = "Resource") {
		super(404, `${resource} not found`);
	}
}

export class ConflictError extends ApiError {
	constructor(message: string) {
		super(409, message);
	}
}

export class ServiceUnavailableError extends ApiError {
	constructor(message: string = "Service temporarily unavailable") {
		super(503, message);
	}
}

export class TooManyRequestsError extends ApiError {
	constructor(message: string = "Too many requests") {
		super(429, message);
	}
}
