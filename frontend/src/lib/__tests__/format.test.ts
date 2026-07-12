import { describe, expect, it } from "@jest/globals";
import {
	formatCompact,
	formatCount,
	formatDecimal,
	formatPercent,
	formatPercentValue,
	formatPrice,
	formatPriceRange,
	formatSignedPercent,
	toNum,
} from "@/lib/format";

describe("formatPrice", () => {
	it("formats a beef price with /kg unit by default", () => {
		expect(formatPrice(4.5219)).toBe("$4.52/kg");
	});

	it("omits the unit when includeUnit=false", () => {
		expect(formatPrice(4.52, false)).toBe("$4.52");
	});

	it("rounds to 2 decimals", () => {
		expect(formatPrice(4.5, false)).toBe("$4.50");
		expect(formatPrice(4, false)).toBe("$4.00");
	});

	it("returns placeholder for null/undefined/NaN", () => {
		expect(formatPrice(null)).toBe("--");
		expect(formatPrice(undefined)).toBe("--");
		expect(formatPrice(Number.NaN)).toBe("--");
	});
});

describe("formatPriceRange", () => {
	it("formats a range with /kg once", () => {
		expect(formatPriceRange(4.2, 4.8)).toBe("$4.20 — $4.80/kg");
	});

	it("omits unit when includeUnit=false", () => {
		expect(formatPriceRange(4.2, 4.8, false)).toBe("$4.20 — $4.80");
	});

	it("returns placeholder when both bounds are missing", () => {
		expect(formatPriceRange(null, undefined)).toBe("--");
	});
});

describe("formatPercent (fractional input)", () => {
	it("formats 0–1 fractions as whole percent", () => {
		expect(formatPercent(0.783)).toBe("78%");
	});

	it("respects fractionDigits", () => {
		expect(formatPercent(0.783, 1)).toBe("78.3%");
	});

	it("returns placeholder for missing values", () => {
		expect(formatPercent(null)).toBe("--");
		expect(formatPercent(undefined)).toBe("--");
	});
});

describe("formatPercentValue (already-scaled input)", () => {
	it("formats a percent-scale number", () => {
		expect(formatPercentValue(5.21, 1)).toBe("5.2%");
	});

	it("uses 1 fraction digit by default", () => {
		expect(formatPercentValue(2.3)).toBe("2.3%");
	});

	it("returns placeholder for missing values", () => {
		expect(formatPercentValue(null)).toBe("--");
	});
});

describe("formatSignedPercent", () => {
	it("adds + for positive values", () => {
		expect(formatSignedPercent(2.3, 1)).toBe("+2.3%");
	});

	it("does not add + for zero or negative", () => {
		expect(formatSignedPercent(0, 1)).toBe("0.0%");
		expect(formatSignedPercent(-1.1, 1)).toBe("-1.1%");
	});

	it("returns placeholder for missing values", () => {
		expect(formatSignedPercent(null)).toBe("--");
	});
});

describe("formatCompact", () => {
	it("formats thousands compactly", () => {
		expect(formatCompact(12345)).toBe("12.3K");
	});

	it("formats millions compactly", () => {
		expect(formatCompact(1_200_000)).toBe("1.2M");
	});

	it("returns placeholder for missing values", () => {
		expect(formatCompact(null)).toBe("--");
	});
});

describe("formatCount", () => {
	it("adds thousands separators below the compact threshold", () => {
		expect(formatCount(1234)).toBe("1,234");
	});

	it("switches to compact above the threshold", () => {
		expect(formatCount(150_000)).toBe("150K");
	});

	it("returns placeholder for missing values", () => {
		expect(formatCount(undefined)).toBe("--");
	});
});

describe("formatDecimal", () => {
	it("formats with the requested precision", () => {
		expect(formatDecimal(4.5219, 2)).toBe("4.52");
		expect(formatDecimal(0.00042, 4)).toBe("0.0004");
	});

	it("defaults to 2 fraction digits", () => {
		expect(formatDecimal(4.5)).toBe("4.50");
	});

	it("returns placeholder for missing values", () => {
		expect(formatDecimal(null)).toBe("--");
	});
});

describe("toNum", () => {
	it("passes numbers through", () => {
		expect(toNum(4.52)).toBe(4.52);
	});

	it("parses strings", () => {
		expect(toNum("4.52")).toBe(4.52);
	});

	it("calls toNumber() on Decimal-like objects", () => {
		expect(toNum({ toNumber: () => 4.52 })).toBe(4.52);
	});

	it("returns NaN for null/undefined", () => {
		expect(toNum(null)).toBe(Number.NaN);
		expect(toNum(undefined)).toBe(Number.NaN);
	});
});
