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
		// No null-cache sentinel handling: nothing ever writes "null:"-prefixed
		// keys (set() below never did), so a miss is just a miss — checking a
		// sentinel would be a wasted EXISTS round-trip on every miss.
		if (!data) return null;
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

// Cache key builders. Pruned to the one key family actually consumed in
// production (prediction:{ts}:{algo}:{horizon}, used by predictionCache.ts +
// routes/inference.ts). The query/timeseriesData/userSession/rateLimit/
// timeseriesList builders were carried over from an earlier cache design but
// had zero callers (verified 2026-08-01 via `command grep -rn 'cacheKeys\.<m>'`
// across backend/src excluding tests). Re-add a builder when its caller lands.
export const cacheKeys = {
	prediction: (timeseries: string, algorithm: string, horizon: number) =>
		`prediction:${timeseries}:${algorithm}:${horizon}`,
};
