/**
 * Test Context — per-suite isolated test environment
 *
 * Connects to real PostgreSQL and Redis. Each suite gets a unique prefix
 * for all data it creates; cleanup deletes only that suite's data.
 *
 * Usage:
 *   let ctx: TestContext;
 *   beforeAll(async () => { ctx = await createTestContext('my-suite'); });
 *   afterAll(async () => { await destroyTestContext(ctx); });
 *   beforeEach(() => { if (!ctx.available) vi.skip(); });
 */

import { PrismaClient } from "@prisma/client";
import { createClient, type RedisClientType } from "redis";

export interface TestContext {
	prisma: PrismaClient;
	redis: RedisClientType;
	prefix: string;
	available: boolean;
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function resolveDbUrl(): string {
	// CI sets DATABASE_URL to iotdb_enhanced_test
	// test-setup.ts sets it to iotdb_test
	// Fallback for direct runs: try the real DB (integration tests need seed data)
	return (
		process.env.DATABASE_URL ||
		"postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced"
	);
}

export async function createTestContext(
	suiteName: string,
): Promise<TestContext> {
	const prefix = `${suiteName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const dbUrl = resolveDbUrl();

	let prisma: PrismaClient;
	let redis: RedisClientType;
	let available = true;

	try {
		prisma = new PrismaClient({
			log: ["error"],
			datasources: { db: { url: dbUrl } },
		});
		await prisma.$connect();
		await prisma.$executeRaw`SELECT 1`;
	} catch {
		available = false;
		prisma = new PrismaClient({ log: [], datasources: { db: { url: dbUrl } } });
	}

	try {
		redis = createClient({ url: REDIS_URL });
		redis.on("error", () => {});
		await redis.connect();
	} catch {
		available = false;
		redis = createClient({ url: REDIS_URL });
	}

	return { prisma, redis, prefix, available };
}

export async function destroyTestContext(ctx: TestContext): Promise<void> {
	if (!ctx.available) {
		try {
			await ctx.prisma.$disconnect();
		} catch {}
		try {
			await ctx.redis.quit();
		} catch {}
		return;
	}

	// Clean up PostgreSQL data by prefix
	try {
		await ctx.prisma.apiKey.deleteMany({
			where: { name: { startsWith: ctx.prefix } },
		});
	} catch {}
	try {
		await ctx.prisma.watchlist.deleteMany({
			where: { name: { startsWith: ctx.prefix } },
		});
	} catch {}
	try {
		await ctx.prisma.simulationAccount.deleteMany({
			where: { name: { startsWith: ctx.prefix } },
		});
	} catch {}
	try {
		await ctx.prisma.dataset.deleteMany({
			where: { slug: { startsWith: ctx.prefix } },
		});
	} catch {}
	try {
		await ctx.prisma.user.deleteMany({
			where: { email: { startsWith: ctx.prefix } },
		});
	} catch {}

	// Clean up Redis keys by prefix
	try {
		let cursor = 0;
		do {
			const result = await ctx.redis.scan(cursor, {
				MATCH: `*${ctx.prefix}*`,
				COUNT: 100,
			});
			cursor = result.cursor;
			if (result.keys.length > 0) await ctx.redis.del(result.keys);
		} while (cursor !== 0);
	} catch {}

	try {
		await ctx.prisma.$disconnect();
	} catch {}
	try {
		await ctx.redis.quit();
	} catch {}
}
