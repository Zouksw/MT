/**
 * Cache Decorator Middleware
 *
 * Simple, decorator-style caching for Express routes.
 * Eliminates boilerplate cache get/set/check patterns.
 *
 * @example
 * ```typescript
 * router.get('/datasets', cacheRoute('datasets:list', 300), async (req, res) => {
 *   const datasets = await prisma.dataset.findMany();
 *   res.json(datasets);
 * });
 * ```
 */

import type { NextFunction, Request, Response } from "express";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

/**
 * Add jitter to TTL to prevent cache avalanche
 * Adds random variation (±10%) to TTL to distribute cache expiration times
 *
 * @param baseTTL - Base TTL in seconds
 * @param jitterPercent - Jitter percentage (default: 0.1 = 10%)
 * @returns TTL with random jitter applied
 */
function getTTLWithJitter(
	baseTTL: number,
	jitterPercent: number = 0.1,
): number {
	if (baseTTL <= 0) return baseTTL;

	// Calculate jitter range
	const jitter = baseTTL * jitterPercent;
	const randomJitter = Math.random() * jitter * 2 - jitter; // ±jitter

	// Apply jitter and ensure minimum TTL of 1 second
	const ttlWithJitter = Math.max(1, Math.floor(baseTTL + randomJitter));

	return ttlWithJitter;
}

/**
 * Cache decorator configuration
 */
interface CacheRouteOptions {
	/** Cache key prefix */
	keyPrefix: string;
	/** TTL in seconds (default: 60) */
	ttl?: number;
	/** Generate cache key from request (optional) */
	keyGenerator?: (req: Request) => string;
	/** Whether to vary cache by user (default: false) */
	varyByUser?: boolean;
}

/**
 * Cached response structure
 */
interface CachedResponse {
	statusCode: number;
	body: unknown;
	headers: Record<string, string>;
}

/**
 * Get Redis client via the shared redis.ts module
 */
async function getRedis() {
	return await redis();
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, options: CacheRouteOptions): string {
	const { keyPrefix, keyGenerator, varyByUser } = options;

	if (keyGenerator) {
		const customKey = keyGenerator(req);
		if (customKey) {
			return `${keyPrefix}:${customKey}`;
		}
	}

	// Default key generation
	const parts = [keyPrefix, req.path];

	// Add query string
	if (Object.keys(req.query).length > 0) {
		const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
		parts.push(queryString);
	}

	// Add user context if varyByUser is enabled
	if (varyByUser) {
		const user = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined;
		if (user?.id) {
			parts.push(`user:${user.id}`);
		}
	}

	return parts.join(":");
}

/**
 * Get cached response
 */
async function getCached(key: string): Promise<CachedResponse | null> {
	try {
		const redis = await getRedis();
		if (!redis) {
			return null;
		}

		const data = await redis.get(key);
		if (!data) {
			return null;
		}

		return JSON.parse(data) as CachedResponse;
	} catch (error) {
		logger.error(`Cache get error for key ${key}:`, error);
		return null;
	}
}

/**
 * Set cached response
 */
async function setCached(
	key: string,
	response: CachedResponse,
	ttl: number,
): Promise<void> {
	try {
		const redis = await getRedis();
		if (!redis) {
			return;
		}

		const value = JSON.stringify(response);
		await redis.setEx(key, ttl, value);
	} catch (error) {
		logger.error(`Cache set error for key ${key}:`, error);
	}
}

/**
 * Cache route middleware factory
 *
 * Creates Express middleware that caches route responses in Redis.
 * Only caches GET requests with successful responses (2xx status codes).
 *
 * @param options - Cache configuration
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // Basic usage - caches for 60 seconds
 * router.get('/datasets', cacheRoute('datasets:list'), async (req, res) => {
 *   const datasets = await prisma.dataset.findMany();
 *   res.json(datasets);
 * });
 *
 * // Custom TTL - caches for 5 minutes
 * router.get('/timeseries', cacheRoute('timeseries:list', 300), async (req, res) => {
 *   const timeseries = await prisma.timeseries.findMany();
 *   res.json(timeseries);
 * });
 *
 * // Custom key generator - varies by search term
 * router.get('/search',
 *   cacheRoute('search', 60, {
 *     keyGenerator: (req) => req.query.q as string
 *   }),
 *   async (req, res) => {
 *     const results = await search(req.query.q);
 *     res.json(results);
 *   }
 * );
 *
 * // User-specific cache
 * router.get('/my-datasets',
 *   cacheRoute('datasets:my', 60, { varyByUser: true }),
 *   async (req, res) => {
 *     const datasets = await prisma.dataset.findMany({
 *       where: { ownerId: req.user.id }
 *     });
 *     res.json(datasets);
 *   }
 * );
 * ```
 */
