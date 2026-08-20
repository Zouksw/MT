/**
 * intervalCalibration — split-conformal calibration unit tests.
 *
 * Pins the core guarantees:
 *  - applyConformalInterval replaces bounds multiplicatively, guards
 *    non-positive/non-finite series and missing multipliers (native kept);
 *  - the multiplier derivation achieves ≈1−α empirical coverage on
 *    held-out draws (the entire point of conformal);
 *  - thin evidence (below MIN_CALIBRATION_ROWS) produces no multiplier.
 *
 * The DB-backed getIntervalMultipliers path is exercised through the
 * runAndCache pipeline in integration; here prisma is mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	applyConformalInterval,
	getIntervalMultipliers,
	resetCalibrationCacheForTests,
} from "../intervalCalibration";

const mocks = vi.hoisted(() => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	findMany: vi.fn(),
}));

vi.mock("@/lib", () => ({
	logger: mocks.logger,
	prisma: { predictionLog: { findMany: (...a: unknown[]) => mocks.findMany(...a) } },
}));

function verifiedRow(modelId: string, residuals: number[]) {
	// Reconstruct predicted/actual arrays producing the given relative
	// residuals: actual = 100, predicted = 100 * (1 ± r).
	return {
		modelId,
		predictedValues: residuals.map((r, i) => 100 * (1 + (i % 2 === 0 ? r : -r))),
		actualValues: residuals.map(() => 100),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	resetCalibrationCacheForTests();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("applyConformalInterval", () => {
	it("replaces bounds multiplicatively", () => {
		const out = applyConformalInterval([100, 200], 0.1);
		expect(out.lowerBound?.[0]).toBeCloseTo(90, 8);
		expect(out.lowerBound?.[1]).toBeCloseTo(180, 8);
		expect(out.upperBound?.[0]).toBeCloseTo(110, 8);
		expect(out.upperBound?.[1]).toBeCloseTo(220, 8);
	});

	it("keeps native interval when no multiplier (undefined q)", () => {
		expect(applyConformalInterval([100], undefined)).toEqual({});
	});

	it("keeps native interval for non-positive series (multiplicative form would flip bounds)", () => {
		expect(applyConformalInterval([100, -5], 0.1)).toEqual({});
		expect(applyConformalInterval([0], 0.1)).toEqual({});
	});
});

describe("getIntervalMultipliers", () => {
	it("derives a multiplier with adequate evidence, omits thin models", async () => {
		const thick = Array.from({ length: 100 }, (_, i) => (i + 1) / 1000); // 0.001..0.100
		const thin = [0.01, 0.02, 0.03];
		mocks.findMany.mockResolvedValue([
			verifiedRow("thick_model", thick),
			verifiedRow("thin_model", thin),
		]);

		const m = await getIntervalMultipliers();

		expect(m.has("thick_model")).toBe(true);
		expect(m.has("thin_model")).toBe(false);
		// ~90th percentile of 0.001..0.100 ≈ 0.09 (finite-sample correction
		// pushes it slightly above the plain 90th percentile, 0.090).
		const q = m.get("thick_model") as number;
		expect(q).toBeGreaterThanOrEqual(0.09);
		expect(q).toBeLessThanOrEqual(0.1);
	});

	it("achieves ≈90% empirical coverage on held-out draws (the conformal point)", async () => {
		// Seeded PRNG (mulberry32): the earlier Math.random version flaked near
		// the 0.88 boundary (observed 0.879 on a full-suite run) — a stochastic
		// tolerance is a flaky test, and a deterministic seed keeps the
		// assertion meaningful (same distribution, reproducible draws).
		const mulberry32 = (seed: number) => () => {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		const rng = mulberry32(20260820);
		const draw = () => Math.abs((rng() - 0.5) * 2) / 50; // uniform [0, 0.04]
		const calibration = Array.from({ length: 500 }, draw);
		const heldOut = Array.from({ length: 5000 }, draw);
		mocks.findMany.mockResolvedValue([verifiedRow("m", calibration)]);

		const q = (await getIntervalMultipliers()).get("m") as number;

		let covered = 0;
		for (const r of heldOut) if (r <= q) covered++;
		const coverage = covered / heldOut.length;
		// Finite-sample guarantee: ≥ 1−α. The seed pins the draw set, so these
		// bounds hold deterministically while still pinning the property.
		expect(coverage).toBeGreaterThanOrEqual(0.88);
		expect(coverage).toBeLessThanOrEqual(0.97);
	});
});
