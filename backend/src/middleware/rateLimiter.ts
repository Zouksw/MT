/**
 * Rate limiting middleware
 * Protects against brute force attacks and API abuse
 */

import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";

/**
 * Generic rate limiter configuration
 */
export const createRateLimiter = (options: {
	windowMs?: number;
	max?: number;
	message?: string;
	skipSuccessfulRequests?: boolean;
}) => {
	return rateLimit({
		windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
		max: options.max || 100, // Limit each IP to 100 requests per windowMs
		message: options.message || "Too many requests from this IP, please try again later.",
		standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
		legacyHeaders: false, // Disable the `X-RateLimit-*` headers
		skipSuccessfulRequests: options.skipSuccessfulRequests || false,
		skip: (_req: Request) => process.env.NODE_ENV === "development",
		handler: (_req: Request, res: Response) => {
			res.status(429).json({
				error: "Too many requests",
				message: options.message || "Too many requests from this IP, please try again later.",
				retryAfter: Math.ceil((options.windowMs || 900000) / 1000),
			});
		},
	});
};

/**
 * Strict rate limiter for authentication endpoints
 * 10 requests per 15 minutes per IP
 */
export const authRateLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10,
	message: "Too many authentication attempts, please try again later.",
});

/**
 * Strict rate limiter for AI prediction endpoints
 * 20 requests per minute per IP (AI is resource-intensive)
 */
export const aiRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	max: 20,
	message: "Too many AI prediction requests, please try again later.",
});

/**
 * User registration rate limiter
 * 3 registrations per hour per IP
 */
export const registrationRateLimiter = createRateLimiter({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 3,
	message: "Too many registration attempts, please try again later.",
});

/**
 * API key creation rate limiter
 * 5 creations per hour per user
 */
export const apiKeyCreationLimiter = createRateLimiter({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5,
	message: "Too many API key creation attempts, please try again later.",
});

/**
 * Global rate limiter — applied to every API route as a baseline abuse cap.
 * Permissive enough for normal interactive use (300 req/min/IP ≈ 5 req/s)
 * while preventing unbounded volume abuse on otherwise-unlimited routes.
 * Stricter per-route limiters (auth, registration, AI) still apply on top.
 */
export const globalRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	max: 300,
	message: "Too many requests from this IP, please try again later.",
});
