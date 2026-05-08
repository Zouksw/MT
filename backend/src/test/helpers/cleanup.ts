/**
 * Test cleanup helpers
 *
 * Provides utility functions for cleaning up test data
 * from databases after tests run.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Cleanup options for selective cleanup
 */
export interface CleanupOptions {
	users?: boolean;
	apiKeys?: boolean;
	alerts?: boolean;
	alertRules?: boolean;
	datasets?: boolean;
	auditLogs?: boolean;
	authLockouts?: boolean;
	tokenBlacklist?: boolean; // Redis
}

/**
 * Cleans up all test data from PostgreSQL database
 *
 * @param options - Selective cleanup options (default: all true)
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * // Clean up everything
 * await cleanupTestData();
 *
 * // Clean up only users and API keys
 * await cleanupTestData({ users: true, apiKeys: true });
 * ```
 */
export async function cleanupTestData(
	options: CleanupOptions = {},
): Promise<void> {
	const opts: Required<CleanupOptions> = {
		users: true,
		apiKeys: true,
		alerts: true,
		alertRules: true,
		datasets: true,
		auditLogs: true,
		authLockouts: true,
		tokenBlacklist: true,
		...options,
	};

	try {
		// Clean up in order of dependencies (foreign keys)
		if (opts.alerts) {
			await prisma.alert.deleteMany({
				where: { id: { contains: "test-" } },
			});
		}

		if (opts.alertRules) {
			await prisma.alertRule.deleteMany({
				where: {
					OR: [
						{ name: { contains: "test-" } },
						{ timeseriesId: { contains: "root.test" } },
					],
				},
			});
		}

		if (opts.apiKeys) {
			await prisma.apiKey.deleteMany({
				where: { id: { contains: "iotd_" } },
			});
		}

		if (opts.datasets) {
			await prisma.dataset.deleteMany({
				where: { name: { contains: "test-" } },
			});
		}

		if (opts.auditLogs) {
			await prisma.auditLog.deleteMany({
				where: { userId: { contains: "test-user-id" } },
			});
		}

		if (opts.authLockouts) {
			// Note: authLockouts are stored in Redis, handled separately
			await cleanupRedisTestData();
		}

		if (opts.users) {
			await prisma.user.deleteMany({
				where: { email: { contains: "test-" } },
			});
		}
	} catch (error) {
		console.error("Error cleaning up test data:", error);
		throw error;
	}
}

/**
 * Cleans up test data from Redis
 *
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * await cleanupRedisTestData();
 * ```
 */
export async function cleanupRedisTestData(): Promise<void> {
	try {
		// Note: This is a placeholder. In actual implementation, you would:
		// 1. Get Redis client
		// 2. Scan for keys matching patterns like:
		//    - auth:lockout:test-*
		//    - blacklist:test-*
		//    - csrf:test-*
		// 3. Delete matching keys
		//
		// For now, this is a no-op to avoid Redis dependency in helper
		console.warn(
			"Redis cleanup not implemented in helper (use test setup/teardown)",
		);
	} catch (error) {
		console.error("Error cleaning up Redis test data:", error);
		throw error;
	}
}

/**
 * Cleans up test time series
 *
 * @param timeseries - Array of time series to delete (default: all root.test.*)
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * // Clean up specific time series
 * await cleanupTestTimeseries(['root.test.device1.temperature']);
 *
 * // Clean up all test time series
 * await cleanupTestTimeseries();
 * ```
 */
export async function cleanupTestTimeseries(
	_timeseries?: string[],
): Promise<void> {
	try {
		// Note: This is a placeholder. In actual implementation, you would:
		// 1. Get database client
		// 2. If timeseries provided, delete those specific series
		// 3. If no timeseries, delete all matching root.test.*
		// 4. Use database queries to delete
		//
		// For now, this is a no-op placeholder
		console.warn(
			"Timeseries cleanup not implemented in helper (use test setup/teardown)",
		);
	} catch (error) {
		console.error("Error cleaning up test timeseries data:", error);
		throw error;
	}
}

/**
 * Cleans up test data by test ID prefix
 *
 * Useful for cleaning up data created in a specific test
 *
 * @param testId - Test ID or prefix
 * @param options - Cleanup options
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * // In a test
 * const testId = `test-login-${Date.now()}`;
 * // ... create test data with testId prefix ...
 * await cleanupByTestId(testId);
 * ```
 */
export async function cleanupByTestId(
	testId: string,
	_options: CleanupOptions = {},
): Promise<void> {
	try {
		// Clean up users with this test ID
		await prisma.user.deleteMany({
			where: { id: { contains: testId } },
		});

		// Clean up other entities with this test ID
		await prisma.apiKey.deleteMany({
			where: { userId: { contains: testId } },
		});

		await prisma.alert.deleteMany({
			where: { userId: { contains: testId } },
		});
	} catch (error) {
		console.error(`Error cleaning up test data for ${testId}:`, error);
		throw error;
	}
}

/**
 * Cleans up all test data (comprehensive cleanup)
 *
 * Use this in afterAll() hooks to ensure clean state
 *
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * afterAll(async () => {
 *   await cleanupAllTestData();
 * });
 * ```
 */
export async function cleanupAllTestData(): Promise<void> {
	try {
		// Delete in order of dependencies
		await prisma.alert.deleteMany({});
		await prisma.alertRule.deleteMany({});
		await prisma.apiKey.deleteMany({});
		await prisma.dataset.deleteMany({});
		await prisma.auditLog.deleteMany({});
		await prisma.user.deleteMany({
			where: { email: { contains: "test-" } },
		});

		// Note: Redis cleanup would be done separately
		// with their respective clients
	} catch (error) {
		console.error("Error in comprehensive cleanup:", error);
		throw error;
	}
}

/**
 * Verifies that test data was cleaned up
 *
 * @param options - What to verify
 * @returns True if cleanup was successful
 *
 * @example
 * ```typescript
 * const cleaned = await verifyCleanup();
 * expect(cleaned).toBe(true);
 * ```
 */
export async function verifyCleanup(
	options: CleanupOptions = {},
): Promise<boolean> {
	const opts = {
		users: true,
		apiKeys: true,
		alerts: true,
		...options,
	};

	try {
		if (opts.users) {
			const userCount = await prisma.user.count({
				where: { email: { contains: "test-" } },
			});
			if (userCount > 0) return false;
		}

		if (opts.apiKeys) {
			const keyCount = await prisma.apiKey.count({
				where: { id: { contains: "iotd_" } },
			});
			if (keyCount > 0) return false;
		}

		if (opts.alerts) {
			const alertCount = await prisma.alert.count({
				where: { id: { contains: "test-" } },
			});
			if (alertCount > 0) return false;
		}

		return true;
	} catch (error) {
		console.error("Error verifying cleanup:", error);
		return false;
	}
}
