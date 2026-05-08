/**
 * Security middleware
 * Provides HTTP security headers and CORS configuration
 */

import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { ZodError, z } from "zod";

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
	// Content Security Policy
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			scriptSrc: ["'self'"],
			imgSrc: ["'self'", "data:", "https:"],
			connectSrc: ["'self'"],
			fontSrc: ["'self'"],
			objectSrc: ["'none'"],
			mediaSrc: ["'self'"],
			frameSrc: ["'none'"],
		},
	},
	// HTTP Strict Transport Security (only in production)
	hsts:
		process.env.NODE_ENV === "production"
			? {
					maxAge: 31536000,
					includeSubDomains: true,
					preload: true,
				}
			: false,
	// Prevent clickjacking
	frameguard: { action: "deny" },
	// X-XSS Protection
	xssFilter: true,
	// Prevent MIME type sniffing
	noSniff: true,
	// Referrer-Policy
	referrerPolicy: { policy: "strict-origin-when-cross-origin" },
	// Disable X-Powered-By header
	hidePoweredBy: true,
});

/**
 * Input validation middleware factory
 * Uses Zod schemas to validate request data
 */
export const validate =
	(schema: z.ZodSchema, property: "body" | "query" | "params" = "body") =>
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			req[property] = await schema.parseAsync(req[property]);
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				return res.status(400).json({
					error: "Validation error",
					details: error.errors,
				});
			}
			return res.status(500).json({ error: "Internal server error" });
		}
	};

/**
 * Request size limiter
 * Prevents large payload attacks
 */
export const limitRequestSize = (maxSize: string = "10mb") => {
	return (req: Request, res: Response, next: NextFunction) => {
		const contentLength = parseInt(req.headers["content-length"] || "0", 10);
		const maxSizeInBytes = parseSize(maxSize);

		if (contentLength > maxSizeInBytes) {
			return res.status(413).json({
				error: "Payload too large",
				message: `Request body exceeds maximum size of ${maxSize}`,
			});
		}
		next();
	};
};

/**
 * Parse size string (e.g., '10mb') to bytes
 */
function parseSize(size: string): number {
	const units: { [key: string]: number } = {
		b: 1,
		kb: 1024,
		mb: 1024 * 1024,
		gb: 1024 * 1024 * 1024,
	};

	const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
	if (!match) return 0;

	const value = parseFloat(match[1]);
	const unit = match[2] || "b";

	return value * (units[unit] || 1);
}

/**
 * Validation schemas for common inputs
 */
export const validationSchemas = {
	// Email validation
	email: z.string().email("Invalid email format"),
	emailOptional: z.string().email("Invalid email format").optional(),

	// Password validation (at least 8 characters, 1 uppercase, 1 lowercase, 1 number)
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/[a-z]/, "Password must contain at least one lowercase letter")
		.regex(/[0-9]/, "Password must contain at least one number"),

	// UUID validation
	uuid: z.string().uuid("Invalid UUID format"),

	// Timeseries name validation
	timeseriesName: z
		.string()
		.min(1, "Timeseries name is required")
		.max(255, "Timeseries name must be less than 255 characters")
		.regex(
			/^[a-zA-Z0-9._-]+$/,
			"Timeseries name can only contain letters, numbers, dots, underscores, and hyphens",
		),

	// Pagination parameters
	pagination: z.object({
		page: z.coerce.number().int().positive().optional().default(1),
		limit: z.coerce.number().int().positive().max(100).optional().default(20),
	}),

	// SQL query validation (basic)
	sqlQuery: z
		.string()
		.max(10000, "Query too long")
		.refine((query) => {
			const forbidden = [
				"DROP",
				"DELETE",
				"TRUNCATE",
				"ALTER",
				"CREATE",
				"INSERT",
				"UPDATE",
			];
			const upperQuery = query.toUpperCase();
			return !forbidden.some((word) => upperQuery.includes(word));
		}, "Only SELECT queries are allowed"),
};
