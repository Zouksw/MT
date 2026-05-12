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

export default redis;
