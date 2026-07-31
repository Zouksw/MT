/**
 * CME Futures — unit-conversion contract (round-56).
 *
 * Stooq returns CME futures in their native exchange quote units. Grains,
 * livestock, and softs are quoted in CENTS (per bushel / cwt / lb) but the
 * commodity's declared `unit` is USD. The scraper must divide those by 100
 * (priceFactor 0.01) before writing, or it stores 473 (cents) next to USDA's
 * 4.5 (USD/bu) — a 100× unit conflict that corrupts predictions
 * (docs/KNOWN-ISSUES.md R2).
 *
 * These tests pin the priceFactor per contract so a regression that drops or
 * mis-assigns the factor fails loudly. Energy/metals/soybean-meal stay at
 * factor 1 (already USD).
 */

import { describe, expect, it } from "vitest";
import { FUTURES } from "@/services/dataIngestion/sources/cmeFutures";

describe("CME FUTURES priceFactor contract", () => {
	// Cents-quoted contracts: Stooq returns cents, declared unit is USD → /100.
	const CENTS_QUOTED = [
		["LE", "live_cattle_cme", "USD/cwt"],
		["GF", "feeder_cattle_cme", "USD/cwt"],
		["HE", "lean_hogs_cme", "USD/cwt"],
		["ZC", "corn_cme", "USD/bu"],
		["ZS", "soybeans_cme", "USD/bu"],
		["ZW", "wheat_cme", "USD/bu"],
		["ZL", "soybean_oil_cme", "USD/lb"],
		["KC", "coffee_cme", "USD/lb"],
		["SB", "sugar11_cme", "USD/lb"],
		["CT", "cotton2_cme", "USD/lb"],
	] as const;

	// USD-quoted contracts: Stooq already returns USD → no conversion.
	const USD_QUOTED = [
		["ZM", "soybean_meal_cme", "USD/ton"],
		["CL", "crude_oil_cme", "USD/bbl"],
		["NG", "natural_gas_cme", "USD/MMBtu"],
		["GC", "gold_cme", "USD/troy oz"],
	] as const;

	it.each(CENTS_QUOTED)("%s (%s) is cents-quoted → priceFactor 0.01", (_key, slug, unit) => {
		const cfg = FUTURES[slug] ?? Object.values(FUTURES).find((c) => c.slug === slug);
		expect(cfg, `FUTURES entry for ${slug} must exist`).toBeDefined();
		expect(cfg.unit).toBe(unit);
		expect(cfg.priceFactor).toBe(0.01);
	});

	it.each(USD_QUOTED)("%s (%s) is USD-quoted → factor 1 (or absent)", (_key, slug, unit) => {
		const cfg = Object.values(FUTURES).find((c) => c.slug === slug);
		expect(cfg, `FUTURES entry for ${slug} must exist`).toBeDefined();
		expect(cfg.unit).toBe(unit);
		// USD-quoted contracts must NOT have a 0.01 factor (would corrupt them).
		expect(cfg.priceFactor ?? 1).toBe(1);
	});

	it("the conversion makes corn_cme's stored value match USDA's USD/bu magnitude", () => {
		// Stooq corn ≈ 473 cents/bu. With factor 0.01 → 4.73 USD/bu,
		// which lands in USDA's 4.1–4.8 USD/bu range (no longer 100× off).
		const corn = Object.values(FUTURES).find((c) => c.slug === "corn_cme");
		const stooqCents = 473;
		const storedUsd = stooqCents * (corn.priceFactor ?? 1);
		expect(storedUsd).toBeCloseTo(4.73, 1);
		expect(storedUsd).toBeGreaterThan(4.0);
		expect(storedUsd).toBeLessThan(5.0);
	});
});
