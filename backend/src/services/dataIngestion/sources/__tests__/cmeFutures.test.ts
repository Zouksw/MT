/**
 * CME Futures — unit-conversion + symbol contract (round-56; updated
 * round-100 for the Yahoo Finance source swap).
 *
 * The upstream (Stooq until 2026-05, Yahoo since) returns CME futures in
 * their native exchange quote units. Grains and softs are quoted in CENTS
 * (per bushel / lb) but the commodity's declared `unit` is USD. The scraper
 * must divide those by 100 (priceFactor 0.01) before writing, or it stores
 * 473 (cents) next to USDA's 4.5 (USD/bu) — a 100× unit conflict that
 * corrupts predictions (docs/KNOWN-ISSUES.md R2).
 *
 * round-100 corrections (same native units on Yahoo):
 * - livestock (LE/GF/HE) lost their wrong 0.01: they quote cents/lb while
 *   the declared unit is USD/cwt — numerically equal, so factor must be 1.
 * - tickers are now Yahoo symbols ("LE=F"), not Stooq ones ("le.f").
 *
 * These tests pin the priceFactor and ticker per contract so a regression
 * fails loudly. Consolidated round-100: supersedes the duplicate suite that
 * briefly lived in dataIngestion/__tests__/cmeFutures.test.ts (D3).
 */

import { describe, expect, it } from "vitest";
import { FUTURES } from "@/services/dataIngestion/sources/cmeFutures";

describe("CME FUTURES priceFactor contract", () => {
	// Cents-quoted contracts: upstream returns cents, declared unit is the
	// same measure in USD → /100.
	const CENTS_QUOTED = [
		["ZC", "corn_cme", "USD/bu"],
		["ZS", "soybeans_cme", "USD/bu"],
		["ZW", "wheat_cme", "USD/bu"],
		["ZL", "soybean_oil_cme", "USD/lb"],
		["KC", "coffee_cme", "USD/lb"],
		["SB", "sugar11_cme", "USD/lb"],
		["CT", "cotton2_cme", "USD/lb"],
	] as const;

	// Livestock: quoted cents/lb, declared USD/cwt — numerically equal
	// (220.3 cents/lb = $220.3/cwt, 100 lb/cwt) → factor 1. round-56 wrongly
	// set 0.01 here (would store $2.2/cwt); it shipped while the source was
	// dead so no bad row was ever written. Keep it that way.
	const LIVESTOCK_CWT = [
		["LE", "live_cattle_cme", "USD/cwt"],
		["GF", "feeder_cattle_cme", "USD/cwt"],
		["HE", "lean_hogs_cme", "USD/cwt"],
	] as const;

	// USD-quoted contracts: upstream already returns USD → no conversion.
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

	it.each(LIVESTOCK_CWT)("%s (%s) cents/lb ≡ USD/cwt → NO priceFactor", (_key, slug, unit) => {
		const cfg = Object.values(FUTURES).find((c) => c.slug === slug);
		expect(cfg, `FUTURES entry for ${slug} must exist`).toBeDefined();
		expect(cfg.unit).toBe(unit);
		// A 0.01 here would store $2.2/cwt instead of $220 — 100× off.
		expect(cfg.priceFactor ?? 1).toBe(1);
	});

	it.each(USD_QUOTED)("%s (%s) is USD-quoted → factor 1 (or absent)", (_key, slug, unit) => {
		const cfg = Object.values(FUTURES).find((c) => c.slug === slug);
		expect(cfg, `FUTURES entry for ${slug} must exist`).toBeDefined();
		expect(cfg.unit).toBe(unit);
		// USD-quoted contracts must NOT have a 0.01 factor (would corrupt them).
		expect(cfg.priceFactor ?? 1).toBe(1);
	});

	it("the conversion makes corn_cme's stored value match USDA's USD/bu magnitude", () => {
		// Upstream corn ≈ 473 cents/bu. With factor 0.01 → 4.73 USD/bu,
		// which lands in USDA's 4.1–4.8 USD/bu range (no longer 100× off).
		const corn = Object.values(FUTURES).find((c) => c.slug === "corn_cme");
		const rawCents = 473;
		const storedUsd = rawCents * (corn.priceFactor ?? 1);
		expect(storedUsd).toBeCloseTo(4.73, 1);
		expect(storedUsd).toBeGreaterThan(4.0);
		expect(storedUsd).toBeLessThan(5.0);
	});

	it("every contract declares slug/unit/category and a Yahoo ticker", () => {
		for (const [symbol, cfg] of Object.entries(FUTURES)) {
			expect(cfg.slug, `${symbol} needs slug`).toBeTruthy();
			expect(cfg.unit, `${symbol} needs unit`).toBeTruthy();
			expect(cfg.category, `${symbol} needs category`).toBeTruthy();
			expect(cfg.ticker, `${symbol} needs Yahoo symbol`).toMatch(/^[A-Z]{1,2}=F$/);
		}
	});

	it("slugs are unique (no contract collision → no data overwriting)", () => {
		const slugs = Object.values(FUTURES).map((c) => c.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});
