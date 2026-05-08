/**
 * Integration Test App Builder
 *
 * Creates a fully wired Express app for integration tests.
 * Uses real PostgreSQL, real Redis, real middleware chain.
 * Only external services (inference, email) are mocked.
 *
 * Usage:
 *   const { app, prisma, authToken, userId, cleanup } = await createAuthenticatedTestApp({
 *     routes: [{ path: '/api/alerts', router: alertsRouter }],
 *   });
 *   // ... test with real DB + real Redis + real middleware ...
 *   await cleanup();
 */

import { PrismaClient } from "@prisma/client";
import express, { type Express, type Router } from "express";
import request from "supertest";
import { errorHandler } from "@/middleware/errorHandler";

const TEST_PASSWORD = "SecurePass123!";

interface RouteConfig {
	path: string;
	router: Router;
}

interface TestAppResult {
	app: Express;
	prisma: PrismaClient;
	authToken: string;
	userId: string;
	email: string;
	cleanup: () => Promise<void>;
}

/**
 * Check if required infrastructure (PostgreSQL) is available.
 */
export async function checkInfrastructure(): Promise<{
	db: boolean;
	prisma?: PrismaClient;
}> {
	try {
		const prisma = new PrismaClient({ log: ["error"] });
		await prisma.$connect();
		await prisma.$executeRaw`SELECT 1`;
		return { db: true, prisma };
	} catch {
		return { db: false };
	}
}

/**
 * Create an authenticated test application with real database connections.
 *
 * Automatically registers a test user and obtains a valid JWT token.
 * All routes go through real middleware (auth, error handling).
 *
 * @param routes - Array of route configs to mount on the app
 * @param options - Optional configuration
 * @returns Test app with auth token and cleanup function
 */
export async function createAuthenticatedTestApp(
	routes: RouteConfig[] = [],
	options: {
		prefix?: string;
	} = {},
): Promise<TestAppResult> {
	const { prefix = "" } = options;
	const infra = await checkInfrastructure();
	if (!infra.db || !infra.prisma) {
		throw new Error("Database not available. Skipping integration test.");
	}

	const prisma = infra.prisma;
	const app = express();
	app.use(express.json());

	// Mount auth routes (always needed for user registration)
	const { authRouter } = await import("@/routes/auth");
	app.use(`${prefix}/auth`, authRouter);

	// Mount requested routes
	for (const { path, router } of routes) {
		app.use(`${prefix}${path}`, router);
	}

	// Error handler must be last
	app.use(errorHandler);

	// Register a test user
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).slice(2, 8);
	const email = `test-${timestamp}-${randomSuffix}@integration.test`;
	const testName = `Integration Test ${randomSuffix}`;

	const reg = await request(app)
		.post(`${prefix}/auth/register`)
		.send({ email, password: TEST_PASSWORD, name: testName });

	let authToken: string;
	let userId: string;

	if (reg.status === 201 && reg.body?.data?.token) {
		authToken = reg.body.data.token;
		userId = reg.body.data.user.id;
	} else if (reg.status === 409 || reg.status === 429) {
		// User already exists or rate limited — try login
		const login = await request(app)
			.post(`${prefix}/auth/login`)
			.send({ email, password: TEST_PASSWORD });

		if (login.status === 200 && login.body?.data?.token) {
			authToken = login.body.data.token;
			userId = login.body.data.user.id;
		} else {
			throw new Error(
				`Failed to create or login test user. Register: ${reg.status}, Login: ${login.status}`,
			);
		}
	} else {
		throw new Error(
			`Failed to register test user: ${reg.status} ${JSON.stringify(reg.body)}`,
		);
	}

	const cleanup = async () => {
		try {
			// Delete test user (cascades to related records)
			await prisma.user.delete({ where: { id: userId } }).catch(() => {});
		} catch {
			// Ignore cleanup errors
		}
		await prisma.$disconnect();
	};

	return { app, prisma, authToken, userId, email, cleanup };
}
