/**
 * Cache Service
 * Handles caching for API responses, predictions, and queries using Redis.
 * Delegates connection management to @/lib/redis for a single shared connection.
 *
 * Pruned to the 3 symbols actually consumed (get / set / cacheKeys).
 * The generic HOF wrapper and unused admin ops (flush/stats/mget/mset/incr/...)
 * were 0-caller dead code; removed to stop carrying unmaintained surface area.
 */

import type { RedisClientType } from "redis";
import { logger } from "@/lib";
import { getRedisClient } from "@/lib/redis";

const NULL_CACHE_PREFIX = "null:";

async function getClient(): Promise<RedisClientType | null> {
	try {
		return await getRedisClient();
	} catch {
		// intentionally ignored — Redis unavailable, all cache ops return null/false
		return null;
	}
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
