/**
 * computeBeefTrend — pure-function unit tests (round-57; domestic-CN split
 * removed with the domestic dimension, round-155).
 *
 * Pins the imported-average trend math: average % change of country-tagged
 * rows between the latest day and the previous distinct day. This backs the
 * dashboard hero trend badge (PRODUCT-SPEC §5.1).
 */

import { describe, expect, it } from "vitest";
import { computeBeefTrend } from "@/services/beefQueries";

const LATEST = new Date("2026-07-31T00:00:00Z");
const PREV = new Date("2026-07-24T00:00:00Z");

describe("computeBeefTrend", () => {
	it("computes the imported-average delta between periods", () => {
		// Latest: imported avg = (50+55)/2 = 52.5
		// Prev:   imported avg = (48+50)/2 = 49.0
		// importedTrend = (52.5-49)/49 * 100 = +7.1%
		const latest = [
			{ price: 50, country: "BR" },
			{ price: 55, country: "AU" },
		];
		const prev = [
			{ price: 48, country: "BR" },
			{ price: 50, country: "AU" },
		];
		const t = computeBeefTrend(latest, prev, LATEST, PREV);
		expect(t.importedTrendPct).toBe(7.1);
		expect(t.latestDate).toBe(LATEST.toISOString());
		expect(t.previousDate).toBe(PREV.toISOString());
	});

	it("returns null trend when either period has no country-tagged rows", () => {
		// Latest has a country-tagged row; prev doesn't → can't compute ratio.
		const latest = [{ price: 50, country: "BR" }];
		const prev = [{ price: 42, country: "" }];
		const t = computeBeefTrend(latest, prev, LATEST, PREV);
		expect(t.importedTrendPct).toBeNull();
	});

	it("returns null when both periods are empty", () => {
		const t = computeBeefTrend([], [], null, null);
		expect(t.importedTrendPct).toBeNull();
		expect(t.latestDate).toBeNull();
		expect(t.previousDate).toBeNull();
	});

	it("treats rows with no country as excluded from the average", () => {
		// A row missing country must not pollute the bucket.
		const latest = [
			{ price: 50, country: "" },
			{ price: 55, country: undefined },
		];
		const prev = [{ price: 50, country: "BR" }];
		const t = computeBeefTrend(latest, prev, LATEST, PREV);
		expect(t.importedTrendPct).toBeNull(); // latest bucket empty
	});

	it("ignores non-finite / non-positive prices (corrupt rows don't skew the avg)", () => {
		const latest = [
			{ price: 50, country: "BR" },
			{ price: NaN, country: "AU" },
			{ price: -5, country: "AU" },
			{ price: 0, country: "AU" },
		];
		const prev = [{ price: 50, country: "BR" }];
		const t = computeBeefTrend(latest, prev, LATEST, PREV);
		// Only the valid BR=50 counts in latest → avg 50 vs prev 50 → 0%.
		expect(t.importedTrendPct).toBe(0);
	});

	it("rounds to 1 decimal place", () => {
		// curr=100, prev=99 → 1.0101...% → 1.0
		const t = computeBeefTrend(
			[{ price: 100, country: "BR" }],
			[{ price: 99, country: "BR" }],
			LATEST,
			PREV,
		);
		expect(t.importedTrendPct).toBe(1.0);
	});

	it("returns null when previous avg is 0 (avoid divide-by-zero)", () => {
		const t = computeBeefTrend(
			[{ price: 50, country: "BR" }],
			[{ price: 0, country: "BR" }],
			LATEST,
			PREV,
		);
		expect(t.importedTrendPct).toBeNull();
	});

	it("never computes a cross-currency ratio (round-165: CNY spot ∥ USD FOB)", () => {
		// Live CNY spot day vs a previous day that only has USD snapshot rows:
		// ¥30.3 vs $11.4 is a pure FX artifact — the honest answer is null.
		const t = computeBeefTrend(
			[
				{ price: 19, country: "CN", currency: "CNY" },
				{ price: 52, country: "CN", currency: "CNY" },
			],
			[
				{ price: 5.1, country: "AU", currency: "USD" },
				{ price: 6.3, country: "BR", currency: "USD" },
			],
			LATEST,
			PREV,
		);
		expect(t.importedTrendPct).toBeNull();
	});

	it("compares same-currency rows when both days have them", () => {
		const t = computeBeefTrend(
			[{ price: 20, country: "CN", currency: "CNY" }],
			[
				{ price: 5.1, country: "AU", currency: "USD" },
				{ price: 25, country: "CN", currency: "CNY" },
			],
			LATEST,
			PREV,
		);
		// 20 vs 25 → -20.0%, the USD row excluded from the previous side.
		expect(t.importedTrendPct).toBe(-20.0);
	});

	it("treats missing currency as the historical USD default", () => {
		const t = computeBeefTrend(
			[{ price: 100, country: "BR" }],
			[{ price: 100, country: "AU", currency: "USD" }],
			LATEST,
			PREV,
		);
		expect(t.importedTrendPct).toBe(0.0);
	});
});