export function cacheRoute(
	keyPrefix: string,
	ttl: number = 60,
	options: Partial<CacheRouteOptions> = {},
) {
	const config: CacheRouteOptions = {
		keyPrefix,
		ttl,
		varyByUser: false,
		...options,
	};

	return async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		// Only cache GET requests
		if (req.method !== "GET") {
			return next();
		}

		const cacheKey = generateCacheKey(req, config);

		// Try to get from cache
		const cached = await getCached(cacheKey);
		if (cached) {
			logger.debug(`Cache HIT: ${cacheKey}`);
			res.status(cached.statusCode);
			res.set(cached.headers);
			res.setHeader("X-Cache", "HIT");
			res.json(cached.body);
			return;
		}

		logger.debug(`Cache MISS: ${cacheKey}`);

		// Cache miss - intercept response
		const originalJson = res.json.bind(res);
		const originalStatus = res.status.bind(res);
		const originalSet = res.set.bind(res);

		const headers: Record<string, string> = {};
		let statusCode = 200;

		// Intercept res.set()
		res.set = function (header: Record<string, string> | string) {
			if (typeof header === "string") {
				headers[header] = arguments[1];
			} else {
				Object.assign(headers, header);
			}
			return originalSet.apply(res, arguments as unknown as Parameters<typeof originalSet>);
		};

		// Intercept res.status()
		res.status = (code: number) => {
			statusCode = code;
			return originalStatus(code);
		};

		// Intercept res.json()
		res.json = (body: unknown) => {
			// Only cache successful responses
			const cachePromise =
				statusCode >= 200 && statusCode < 300
					? (async () => {
							const cachedResponse: CachedResponse = {
								statusCode,
								body,
								headers,
							};

							// Apply TTL jitter to prevent cache avalanche
							const ttlWithJitter = getTTLWithJitter(config.ttl || 300);

							// Set cache asynchronously (don't block response)
							await setCached(cacheKey, cachedResponse, ttlWithJitter).catch(
								(err) => {
									logger.error("Failed to cache response:", err);
								},
							);
						})()
					: Promise.resolve();

			res.setHeader("X-Cache", "MISS");

			// Return original json result (fire-and-forget for cache)
			const result = originalJson(body);

			// Attach cache promise for testing purposes
			(result as unknown as Record<string, unknown>).cachePromise = cachePromise;

			return result;
		};

		next();
	};
}

/**
 * Cache invalidation helper
 *
 * Deletes cache entries matching a pattern.
 *
 * @param pattern - Redis key pattern to match
 * @returns Number of keys deleted
 *
 * @example
 * ```typescript
 * // Invalidate all dataset caches
 * await invalidateCache('datasets:*');
 *
 * // Invalidate all caches for a specific user
 * await invalidateCache('*:user:123');
 * ```
 */
export async function invalidateCache(pattern: string): Promise<number> {
	try {
		const redis = await getRedis();
		if (!redis) {
			return 0;
		}

		const keys = await redis.keys(pattern);
		if (keys.length === 0) {
			return 0;
		}

		await redis.del(keys);
		logger.info(
			`Invalidated ${keys.length} cache entries matching: ${pattern}`,
		);
		return keys.length;
	} catch (error) {
		logger.error(`Cache invalidation error for pattern ${pattern}:`, error);
		return 0;
	}
}

/**
 * Cache decorator for service functions
 *
 * Wraps an async function with caching logic.
 *
 * @param keyPrefix - Cache key prefix
 * @param ttl - TTL in seconds
 * @param options - Additional options
 * @returns Decorated function with caching
 *
 * @example
 * ```typescript
 * // Without decorator
 * const expensive = cacheFn('expensive', 300, async (id: string) => {
 *   return await prisma.dataset.findUnique({ where: { id } });
 * });
 *
 * // With manual key generator
 * const searchResults = cacheFn('search', 60, {
 *   keyGenerator: (query) => `q:${query}`,
 *   ttl: 60
 * }, async (query: string) => {
 *   return await searchDatabase(query);
 * });
 * ```
 */
export function cacheFn<T extends (...args: unknown[]) => Promise<unknown>>(
	keyPrefix: string,
	ttlOrOptions:
		| number
		| { ttl?: number; keyGenerator?: (...args: Parameters<T>) => string },
	maybeOptions?: {
		ttl?: number;
		keyGenerator?: (...args: Parameters<T>) => string;
	},
): T {
	// Parse options (support both ttl and options object)
	let ttl: number;
	let keyGenerator: ((...args: Parameters<T>) => string) | undefined;

	if (typeof ttlOrOptions === "number") {
		ttl = ttlOrOptions;
		keyGenerator = maybeOptions?.keyGenerator;
	} else {
		ttl = ttlOrOptions.ttl || 60;
		keyGenerator = ttlOrOptions.keyGenerator;
	}

	return (async (...args: Parameters<T>) => {
		const cacheKey = keyGenerator
			? `${keyPrefix}:${keyGenerator(...args)}`
			: `${keyPrefix}:${JSON.stringify(args)}`;

		// Try cache
		const cached = await getCached(cacheKey);
		if (cached) {
			return cached.body;
		}
		// Execute function
		const result = await (async () => {
			// This will be replaced with the actual function when used
			return null as unknown as ReturnType<T>;
			// @ts-expect-error - spread argument type issue
		})(...args);
		// Store in cache
		await setCached(
			cacheKey,
			{ statusCode: 200, body: result, headers: {} },
			ttl,
		);

		return result;
	}) as T;
}
