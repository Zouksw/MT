/**
 * computeBeefTrend — pure-function unit tests (round-57).
 *
 * Pins the origin-split trend math: imported (non-CN) and domestic (CN)
 * average % change between the latest day and the previous distinct day.
 * This backs the dashboard hero's ↓1.2% / ↑0.5% trend badges
 * (PRODUCT-SPEC §5.1) that were previously null (design gap).
 */

import { describe, expect, it } from "vitest";
import { computeBeefTrend } from "@/services/beefTrends";

const LATEST = new Date("2026-07-31T00:00:00Z");
const PREV = new Date("2026-07-24T00:00:00Z");

describe("computeBeefTrend", () => {
	it("computes positive/negative deltas for imported and domestic independently", () => {
		// Latest: imported avg = (50+55)/2 = 52.5, domestic avg = 40
		// Prev:   imported avg = (48+50)/2 = 49.0, domestic avg = 42
		// importedTrend = (52.5-49)/49 * 100 = +7.1%
		// domesticTrend = (40-42)/42 * 100   = -4.8%
		const latest = [
			{ price: 50, country: "BR" },
			{ price: 55, country: "AU" },
			{ price: 40, country: "CN" },
		];
		const prev = [
			{ price: 48, country: "BR" },
			{ price: 50, country: "AU" },
			{ price: 42, country: "CN" },
		];
		const t = computeBeefTrend(latest, prev, LATEST, PREV);
		expect(t.importedTrendPct).toBe(7.1);
		expect(t.domesticTrendPct).toBe(-4.8);
		expect(t.latestDate).toBe(LATEST.toISOString());
		expect(t.previousDate).toBe(PREV.toISOString());
	});

	it("returns null trend when either period has no rows for that origin", () => {
		// Latest has imported but no domestic; prev has domestic but no imported.
		const latest = [{ price: 50, country: "BR" }];
		const prev = [{ price: 42, country: "CN" }];
		const t = computeBeefTrend(latest, prev, LATEST, PREV);
		// imported: curr=50, prev=null → null. domestic: curr=null, prev=42 → null.
		expect(t.importedTrendPct).toBeNull();
		expect(t.domesticTrendPct).toBeNull();
	});

	it("returns null/null when both periods are empty", () => {
		const t = computeBeefTrend([], [], null, null);
		expect(t.importedTrendPct).toBeNull();
		expect(t.domesticTrendPct).toBeNull();
		expect(t.latestDate).toBeNull();
		expect(t.previousDate).toBeNull();
	});

	it("treats rows with no country as neither imported nor domestic", () => {
		// A row missing country must not pollute either bucket.
		const latest = [
			{ price: 50, country: "" },
			{ price: 55, country: undefined },
		];
		const prev = [{ price: 50, country: "BR" }];
		const t = computeBeefTrend(latest, prev, LATEST, PREV);
		expect(t.importedTrendPct).toBeNull(); // latest imported bucket empty
		expect(t.domesticTrendPct).toBeNull();
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
});
