/**
 * intervalCalibration — SQL-side aggregation semantics (round-114).
 *
 * The multiplier derivation (residual extraction via jsonb ordinality join,
 * row-count evidence bar, split-conformal order statistic, test-artifact
 * exclusion) runs entirely in PostgreSQL — this file pins that SQL against
 * the real test DB. The Node-side contract (row mapping, q gate, days-keyed
 * cache, single-flight) is pinned in intervalCalibration.test.ts.
 *
 * Fixtures use unique per-run model/commodity ids whose spellings AVOID the
 * substring "test" — anything containing it is excluded from calibration
 * pools by design (that exclusion is itself under test in one case).
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { getIntervalMultipliers, resetCalibrationCacheForTests } from "../intervalCalibration";

const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const COMMODITY = `calib-fixture-${SUFFIX}`;
const MODEL = `calib-m-${SUFFIX}`;
const THIN = `calib-thin-${SUFFIX}`;
const EXCLUDED = `calib-excl-${SUFFIX}`;
const ZERO_ACTUAL = `calib-zero-${SUFFIX}`;
const POISONED = `calib-poison-${SUFFIX}`;
const COVERAGE = `calib-cov-${SUFFIX}`;
const ALL_MODELS = [MODEL, THIN, EXCLUDED, ZERO_ACTUAL, POISONED, COVERAGE];

/** One verified row whose single-step relative residual is exactly `r`
 * (actual = 100, predicted = 100·(1 − r)). */
function residualRow(modelId: string, r: number, commodityId = COMMODITY) {
	return {
		modelId,
		commodityId,
		horizon: 1,
		predictedValues: [100 * (1 - r)],
		actualValues: [100],
		status: "verified",
		predictedAt: new Date(Date.now() - 20 * 86400000),
		verifiedAt: new Date(),
	};
}

/** mulberry32 — deterministic draws so coverage assertions can't flake
 * (same rationale as the round-113 unit test it replaces). */
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

beforeEach(() => {
	resetCalibrationCacheForTests();
});

afterAll(async () => {
	await prisma.predictionLog.deleteMany({ where: { modelId: { in: ALL_MODELS } } });
});

describe("getIntervalMultipliers — SQL semantics (real DB)", () => {
	it("derives the order statistic from ≥30 verified rows and drops thin pools", async () => {
		// 40 distinct ascending residuals 0.010..0.049: the ⌈41·0.9⌉ = 37th
		// order statistic (index 36) is 0.010 + 36·0.001 = 0.046.
		const residuals = Array.from({ length: 40 }, (_, i) => 0.01 + i * 0.001);
		await prisma.predictionLog.createMany({
			data: [
				...residuals.map((r) => residualRow(MODEL, r)),
				// 5 rows of residual 0.02 — below MIN_CALIBRATION_ROWS (30).
				...Array.from({ length: 5 }, () => residualRow(THIN, 0.02)),
			],
		});

		const m = await getIntervalMultipliers();

		expect(m.get(MODEL)).toBeCloseTo(0.046, 6);
		expect(m.has(THIN)).toBe(false);
	});

	it("counts ROWS against the bar even when a row contributes no valid residual", async () => {
		// 35 rows with actual = 0: the row bar passes (35 ≥ 30) but every
		// residual is invalid (zero actual) — no multiplier must be served.
		// This is the degenerate case that keeps the SQL rank clamp honest.
		await prisma.predictionLog.createMany({
			data: Array.from({ length: 35 }, () => ({
				modelId: ZERO_ACTUAL,
				commodityId: COMMODITY,
				horizon: 1,
				predictedValues: [100],
				actualValues: [0],
				status: "verified",
				predictedAt: new Date(Date.now() - 20 * 86400000),
				verifiedAt: new Date(),
			})),
		});

		expect((await getIntervalMultipliers()).has(ZERO_ACTUAL)).toBe(false);
	});

	it("excludes rows whose commodity id contains 'test' (case-insensitive)", async () => {
		// 40 healthy rows under a commodity whose id contains "Test" — the
		// pool must stay empty: leaked fixtures must not calibrate real
		// models (round-113, A1-1).
		await prisma.predictionLog.createMany({
			data: Array.from({ length: 40 }, (_, i) =>
				residualRow(EXCLUDED, 0.01 + i * 0.001, `calib-Test-${SUFFIX}`),
			),
		});

		expect((await getIntervalMultipliers()).has(EXCLUDED)).toBe(false);
	});

	it("rejects q ≥ 1 instead of serving negative lower bounds", async () => {
		await prisma.predictionLog.createMany({
			data: Array.from({ length: 40 }, () => residualRow(POISONED, 1.2)),
		});

		expect((await getIntervalMultipliers()).has(POISONED)).toBe(false);
	});

	it("achieves ≈90% empirical coverage on held-out draws (the conformal point)", async () => {
		// 300 seeded uniform [0, 0.04] residuals: the SQL q must equal the
		// JS order statistic exactly, and the finite-sample coverage
		// guarantee (≥ 1−α on exchangeable draws) must hold on 5000
		// held-out draws from the same generator.
		const rng = mulberry32(20260821);
		const draw = () => rng() / 25; // uniform [0, 0.04]
		const calibration = Array.from({ length: 300 }, draw);
		const heldOut = Array.from({ length: 5000 }, draw);
		await prisma.predictionLog.createMany({
			data: calibration.map((r) => residualRow(COVERAGE, r)),
		});

		const q = (await getIntervalMultipliers()).get(COVERAGE) as number;

		// Same arithmetic the SQL performs: ⌈(n+1)(1−α)⌉-th smallest, clamped.
		const sorted = [...calibration].sort((a, b) => a - b);
		const level = Math.min(Math.ceil((sorted.length + 1) * 0.9), sorted.length);
		expect(q).toBeCloseTo(sorted[level - 1], 8);

		let covered = 0;
		for (const r of heldOut) if (r <= q) covered++;
		const coverage = covered / heldOut.length;
		expect(coverage).toBeGreaterThanOrEqual(0.88);
		expect(coverage).toBeLessThanOrEqual(0.97);
	});
});
