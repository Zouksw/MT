/**
 * Redis Client Library
 *
 * Simplified Redis client management.
 *
 * BEST PRACTICE: Call initRedis() during application startup.
 * If Redis is unavailable, the application will fail fast.
 *
 * For backward compatibility, getRedisClient() will lazily initialize
 * if initRedis() wasn't called.
 */

import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger";

let redisClient: RedisClientType | null = null;
let initPromise: Promise<RedisClientType> | null = null;
let initialized = false;
// Negative caching: when Redis is down, remember the failure for a short
// cooldown so callers don't re-attempt the 10s connection timeout on every
// call (which would make every cached route block for 10s under outage).
let redisDownUntil = 0;
const REDIS_RETRY_COOLDOWN_MS = 30_000; // 30s — re-check Redis health periodically

/**
 * Initialize Redis client - should be called during application startup
 * @throws Error if Redis connection fails
 */
export async function initRedis(): Promise<void> {
	if (redisClient) {
		return; // Already initialized
	}

	if (initPromise) {
		await initPromise;
		return;
	}

	initPromise = (async () => {
		const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

		const client = createClient({
			url: redisUrl,
			socket: {
				reconnectStrategy: (retries) => {
					if (retries > 10) {
						logger.error("[REDIS] Reconnection failed after 10 attempts");
						return new Error("Redis reconnection failed");
					}
					return retries * 100;
				},
			},
		}) as RedisClientType;

		client.on("error", (err) => {
			logger.error("[REDIS] Client error", { error: err.message });
		});

		client.on("connect", () => {
			logger.info("[REDIS] Client connected");
		});

		const connectPromise = client.connect();
		await Promise.race([
			connectPromise,
			new Promise<never>((_, rej) =>
				setTimeout(() => rej(new Error("Redis connection timeout (10s)")), 10000),
			),
		]);
		redisClient = client;
		initialized = true;
		return redisClient;
	})();

	try {
		await initPromise;
	} catch (err) {
		logger.warn(`[REDIS] Connection failed: ${err}. Running without cache.`);
		redisClient = null;
		initialized = false;
		// Set a cooldown so callers don't re-attempt the 10s connection timeout
		// on every call while Redis is down (F13: without this, every cached
		// route blocked for 10s per request under Redis outage).
		redisDownUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
	}
	initPromise = null;
}

/**
 * Get or initialize the Redis client
 *
 * NOTE: For new code, call initRedis() during app startup instead.
 * This method is kept for backward compatibility.
 */
export async function getRedisClient(): Promise<RedisClientType> {
	if (redisClient) {
		return redisClient;
	}

	// Negative caching: if Redis was recently unreachable, fail fast instead
	// of blocking for 10s on a connection timeout that will almost certainly
	// fail again. Callers catch this and degrade gracefully (cache miss).
	// After the cooldown, the next call re-attempts the connection.
	if (Date.now() < redisDownUntil) {
		throw new Error("Redis is temporarily unreachable (connection cooldown)");
	}

	if (initialized) {
		throw new Error("Redis client was initialized but is not available");
	}

	// Lazy initialization for backward compatibility
	logger.warn(
		"[REDIS] Using lazy initialization. Call initRedis() during app startup for better performance.",
	);

	if (initPromise) {
		return initPromise;
	}

	return initRedis().then(() => {
		if (!redisClient) {
			throw new Error("Redis client initialization failed");
		}
		return redisClient;
	});
}

/**
 * Simple helper to get Redis client (for backward compatibility)
 * Usage: await redis().set('key', 'value')
 */
export async function redis(): Promise<RedisClientType> {
	return getRedisClient();
}
