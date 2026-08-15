/**
 * latestUsdRate (round-104): shared FX lookup for scraper conversions.
 *
 * Replaces the hardcoded 0.65 (mlaNlrs AUD) / 0.18 (cepea BRL) constants
 * that drifted up to ~8% from the real rate. Key contract points:
 * - magnitude normalization: fred DEX* series quote foreign-per-USD (~5.0
 *   for DEXBZUS) while exchange_rate_api quotes USD-per-unit (~0.19) —
 *   the helper must return USD-per-unit in both cases;
 * - no authoritative row → null (honest absence), never a fallback constant;
 * - reads the authoritative source for the pair (brl_usd → fred).
 *
 * DB-backed: the seed provides fred DEXBZUS rows (~4.6-5.6 band) for
 * brl_usd; aud_usd also exists via the exchange_rate_api/ fred mix.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { latestUsdRate } from "@/services/dataIngestion/helpers";
import { requireDb } from "@/test/helpers/testApp";

const MISSING_SLUG = `r104_missing_${Date.now()}`;
const createdIds: string[] = [];

beforeAll(async () => {
	await requireDb("latestUsdRate");
});

afterAll(async () => {
	if (createdIds.length > 0) {
		await prisma.commodity.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
	}
});

describe("latestUsdRate — direction normalization + honest null", () => {
	it("brl_usd (fred DEXBZUS, BRL-per-USD ≈ 5) returns USD-per-BRL ≈ 0.2", async () => {
		const rate = await latestUsdRate("brl_usd");
		expect(rate).not.toBeNull();
		// DEXBZUS band ~4.6-5.6 → USD/BRL ~0.18-0.22
		expect(rate as number).toBeGreaterThan(0.1);
		expect(rate as number).toBeLessThan(0.3);
	});

	it("aud_usd returns a plausible USD-per-AUD (0.5-0.9 band)", async () => {
		const rate = await latestUsdRate("aud_usd");
		expect(rate).not.toBeNull();
		expect(rate as number).toBeGreaterThan(0.5);
		expect(rate as number).toBeLessThan(0.9);
	});

	it("returns null for a pair with no rows — no fallback constant", async () => {
		const rate = await latestUsdRate(MISSING_SLUG);
		expect(rate).toBeNull();
	});

	it("rejects non-positive close values as unavailable", async () => {
		// A corrupted zero-price row must not yield a 0 rate (divide-by-zero
		// territory for callers doing price × rate).
		const commodity = await prisma.commodity.create({
			data: {
				slug: `r104_zero_${Date.now()}`,
				name: "Zero FX fixture",
				category: "exchange_rate",
				unit: "rate",
			},
		});
		createdIds.push(commodity.id);
		await prisma.commodityPrice.create({
			data: {
				commodityId: commodity.id,
				date: new Date(),
				interval: "daily",
				source: "r104-test",
				open: 0,
				high: 0,
				low: 0,
				close: 0,
			},
		});
		const rate = await latestUsdRate(commodity.slug);
		expect(rate).toBeNull();
	});
});
