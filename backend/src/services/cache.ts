/**
 * Cache Service
 * Handles caching for API responses, predictions, and queries using Redis
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '@/lib';

let redisClient: RedisClientType | null = null;

// Cache null values to prevent cache penetration (short TTL)
const NULL_CACHE_TTL = 60; // 1 minute
const NULL_CACHE_PREFIX = 'null:';

/**
 * Initialize Redis connection
 */
export async function initCache() {
  if (redisClient) {
    return redisClient;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return retries * 100; // Reconnect with increasing delay
        },
      },
    }) as RedisClientType;

    redisClient.on('error', (err) => {
      logger.error(`Redis Client Error: ${err}`);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error(`Failed to initialize Redis: ${error}`);
    return null;
  }
}

/**
 * Get a value from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return null;
  }

  try {
    const data = await redisClient.get(key);

    if (!data) {
      // Check if this is a cached null value (cache penetration protection)
      const nullKey = `${NULL_CACHE_PREFIX}${key}`;
      const isNullCached = await redisClient.exists(nullKey);

      if (isNullCached) {
        // Return null for cached null values (cache hit)
        return null;
      }

      return null;
    }

    return JSON.parse(data) as T;
  } catch (error) {
    logger.error(`Cache get error for key ${key}: ${error}`);
    return null;
  }
}

/**
 * Set a value in cache
 */
export async function set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return;
  }

  try {
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await redisClient.setEx(key, ttlSeconds, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  } catch (error) {
    logger.error(`Cache set error for key ${key}: ${error}`);
  }
}

/**
 * Delete a value from cache
 */
export async function del(key: string): Promise<void> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return;
  }

  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error(`Cache delete error for key ${key}: ${error}`);
  }
}

/**
 * Delete multiple keys matching a pattern
 */
export async function delPattern(pattern: string): Promise<void> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);

    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    logger.error(`Cache delete pattern error for ${pattern}: ${error}`);
  }
}

/**
 * Check if a key exists in cache
 */
export async function exists(key: string): Promise<boolean> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return false;
  }

  try {
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (error) {
    logger.error(`Cache exists error for key ${key}: ${error}`);
    return false;
  }
}

/**
 * Increment a counter in cache
 */
export async function incr(key: string): Promise<number> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return 0;
  }

  try {
    return await redisClient.incr(key);
  } catch (error) {
    logger.error(`Cache increment error for key ${key}: ${error}`);
    return 0;
  }
}

/**
 * Set expiration time for a key
 */
export async function expire(key: string, ttlSeconds: number): Promise<void> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return;
  }

  try {
    await redisClient.expire(key, ttlSeconds);
  } catch (error) {
    logger.error(`Cache expire error for key ${key} (${ttlSeconds}s): ${error}`);
  }
}

/**
 * Get multiple keys at once
 */
export async function mget<T>(keys: string[]): Promise<(T | null)[]> {
  if (!redisClient || keys.length === 0) {
    return [];
  }

  try {
    const values = await redisClient.mGet(keys);

    return values.map((value) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    });
  } catch (error) {
    logger.error(`Cache mget error for ${keys.length} keys: ${error}`);
    return keys.map(() => null);
  }
}

/**
 * Set multiple keys at once
 */
export async function mset(items: Array<{ key: string; value: unknown }>): Promise<void> {
  if (!redisClient || items.length === 0) {
    return;
  }

  try {
    const pipeline = redisClient.multi();

    for (const item of items) {
      const serialized = JSON.stringify(item.value);
      pipeline.set(item.key, serialized);
    }

    await pipeline.exec();
  } catch (error) {
    logger.error(`Cache mset error for ${items.length} items: ${error}`);
  }
}

/**
 * Cache wrapper - memoizes function results with null value protection
 */
export function cache<T extends (...args: unknown[]) => Promise<unknown>>(
  keyPrefix: string,
  fn: T,
  options: {
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const { ttl, keyGenerator } = options;

    // Generate cache key
    const cacheKey = keyGenerator
      ? `${keyPrefix}:${keyGenerator(...args)}`
      : `${keyPrefix}:${JSON.stringify(args)}`;

    // Try to get from cache
    const cached = await get<unknown>(cacheKey);
    if (cached !== null) {
      return cached as Awaited<ReturnType<T>>;
    }

    // Execute function
    const result = await fn(...args);

    // Store in cache (including null values to prevent cache penetration)
    if (result === null || result === undefined) {
      // Cache null values with short TTL to prevent cache penetration
      if (redisClient) {
        const nullKey = `${NULL_CACHE_PREFIX}${cacheKey}`;
        try {
          await redisClient.setEx(nullKey, NULL_CACHE_TTL, 'NULL');
        } catch (error) {
          logger.error(`Failed to cache null value for ${cacheKey}: ${error}`);
        }
      }
    } else {
      // Store normal result
      await set(cacheKey, result, ttl);
    }

    return result;
  }) as T;
}

/**
 * Invalidate cache by pattern
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  await delPattern(pattern);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  keyCount: number;
  memoryUsage: string | null;
}> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return {
      connected: false,
      keyCount: 0,
      memoryUsage: null,
    };
  }

  try {
    const info = await redisClient.info('memory');
    const keyCount = await redisClient.dbSize();
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);

    return {
      connected: true,
      keyCount,
      memoryUsage: memoryMatch ? memoryMatch[1] : null,
    };
  } catch (error) {
    logger.error(`Cache stats error: ${error}`);
    return {
      connected: false,
      keyCount: 0,
      memoryUsage: null,
    };
  }
}

/**
 * Flush all cache
 */
export async function flushCache(): Promise<void> {
  if (!redisClient) {
    await initCache();
  }

  if (!redisClient) {
    return;
  }

  try {
    await redisClient.flushDb();
  } catch (error) {
    logger.error(`Cache flush error: ${error}`);
  }
}

/**
 * Close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Cache key generators for common use cases
 */
export const cacheKeys = {
  // AI Prediction cache keys
  prediction: (timeseries: string, algorithm: string, horizon: number) =>
    `prediction:${timeseries}:${algorithm}:${horizon}`,

  // Query result cache keys
  query: (sql: string) => `query:${Buffer.from(sql).toString('base64')}`,

  // Timeseries data cache keys
  timeseriesData: (timeseriesId: string, from: Date, to: Date) =>
    `ts:data:${timeseriesId}:${from.getTime()}:${to.getTime()}`,

  // User session cache keys
  userSession: (userId: string) => `session:user:${userId}`,

  // API rate limit cache keys
  rateLimit: (identifier: string, endpoint: string) =>
    `ratelimit:${identifier}:${endpoint}`,

  // Timeseries list cache keys
  timeseriesList: (datasetId?: string) =>
    `ts:list:${datasetId || 'all'}`,
};
