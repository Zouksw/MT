/**
 * Landing-cost calculator — pure-function contracts (v3.2.0 批 3).
 *
 * Pins the two pieces every downstream number rests on:
 *   1. Unit conversion (USC/lb and USD/cwt both divide by 100 to reach
 *      USD/lb — cents→dollars vs per-100lb→per-lb — then × lb/kg), with
 *      unknown dimensions REFUSED (null), never guessed.
 *   2. The landed-cost formula ordering: duty on cost base, VAT on
 *      (cost base + duty) — the China import convention — loss applied
 *      after tax.
 * Route-level behavior lives in routes/__tests__/tools.test.ts.
 */

import { describe, expect, it } from "vitest";
import { computeLandedCost, type LandedCostParams, toUsdPerKg } from "@/services/landingCost";

describe("toUsdPerKg", () => {
	it("converts USC/lb (US cents per lb) via /100 then lb→kg", () => {
		// 100 USC/lb = 1 USD/lb = 2.20462262185 USD/kg — the anchor identity.
		expect(toUsdPerKg(100, "USC/lb")).toBeCloseTo(2.20462262185, 10);
		// IMF beef benchmark magnitude: ~331.78 USC/lb ≈ 7.31 USD/kg.
		expect(toUsdPerKg(331.78, "USC/lb")).toBeCloseTo(7.3145, 3);
	});

	it("converts USD/cwt via /100 (per 100 lb) then lb→kg", () => {
		// 100 USD/cwt = 1 USD/lb — same anchor, different dimension origin.
		expect(toUsdPerKg(100, "USD/cwt")).toBeCloseTo(2.20462262185, 10);
		// Live cattle magnitude: ~211.7 USD/cwt ≈ 4.668 USD/kg.
		expect(toUsdPerKg(211.725, "USD/cwt")).toBeCloseTo(4.6677, 3);
	});

	it("passes USD/kg through untouched", () => {
		expect(toUsdPerKg(5.5, "USD/kg")).toBe(5.5);
	});

	it("refuses unknown dimensions instead of guessing (honesty gate)", () => {
		expect(toUsdPerKg(5.5, "rate")).toBeNull();
		expect(toUsdPerKg(5.5, null)).toBeNull();
		expect(toUsdPerKg(5.5, undefined)).toBeNull();
	});

	it("refuses non-finite input", () => {
		expect(toUsdPerKg(Number.NaN, "USC/lb")).toBeNull();
		expect(toUsdPerKg(Number.POSITIVE_INFINITY, "USD/cwt")).toBeNull();
	});
});

describe("computeLandedCost", () => {
	const full: LandedCostParams = {
		tariffPct: 10,
		vatPct: 9,
		freightUsdPerKg: 1,
		feesUsdPerKg: 0.5,
		lossPct: 5,
	};

	it("applies duty on cost base, VAT on (cost base + duty), loss after tax", () => {
		const b = computeLandedCost(10, full, 7);
		// cost base = 10 + 1 + 0.5 = 11.5
		expect(b.costBaseUsdPerKg).toBeCloseTo(11.5, 10);
		// duty = 11.5 × 10% = 1.15 (NOT on base alone — freight+fees are dutiable)
		expect(b.dutyUsdPerKg).toBeCloseTo(1.15, 10);
		// vat = (11.5 + 1.15) × 9% = 1.1385 (China import VAT base)
		expect(b.vatUsdPerKg).toBeCloseTo(1.1385, 10);
		// landed = (11.5 + 1.15 + 1.1385) × 1.05 = 14.477925
		expect(b.landedUsdPerKg).toBeCloseTo(14.477925, 8);
		// cny = 14.477925 × 7
		expect(b.cnyPerKg).toBeCloseTo(101.345475, 6);
	});

	it("zero duty/loss parameters reduce to base + freight + fees identity", () => {
		const zero: LandedCostParams = {
			tariffPct: 0,
			vatPct: 0,
			freightUsdPerKg: 0,
			feesUsdPerKg: 0,
			lossPct: 0,
		};
		const b = computeLandedCost(7.2753, zero, 7);
		expect(b.landedUsdPerKg).toBeCloseTo(7.2753, 10);
		expect(b.dutyUsdPerKg).toBe(0);
		expect(b.vatUsdPerKg).toBe(0);
	});

	it("returns cnyPerKg null (not a guess) when FX is unavailable", () => {
		const b = computeLandedCost(10, full, null);
		expect(b.cnyPerKg).toBeNull();
		expect(b.landedUsdPerKg).toBeCloseTo(14.477925, 8);
	});

	it("loss compounds after taxes, not before (ordering pin)", () => {
		// If loss were applied pre-tax the landed figure would differ:
		// (11.5 × 1.05 + duty/vat on that) ≠ (11.5 + duty + vat) × 1.05.
		const b = computeLandedCost(10, { ...full, tariffPct: 0, vatPct: 0 }, 1);
		// (11.5) × 1.05 = 12.075
		expect(b.landedUsdPerKg).toBeCloseTo(12.075, 10);
	});
});
