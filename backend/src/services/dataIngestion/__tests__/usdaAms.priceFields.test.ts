/**
 * usdaAms price-field resolution (round-104 / audit C5).
 *
 * The original config mapped beef_cutout (LM_XB403) to `total_loads`
 * (cart-loads traded — a quantity in the tens/hundreds) and
 * boxed_beef_choice (LM_XB459) to `total_value` (aggregate dollars —
 * millions). Those would have entered CommodityPrice as USD/cwt prices the
 * moment a USDA_MARS_API_KEY is configured. These tests pin the candidate-
 * chain resolution: price fields only, quantities never picked, honest
 * null when no price field is present.
 */

import { describe, expect, it } from "vitest";
import { pickAMSPrice } from "@/services/dataIngestion/sources/usdaAms";

describe("pickAMSPrice — quantity fields are never prices", () => {
	it("picks cutout_value for the cutout report even when total_loads is present", () => {
		const row = {
			report_date: "2026-08-14",
			cutout_value: 312.45,
			total_loads: 238,
			total_value: 74_213_000,
		};
		expect(pickAMSPrice(row, ["cutout_value", "weight_avg_price"])).toBe(312.45);
	});

	it("prefers the canonical MARS field name weight_avg_price", () => {
		const row = {
			report_date: "2026-08-14",
			weight_avg_price: 189.2,
			weighted_avg: 0,
			avg_price: 0,
		};
		expect(pickAMSPrice(row, ["weight_avg_price", "weighted_avg", "avg_price"])).toBe(189.2);
	});

	it("falls back through the candidate chain to the first positive finite value", () => {
		const row = {
			report_date: "2026-08-14",
			weight_avg_price: null,
			weighted_avg: 0,
			avg_price: 246.8,
		};
		expect(pickAMSPrice(row, ["weight_avg_price", "weighted_avg", "avg_price"])).toBe(246.8);
	});

	it("returns null when only quantity fields are present (honest absence)", () => {
		const row = {
			report_date: "2026-08-14",
			total_loads: 238,
			total_value: 74_213_000,
			grade_volume: 12,
		};
		expect(pickAMSPrice(row, ["cutout_value", "weight_avg_price"])).toBeNull();
	});

	it("rejects non-numeric and non-finite values", () => {
		const row = { report_date: "2026-08-14", cutout_value: "N/A", weight_avg_price: Number.NaN };
		expect(pickAMSPrice(row, ["cutout_value", "weight_avg_price"])).toBeNull();
	});
});
