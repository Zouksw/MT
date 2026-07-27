/**
 * Authoritative Source Resolution — regression guard for the multi-source
 * unit-conflict bug (docs/KNOWN-ISSUES.md R2).
 *
 * brl_usd, corn_cme, natural_gas_cme are each written by two scrapers with
 * conflicting units/scale/direction. Before this fix, `getCommodityPriceValues`
 * (training data) and `verifyDuePredictions` (MAPE actuals) read by commodityId
 * alone — silently mixing sources → predictions trained on a Frankenstein
 * series and MAPE ~96% for brl_usd.
 *
 * These tests pin the contract: a known-conflict slug resolves to exactly one
 * authoritative source, and the data fetcher filters by it.
 */

import { describe, expect, it } from "vitest";
import {
	getAuthoritativeSource,
	hasSourceConflict,
} from "@/services/inference/authoritativeSources";

describe("authoritative source resolution", () => {
	describe("getAuthoritativeSource", () => {
		it("resolves brl_usd → fred (DEXBZUS, correct direction)", () => {
			// exchange_rate_api writes 1/BRL ≈ 0.20 (inverted); fred DEXBZUS ≈ 5.0.
			// fred must win or training/MAPE mix 0.20 with 5.0 (32× off).
			expect(getAuthoritativeSource("brl_usd")).toBe("fred");
		});

		it("resolves corn_cme → cme (futures, USD-cents/bu)", () => {
			// usda_ams writes USD/bu ≈ 4.5; cme futures ≈ 473 cents. 100× off.
			expect(getAuthoritativeSource("corn_cme")).toBe("cme");
		});

		it("resolves natural_gas_cme → fred (DHHNGSP, 7400+ daily points)", () => {
			expect(getAuthoritativeSource("natural_gas_cme")).toBe("fred");
		});

		it("returns null for single-source commodities (no preference → read all)", () => {
			// The vast majority of commodities have one source. Null means
			// the reader must NOT filter (legacy behaviour, correct here).
			expect(getAuthoritativeSource("beef_carcass_us")).toBeNull();
			expect(getAuthoritativeSource("usd_cny")).toBeNull();
			expect(getAuthoritativeSource("crude_oil_wti")).toBeNull();
		});

		it("returns null for unknown / empty input", () => {
			expect(getAuthoritativeSource(null)).toBeNull();
			expect(getAuthoritativeSource(undefined)).toBeNull();
			expect(getAuthoritativeSource("")).toBeNull();
			expect(getAuthoritativeSource("nonexistent_slug_xyz")).toBeNull();
		});
	});

	describe("hasSourceConflict", () => {
		it("flags the three known-conflict slugs", () => {
			expect(hasSourceConflict("brl_usd")).toBe(true);
			expect(hasSourceConflict("corn_cme")).toBe(true);
			expect(hasSourceConflict("natural_gas_cme")).toBe(true);
		});

		it("does not flag clean single-source slugs", () => {
			expect(hasSourceConflict("beef_carcass_us")).toBe(false);
			expect(hasSourceConflict("usd_cny")).toBe(false);
		});
	});
});
