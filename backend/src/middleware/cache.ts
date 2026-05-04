/**
 * Cache Middleware
 * Provides HTTP-level caching for API responses
 */

import type { NextFunction, Request, Response } from "express";
import { logger } from "@/lib/logger";
import { cacheKeys, get, set } from "@/services/cache";

interface CachedRequest extends Request {
	cacheKey?: string;
	cacheTTL?: number;
}

/**
 * Cache middleware factory
 * Creates middleware that caches GET requests
 */
export const cacheResponse = (options: {
	ttl?: number; // Time to live in seconds (default: 5 minutes)
	keyGenerator?: (req: Request) => string;
}) => {
	const { ttl = 300, keyGenerator } = options;

	return async (req: CachedRequest, res: Response, next: NextFunction) => {
		// Only cache GET requests
		if (req.method !== "GET") {
			return next();
		}

		// Generate cache key
		const cacheKey = keyGenerator
			? keyGenerator(req)
			: `http:${req.path}:${JSON.stringify(req.query)}`;

		req.cacheKey = cacheKey;
		req.cacheTTL = ttl;

		// Try to get from cache
		const cached = await get(cacheKey);

		if (cached) {
			// Set cache headers
			res.setHeader("X-Cache", "HIT");
			res.setHeader("Cache-Control", `max-age=${ttl}`);

			return res.json(cached);
		}

		// Set cache headers for miss
		res.setHeader("X-Cache", "MISS");

		// Monkey-patch res.json to cache the response
		const originalJson = res.json.bind(res);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		res.json = ((body: unknown): Response => {
			// Only cache successful responses
			if (res.statusCode >= 200 && res.statusCode < 300) {
				// Cache the response asynchronously (don't block the response)
				set(cacheKey, body, ttl).catch((err) => {
					logger.error("Cache set error:", err);
				});
			}

			return originalJson(body) as Response;
		}) as unknown as typeof res.json;

		next();
	};
};

/**
 * Cache invalidation middleware
 * Invalidates cache when data is modified
 */
export const invalidateCache = (patterns: string[]) => {
	return async (_req: Request, res: Response, next: NextFunction) => {
		// Process the request first
		next();

		// After successful response, invalidate cache
		res.on("finish", async () => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				const { delPattern } = await import("../services/cache");

				for (const pattern of patterns) {
					await delPattern(pattern);
				}
			}
		});
	};
};

/**
 * Common cache configurations
 */
export const cacheConfigs = {
	// Timeseries data cache (1 minute)
	timeseriesData: cacheResponse({
		ttl: 60,
		keyGenerator: (req) => {
			const timeseriesId = req.params.timeseriesId || req.query.timeseriesId;
			const from = req.query.from;
			const to = req.query.to;
			return cacheKeys.timeseriesData(
				timeseriesId as string,
				new Date(from as string),
				new Date(to as string),
			);
		},
	}),

	// Timeseries list cache (5 minutes)
	timeseriesList: cacheResponse({
		ttl: 300,
		keyGenerator: (req) => {
			const datasetId = req.query.datasetId;
			return cacheKeys.timeseriesList(datasetId as string);
		},
	}),

	// AI prediction cache (15 minutes)
	aiPrediction: cacheResponse({
		ttl: 900,
		keyGenerator: (req) => {
			const timeseries = req.body.timeseries || req.query.timeseries;
			const algorithm = req.body.algorithm || req.query.algorithm;
			const horizon = req.body.horizon || req.query.horizon;
			return cacheKeys.prediction(
				timeseries as string,
				algorithm as string,
				parseInt(horizon as string, 10),
			);
		},
	}),

	// Query result cache (5 minutes)
	queryResult: cacheResponse({
		ttl: 300,
		keyGenerator: (req) => {
			const sql = req.body.sql || req.query.sql;
			return cacheKeys.query(sql as string);
		},
	}),

	// User data cache (10 minutes)
	userData: cacheResponse({
		ttl: 600,
		keyGenerator: (req) => {
			const userId = req.params.userId || (req as unknown as Record<string, unknown>).userId;
			return cacheKeys.userSession(userId as string);
		},
	}),
};

/**
 * Cache control headers middleware
 */
export const cacheControl = (options: {
	maxAge?: number;
	sMaxAge?: number;
	noCache?: boolean;
	noStore?: boolean;
	mustRevalidate?: boolean;
	private?: boolean;
	public?: boolean;
	immutable?: boolean;
}) => {
	return (_req: Request, res: Response, next: NextFunction) => {
		const directives: string[] = [];

		if (options.maxAge !== undefined) {
			directives.push(`max-age=${options.maxAge}`);
		}

		if (options.sMaxAge !== undefined) {
			directives.push(`s-maxage=${options.sMaxAge}`);
		}

		if (options.noCache) {
			directives.push("no-cache");
		}

		if (options.noStore) {
			directives.push("no-store");
		}

		if (options.mustRevalidate) {
			directives.push("must-revalidate");
		}

		if (options.private) {
			directives.push("private");
		}

		if (options.public) {
			directives.push("public");
		}

		if (options.immutable) {
			directives.push("immutable");
		}

		if (directives.length > 0) {
			res.setHeader("Cache-Control", directives.join(", "));
		}

		next();
	};
};

/**
 * ETag support for conditional requests
 */
export const etag = (options: { weak?: boolean } = {}) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		const originalJson = res.json.bind(res);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		res.json = ((body: unknown): Response => {
			// Generate ETag from response body
			const crypto = require("node:crypto");
			const hash = crypto
				.createHash("sha256")
				.update(JSON.stringify(body))
				.digest("base64");

			const etagValue = options.weak ? `W/"${hash}"` : `"${hash}"`;

			res.setHeader("ETag", etagValue);

			// Check If-None-Match header
			const ifNoneMatch = req.get("If-None-Match");

			if (ifNoneMatch && ifNoneMatch === etagValue) {
				return res.status(304).end();
			}

			return originalJson(body) as Response;
		}) as unknown as typeof res.json;

		next();
	};
};
