/**
 * Database client singleton
 * Prevents connection exhaustion by reusing PrismaClient instance
 */

import { PrismaClient } from "@prisma/client";

// Declare global type for Prisma singleton
declare global {
	var _prismaSingleton: PrismaClient | undefined;
}

// Create or reuse Prisma client instance
export const prisma =
	global._prismaSingleton ??
	new PrismaClient({
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});

// Add Prisma middleware for query logging
prisma.$use(async (params, next) => {
	return await next(params);
});

// In development, attach to global to prevent hot-reload creating multiple instances
if (process.env.NODE_ENV !== "production") {
	global._prismaSingleton = prisma;
}

// Graceful shutdown
process.on("beforeExit", async () => {
	await prisma.$disconnect();
});

export default prisma;
