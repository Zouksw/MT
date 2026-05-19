/**
 * Cache Service
 * Handles caching for API responses, predictions, and queries using Redis.
 * Delegates connection management to @/lib/redis for a single shared connection.
 */

import type { RedisClientType } from "redis";
import { logger } from "@/lib";
import { getRedisClient } from "@/lib/redis";

const NULL_CACHE_TTL = 60;
const NULL_CACHE_PREFIX = "null:";

async function getClient(): Promise<RedisClientType | null> {
	try {
		return await getRedisClient();
	} catch {
		// intentionally ignored — Redis unavailable, all cache ops return null/false
		return null;
	}
}

/**
 * Initialize Redis connection (delegates to @/lib/redis)
 */
export async function initCache() {
	return getClient();
}

export async function get<T>(key: string): Promise<T | null> {
	const redis = await getClient();
	if (!redis) return null;

	try {
		const data = await redis.get(key);
		if (!data) {
			const nullKey = `${NULL_CACHE_PREFIX}${key}`;
			const isNullCached = await redis.exists(nullKey);
			if (isNullCached) return null;
			return null;
		}
		return JSON.parse(data) as T;
	} catch (error) {
		logger.error(`Cache get error for key ${key}: ${error}`);
		return null;
	}
}

export async function set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
	const redis = await getClient();
	if (!redis) return;

	try {
		const serialized = JSON.stringify(value);
		if (ttlSeconds) {
			await redis.setEx(key, ttlSeconds, serialized);
		} else {
			await redis.set(key, serialized);
		}
	} catch (error) {
		logger.error(`Cache set error for key ${key}: ${error}`);
	}
}

export async function del(key: string): Promise<void> {
	const redis = await getClient();
	if (!redis) return;

	try {
		await redis.del(key);
	} catch (error) {
		logger.error(`Cache delete error for key ${key}: ${error}`);
	}
}

export async function delPattern(pattern: string): Promise<void> {
	const redis = await getClient();
	if (!redis) return;

	try {
		const keys = await redis.keys(pattern);
		if (keys.length > 0) {
			await redis.del(keys);
		}
	} catch (error) {
		logger.error(`Cache delete pattern error for ${pattern}: ${error}`);
	}
}

export async function exists(key: string): Promise<boolean> {
	const redis = await getClient();
	if (!redis) return false;

	try {
		const result = await redis.exists(key);
		return result === 1;
	} catch (error) {
		logger.error(`Cache exists error for key ${key}: ${error}`);
		return false;
	}
}

export async function incr(key: string): Promise<number> {
	const redis = await getClient();
	if (!redis) return 0;

	try {
		return await redis.incr(key);
	} catch (error) {
		logger.error(`Cache increment error for key ${key}: ${error}`);
		return 0;
	}
}

export async function expire(key: string, ttlSeconds: number): Promise<void> {
	const redis = await getClient();
	if (!redis) return;

	try {
		await redis.expire(key, ttlSeconds);
	} catch (error) {
		logger.error(`Cache expire error for key ${key} (${ttlSeconds}s): ${error}`);
	}
}

export async function mget<T>(keys: string[]): Promise<(T | null)[]> {
	if (keys.length === 0) return [];
	const redis = await getClient();
	if (!redis) return [];

	try {
		const values = await redis.mGet(keys);
		return values.map((value) => {
			if (!value) return null;
			try {
				return JSON.parse(value) as T;
			} catch {
				// intentionally ignored — corrupted cache entry, treat as miss
				return null;
			}
		});
	} catch (error) {
		logger.error(`Cache mget error for ${keys.length} keys: ${error}`);
		return keys.map(() => null);
	}
}

export async function mset(items: Array<{ key: string; value: unknown }>): Promise<void> {
	if (items.length === 0) return;
	const redis = await getClient();
	if (!redis) return;

	try {
		const pipeline = redis.multi();
		for (const item of items) {
			pipeline.set(item.key, JSON.stringify(item.value));
		}
		await pipeline.exec();
	} catch (error) {
		logger.error(`Cache mset error for ${items.length} items: ${error}`);
	}
}

export function cache<T extends (...args: unknown[]) => Promise<unknown>>(
	keyPrefix: string,
	fn: T,
	options: {
		ttl?: number;
		keyGenerator?: (...args: Parameters<T>) => string;
	} = {},
): T {
	return (async (...args: Parameters<T>) => {
		const { ttl, keyGenerator } = options;
		const cacheKey = keyGenerator
			? `${keyPrefix}:${keyGenerator(...args)}`
			: `${keyPrefix}:${JSON.stringify(args)}`;

		const cached = await get<unknown>(cacheKey);
		if (cached !== null) {
			return cached as Awaited<ReturnType<T>>;
		}

		const result = await fn(...args);

		if (result === null || result === undefined) {
			const redis = await getClient();
			if (redis) {
				try {
					await redis.setEx(`${NULL_CACHE_PREFIX}${cacheKey}`, NULL_CACHE_TTL, "NULL");
				} catch (error) {
					logger.error(`Failed to cache null value for ${cacheKey}: ${error}`);
				}
			}
		} else {
			await set(cacheKey, result, ttl);
		}

		return result;
	}) as T;
}

export async function invalidatePattern(pattern: string): Promise<void> {
	await delPattern(pattern);
}

export async function getCacheStats(): Promise<{
	connected: boolean;
	keyCount: number;
	memoryUsage: string | null;
}> {
	const redis = await getClient();
	if (!redis) return { connected: false, keyCount: 0, memoryUsage: null };

	try {
		const info = await redis.info("memory");
		const keyCount = await redis.dbSize();
		const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
		return {
			connected: true,
			keyCount,
			memoryUsage: memoryMatch ? memoryMatch[1] : null,
		};
	} catch (error) {
		logger.error(`Cache stats error: ${error}`);
		return { connected: false, keyCount: 0, memoryUsage: null };
	}
}

export async function flushCache(): Promise<void> {
	const redis = await getClient();
	if (!redis) return;

	try {
		await redis.flushDb();
	} catch (error) {
		logger.error(`Cache flush error: ${error}`);
	}
}

export async function closeCache(): Promise<void> {
	// Connection lifecycle managed by @/lib/redis
}

export const cacheKeys = {
	prediction: (timeseries: string, algorithm: string, horizon: number) =>
		`prediction:${timeseries}:${algorithm}:${horizon}`,
	query: (sql: string) => `query:${Buffer.from(sql).toString("base64")}`,
	timeseriesData: (timeseriesId: string, from: Date, to: Date) =>
		`ts:data:${timeseriesId}:${from.getTime()}:${to.getTime()}`,
	userSession: (userId: string) => `session:user:${userId}`,
	rateLimit: (identifier: string, endpoint: string) => `ratelimit:${identifier}:${endpoint}`,
	timeseriesList: (datasetId?: string) => `ts:list:${datasetId || "all"}`,
};
