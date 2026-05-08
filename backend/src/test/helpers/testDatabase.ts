/**
 * Real Database Test Infrastructure
 *
 * Provides helpers for tests that connect to real PostgreSQL and Redis.
 * No Docker required — uses the system-installed services.
 *
 * Usage:
 *   beforeAll(() => setupTestDatabase());
 *   afterAll(() => teardownTestDatabase());
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";

let testPrisma: PrismaClient;
let testRedis: ReturnType<typeof createClient>;

/**
 * Connect to the test PostgreSQL database.
 * Requires DATABASE_URL env var (set by CI or jest.setup.js).
 */
export async function setupTestDatabase(): Promise<{ prisma: PrismaClient }> {
	testPrisma = new PrismaClient({
		datasources: {
			db: {
				url:
					process.env.DATABASE_URL ||
					"postgresql://postgres:postgres@localhost:5432/iotdb_enhanced_test",
			},
		},
		log: ["error"],
	});

	// Verify connection
	await testPrisma.$connect();
	await testPrisma.$executeRaw`SELECT 1`;

	return { prisma: testPrisma };
}

/**
 * Connect to the test Redis instance.
 * Requires REDIS_URL env var (set by CI or jest.setup.js).
 */
export async function setupTestRedis() {
	testRedis = createClient({
		url: process.env.REDIS_URL || "redis://localhost:6379",
	});
	await testRedis.connect();
	return testRedis;
}

/**
 * Clean up all test data from the database.
 * Truncates tables in correct order (respecting foreign keys).
 */
export async function cleanupDatabase(prisma: PrismaClient) {
	const tablenames = [
		"audit_log",
		"alert",
		"alert_rule",
		"api_key",
		"datapoint",
		"timeseries",
		"dataset",
		"forecasting_model",
		"session",
		"user",
		"organizations",
	];

	for (const table of tablenames) {
		try {
			await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
		} catch {
			// Table may not exist — skip silently
		}
	}
}

/**
 * Clean up test keys from Redis.
 */
export async function cleanupRedis(
	redis: ReturnType<typeof createClient>,
	prefix = "test:",
) {
	try {
		const keys = await redis.keys(`${prefix}*`);
		if (keys.length > 0) {
			await redis.del(keys);
		}
	} catch {
		// Redis may not be available — skip silently
	}
}

/**
 * Full teardown: disconnect from database and Redis.
 */
export async function teardownTestDatabase() {
	if (testPrisma) {
		await testPrisma.$disconnect();
	}
	if (testRedis) {
		try {
			await testRedis.quit();
		} catch {
			// Already disconnected
		}
	}
}

/**
 * Create a test user directly in the database.
 * Returns the user record and a valid JWT token.
 */
export async function createDatabaseUser(
	prisma: PrismaClient,
	overrides: {
		email?: string;
		name?: string;
		passwordHash?: string;
		role?: string;
	} = {},
) {
	const email =
		overrides.email ||
		`test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
	const user = await prisma.user.create({
		data: {
			email,
			name: overrides.name || "Test User",
			passwordHash: overrides.passwordHash || "$2b$12$hashedpassword",
			role: (overrides.role || "VIEWER") as "VIEWER" | "EDITOR" | "ADMIN",
		},
	});
	return user;
}

/**
 * Create a test dataset directly in the database.
 */
export async function createDatabaseDataset(
	prisma: PrismaClient,
	userId: string,
	overrides: {
		name?: string;
		slug?: string;
		storageFormat?: string;
	} = {},
) {
	// Ensure a default org exists
	let org = await prisma.organizations.findFirst();
	if (!org) {
		org = await prisma.organizations.create({
			data: {
				id: "test-org-id",
				name: "Test Org",
				slug: "test-org",
				owner_id: userId,
			},
		});
	}

	const name = overrides.name || `Test Dataset ${Date.now()}`;
	const dataset = await prisma.dataset.create({
		data: {
			name,
			slug:
				overrides.slug ||
				name
					.toLowerCase()
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, ""),
			storageFormat: (overrides.storageFormat || "TIMESERIES") as
				| "TIMESERIES"
				| "INFLUXDB"
				| "OPENML",
			ownerId: userId,
			organization_id: org.id,
		},
	});
	return dataset;
}
