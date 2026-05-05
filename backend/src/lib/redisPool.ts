/**
 * Redis Connection Pool and Utilities
 *
 * Provides optimized Redis connection management with:
 * - Connection pooling
 * - Automatic reconnection
 * - Performance monitoring
 * - Health checks
 */

import { createClient } from "redis";
import { logger } from "./logger";

/**
 * Redis pool configuration
 */
export interface RedisPoolConfig {
	host: string;
	port: number;
	password?: string;
	db?: number;
	maxRetriesPerRequest?: number;
	enableReadyCheck?: boolean;
	enableOfflineQueue?: boolean;
	connectionTimeout?: number;
}

/**
 * Redis pool statistics
 */
export interface RedisPoolStats {
	totalConnections: number;
	activeConnections: number;
	waitingClients: number;
	maxPoolSize: number;
	minPoolSize: number;
}

/**
 * Default Redis configuration
 */
const DEFAULT_CONFIG: Partial<RedisPoolConfig> = {
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
	enableOfflineQueue: true,
	connectionTimeout: 10000,
};

/**
 * Redis Connection Pool Class
 */
export class RedisPool {
	private clients: Map<string, ReturnType<typeof createClient>> = new Map();
	private config: RedisPoolConfig;
	private isShuttingDown = false;

	constructor(config: RedisPoolConfig) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Get or create a Redis client
	 */
	async getClient(name: string = "default"): Promise<ReturnType<typeof createClient>> {
		if (this.isShuttingDown) {
			throw new Error("Redis pool is shutting down");
		}

		// Return existing client if available
		if (this.clients.has(name)) {
			const client = this.clients.get(name)!;
			if (client.isOpen) {
				return client;
			}
			this.clients.delete(name);
		}

		// Create new client
		const client = this.createClient(name);
		this.clients.set(name, client);
		return client;
	}

	/**
	 * Create a new Redis client
	 */
	private createClient(name: string): ReturnType<typeof createClient> {
		const client = createClient({
			socket: {
				host: this.config.host,
				port: this.config.port,
				connectTimeout: this.config.connectionTimeout,
			},
			password: this.config.password,
			database: this.config.db,
		});

		client.on("error", (err: Error) => {
			logger.error(`Redis client "${name}" error: ${err}`);
		});

		client.on("connect", () => {
			logger.info(`Redis client "${name}" connected`);
		});

		return client;
	}

	/**
	 * Execute a command using a specific client
	 */
	async execute<T>(
		clientName: string,
		command: (client: ReturnType<typeof createClient>) => Promise<T>,
	): Promise<T> {
		const client = await this.getClient(clientName);

		try {
			return await command(client);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Redis command failed on "${clientName}": ${message}`);

			// Retry on connection errors
			if (message.includes("Connection is closed")) {
				this.clients.delete(clientName);
				logger.info(`Retrying command on new Redis client "${clientName}"...`);
				const newClient = await this.getClient(clientName);
				return await command(newClient);
			}

			throw error;
		}
	}

	/**
	 * Health check for Redis
	 */
	async healthCheck(clientName: string = "default"): Promise<boolean> {
		try {
			const client = await this.getClient(clientName);
			await client.ping();
			return true;
		} catch (error) {
			logger.error(`Redis health check failed: ${error}`);
			return false;
		}
	}

	/**
	 * Get pool statistics
	 */
	getStats(): RedisPoolStats {
		return {
			totalConnections: this.clients.size,
			activeConnections: Array.from(this.clients.values()).filter(
				(c) => c.isOpen,
			).length,
			waitingClients: 0,
			maxPoolSize: this.clients.size,
			minPoolSize: 1,
		};
	}

	/**
	 * Close all Redis connections
	 */
	async closeAll(): Promise<void> {
		this.isShuttingDown = true;
		logger.info("Closing all Redis connections...");

		const closePromises = Array.from(this.clients.entries()).map(
			async ([name, client]) => {
				try {
					await client.quit();
					logger.info(`Redis client "${name}" closed`);
				} catch (error) {
					logger.error(`Error closing Redis client "${name}": ${error}`);
				}
			},
		);

		await Promise.all(closePromises);
		this.clients.clear();
		logger.info("All Redis connections closed");
	}

	/**
	 * Remove idle clients
	 */
	removeIdleClient(clientName: string): void {
		const client = this.clients.get(clientName);
		if (client && !client.isOpen) {
			client.disconnect();
			this.clients.delete(clientName);
			logger.info(`Removed idle Redis client "${clientName}"`);
		}
	}
}

// ============================================================================
// Singleton Redis Pool Instance
// ============================================================================

let redisPoolInstance: RedisPool | null = null;

/**
 * Initialize Redis pool
 */
export function initRedisPool(): RedisPool {
	if (!redisPoolInstance) {
		const config: RedisPoolConfig = {
			host: process.env.REDIS_HOST || "localhost",
			port: parseInt(process.env.REDIS_PORT || "6379", 10),
			password: process.env.REDIS_PASSWORD,
			db: parseInt(process.env.REDIS_DB || "0", 10),
		};

		redisPoolInstance = new RedisPool(config);
		logger.info("Redis pool initialized");
	}

	return redisPoolInstance;
}

/**
 * Get Redis pool instance
 */
export function getRedisPool(): RedisPool {
	if (!redisPoolInstance) {
		throw new Error("Redis pool not initialized. Call initRedisPool() first.");
	}
	return redisPoolInstance;
}

/**
 * Close Redis pool (for graceful shutdown)
 */
export async function closeRedisPool(): Promise<void> {
	if (redisPoolInstance) {
		await redisPoolInstance.closeAll();
		redisPoolInstance = null;
	}
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Execute Redis command using default client
 */
export async function withRedis<T>(
	// biome-ignore lint/suspicious/noExplicitAny: Redis client type is library-specific
	command: (client: any) => Promise<T>,
): Promise<T> {
	const pool = getRedisPool();
	return pool.execute("default", command);
}

/**
 * Get Redis client
 */
export async function getRedisClient(): Promise<ReturnType<typeof createClient>> {
	const pool = getRedisPool();
	return pool.getClient("default");
}
