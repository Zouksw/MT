/**
 * beefCalibration (round-164 批0b) — the gating suite. The calibrated band
 * must appear ONLY for the series/horizons the backtest evidence covers;
 * every other combination fails closed to null so callers keep their honest
 * disagreement-range labeling.
 *
 * Constants pin the evidence doc (36/34 origins, deterministic replay) —
 * if someone edits the constants without re-deriving them from a re-run,
 * these tests catch the drift.
 */
import { describe, expect, test } from "vitest";
import {
	type BeefCalibratedInterval,
	CALIBRATED_SLUG,
	CALIBRATION_SOURCE,
	calibratedBeefInterval,
} from "@/services/beefCalibration";

const P = 331.78; // latest IMF benchmark close — a realistic anchor

/** Guard-narrow: fail the test loudly if the gate unexpectedly returned null. */
function requireBand(
	slug: string | undefined,
	interval: "daily" | "monthly" | undefined,
	horizon: number,
	price: number,
): BeefCalibratedInterval {
	const band = calibratedBeefInterval(slug, interval, horizon, price);
	if (!band) throw new Error(`expected a calibrated band for ${slug} H=${horizon}`);
	return band;
}

describe("calibratedBeefInterval — gates (fail closed)", () => {
	test("attaches for the beef monthly benchmark at H=1 and H=3", () => {
		for (const horizon of [1, 3]) {
			const band = requireBand(CALIBRATED_SLUG, "monthly", horizon, P);
			expect(band.lower).toBeLessThan(P);
			expect(band.upper).toBeGreaterThan(P);
			expect(band.lower).toBeLessThan(band.upper);
			expect(band.level).toBe(0.9);
			expect(band.source).toBe(CALIBRATION_SOURCE);
		}
	});

	test("wrong slug → null (cut keys, other commodities, undefined)", () => {
		expect(calibratedBeefInterval("beef_retail_us", "monthly", 1, P)).toBeNull();
		expect(calibratedBeefInterval("cut:AU-847:STRIPLOIN", "monthly", 1, P)).toBeNull();
		expect(calibratedBeefInterval(undefined, "monthly", 1, P)).toBeNull();
	});

	test("non-monthly cadence → null (daily pool must never wear beef bands)", () => {
		expect(calibratedBeefInterval(CALIBRATED_SLUG, "daily", 1, P)).toBeNull();
		expect(calibratedBeefInterval(CALIBRATED_SLUG, undefined, 1, P)).toBeNull();
	});

	test("unsupported horizon → null (no evidence for H=10 etc.)", () => {
		expect(calibratedBeefInterval(CALIBRATED_SLUG, "monthly", 10, P)).toBeNull();
		expect(calibratedBeefInterval(CALIBRATED_SLUG, "monthly", 2, P)).toBeNull();
	});

	test("non-finite or non-positive price → null", () => {
		expect(calibratedBeefInterval(CALIBRATED_SLUG, "monthly", 1, Number.NaN)).toBeNull();
		expect(calibratedBeefInterval(CALIBRATED_SLUG, "monthly", 1, 0)).toBeNull();
		expect(calibratedBeefInterval(CALIBRATED_SLUG, "monthly", 1, -5)).toBeNull();
	});
});

describe("calibratedBeefInterval — constants pin the evidence doc", () => {
	// H=1: p5=-2.7573% p95=+5.3999% (n=36), band = price × (1+q/100), 2dp.
	test("H=1 band matches the backtest residual quantiles", () => {
		const band = requireBand(CALIBRATED_SLUG, "monthly", 1, P);
		expect(band.residualP5Pct).toBeCloseTo(-2.7573, 4);
		expect(band.residualP95Pct).toBeCloseTo(5.3999, 4);
		expect(band.sampleSize).toBe(36);
		expect(band.lower).toBeCloseTo(322.63, 2);
		expect(band.upper).toBeCloseTo(349.7, 2);
	});

	// H=3: p5=-2.8886% p95=+13.0688% (n=34) — the wider quarterly band.
	test("H=3 band is wider than H=1 and matches its quantiles", () => {
		const h1 = requireBand(CALIBRATED_SLUG, "monthly", 1, P);
		const h3 = requireBand(CALIBRATED_SLUG, "monthly", 3, P);
		expect(h3.residualP5Pct).toBeCloseTo(-2.8886, 4);
		expect(h3.residualP95Pct).toBeCloseTo(13.0688, 4);
		expect(h3.sampleSize).toBe(34);
		expect(h3.upper - h3.lower).toBeGreaterThan(h1.upper - h1.lower);
	});

	test("band scales linearly with the consensus price", () => {
		const a = requireBand(CALIBRATED_SLUG, "monthly", 1, 100);
		expect(a.lower).toBeCloseTo(97.24, 2);
		expect(a.upper).toBeCloseTo(105.4, 2);
	});
});
