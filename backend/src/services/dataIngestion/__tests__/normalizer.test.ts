/**
 * Tests for data ingestion normalizer
 */

import { describe, expect, it } from "vitest";
import {
	detectFieldMapping,
	type FieldMapping,
	normalizePriceEntry,
} from "../normalizer";

// ============================================================================
// detectFieldMapping
// ============================================================================

describe("detectFieldMapping", () => {
	it("should map standard OHLCV headers", () => {
		const headers = ["date", "open", "high", "low", "close", "volume"];
		const mapping = detectFieldMapping(headers);

		expect(mapping.date).toBe("date");
		expect(mapping.open).toBe("open");
		expect(mapping.high).toBe("high");
		expect(mapping.low).toBe("low");
		expect(mapping.close).toBe("close");
		expect(mapping.volume).toBe("volume");
	});

	it("should map with only date and close", () => {
		const headers = ["trade_date", "settlement"];
		const mapping = detectFieldMapping(headers);

		expect(mapping.date).toBe("trade_date");
		expect(mapping.close).toBe("settlement");
		expect(mapping.open).toBeUndefined();
		expect(mapping.volume).toBeUndefined();
	});

	it("should detect price as close column", () => {
		const headers = ["date", "price"];
		const mapping = detectFieldMapping(headers);

		expect(mapping.close).toBe("price");
	});

	it("should detect value as close column", () => {
		const headers = ["timestamp", "value"];
		const mapping = detectFieldMapping(headers);

		expect(mapping.date).toBe("timestamp");
		expect(mapping.close).toBe("value");
	});

	it("should detect variant headers with spaces and underscores", () => {
		const headers = [
			"Trade Date",
			"Open Price",
			"High Price",
			"Low Price",
			"Close Price",
			"Vol",
		];
		const mapping = detectFieldMapping(headers);

		expect(mapping.date).toBe("Trade Date");
		expect(mapping.open).toBe("Open Price");
		expect(mapping.high).toBe("High Price");
		expect(mapping.low).toBe("Low Price");
		expect(mapping.close).toBe("Close Price");
		expect(mapping.volume).toBe("Vol");
	});

	it("should put unmapped columns into metadata", () => {
		const headers = ["date", "close", "factory_code", "origin_country"];
		const mapping = detectFieldMapping(headers);

		expect(mapping.metadata).toBeDefined();
		expect(mapping.metadata?.factory_code).toBe("factory_code");
		expect(mapping.metadata?.origin_country).toBe("origin_country");
	});

	it("should throw if no date column found", () => {
		expect(() => detectFieldMapping(["open", "close"])).toThrow(
			"No date column found",
		);
	});

	it("should throw if no close column found", () => {
		expect(() => detectFieldMapping(["date", "open"])).toThrow(
			"No close/price column found",
		);
	});

	it("should detect datetime as date column", () => {
		const mapping = detectFieldMapping(["datetime", "close"]);
		expect(mapping.date).toBe("datetime");
	});

	it("should detect day as date column", () => {
		const mapping = detectFieldMapping(["day", "close"]);
		expect(mapping.date).toBe("day");
	});

	it("should detect qty as volume column", () => {
		const mapping = detectFieldMapping(["date", "close", "qty"]);
		expect(mapping.volume).toBe("qty");
	});

	it("should not include metadata when all columns are mapped", () => {
		const headers = ["date", "close"];
		const mapping = detectFieldMapping(headers);

		expect(mapping.metadata).toBeUndefined();
	});
});

// ============================================================================
// normalizePriceEntry
// ============================================================================

describe("normalizePriceEntry", () => {
	const baseMapping: FieldMapping = {
		date: "date",
		open: "open",
		high: "high",
		low: "low",
		close: "close",
		volume: "volume",
	};

	it("should normalize a complete OHLCV row", () => {
		const row = {
			date: "2024-01-15",
			open: 78.5,
			high: 80.0,
			low: 77.2,
			close: 79.8,
			volume: 15000,
		};

		const result = normalizePriceEntry(row, baseMapping);

		expect(result.close).toBe(79.8);
		expect(result.open).toBe(78.5);
		expect(result.high).toBe(80.0);
		expect(result.low).toBe(77.2);
		expect(result.volume).toBe(15000);
		expect(result.source).toBe("manual");
		expect(result.date).toBeInstanceOf(Date);
	});

	it("should parse date in YYYY/MM/DD format", () => {
		const row = { date: "2024/03/15", close: 50.0 };
		const mapping: FieldMapping = { date: "date", close: "close" };

		const result = normalizePriceEntry(row, mapping);

		expect(result.date.getFullYear()).toBe(2024);
		expect(result.date.getMonth()).toBe(2);
		expect(result.date.getDate()).toBe(15);
	});

	it("should parse date in YYYY.MM.DD format", () => {
		const row = { date: "2024.06.01", close: 50.0 };
		const mapping: FieldMapping = { date: "date", close: "close" };

		const result = normalizePriceEntry(row, mapping);

		expect(result.date.getFullYear()).toBe(2024);
		expect(result.date.getMonth()).toBe(5);
		expect(result.date.getDate()).toBe(1);
	});

	it("should parse numeric date (timestamp)", () => {
		const ts = new Date("2024-01-15").getTime();
		const row = { date: ts, close: 50.0 };
		const mapping: FieldMapping = { date: "date", close: "close" };

		const result = normalizePriceEntry(row, mapping);

		expect(result.date).toBeInstanceOf(Date);
	});

	it("should parse Date object directly", () => {
		const d = new Date("2024-01-15");
		const row = { date: d, close: 50.0 };
		const mapping: FieldMapping = { date: "date", close: "close" };

		const result = normalizePriceEntry(row, mapping);

		expect(result.date).toBe(d);
	});

	it("should clean currency symbols from numbers", () => {
		const row = { date: "2024-01-15", close: "¥52.30" };
		const mapping: FieldMapping = { date: "date", close: "close" };

		const result = normalizePriceEntry(row, mapping);

		expect(result.close).toBe(52.3);
	});

	it("should clean dollar signs from numbers", () => {
		const row = { date: "2024-01-15", close: "$5,200.50" };
		const mapping: FieldMapping = { date: "date", close: "close" };

		const result = normalizePriceEntry(row, mapping);

		expect(result.close).toBe(5200.5);
	});

	it("should return undefined for missing optional fields", () => {
		const row = { date: "2024-01-15", close: 50.0 };
		const mapping: FieldMapping = {
			date: "date",
			close: "close",
			open: "open",
		};

		const result = normalizePriceEntry(row, mapping);

		expect(result.open).toBeUndefined();
		expect(result.volume).toBeUndefined();
	});

	it("should return undefined for empty string fields", () => {
		const row = { date: "2024-01-15", close: 50.0, volume: "" };
		const mapping: FieldMapping = {
			date: "date",
			close: "close",
			volume: "volume",
		};

		const result = normalizePriceEntry(row, mapping);

		expect(result.volume).toBeUndefined();
	});

	it("should throw if close price is missing", () => {
		const row = { date: "2024-01-15" };
		const mapping: FieldMapping = { date: "date", close: "close" };

		expect(() => normalizePriceEntry(row, mapping)).toThrow(
			"Missing close price",
		);
	});

	it("should throw if close price is NaN string", () => {
		const row = { date: "2024-01-15", close: "abc" };
		const mapping: FieldMapping = { date: "date", close: "close" };

		expect(() => normalizePriceEntry(row, mapping)).toThrow(
			"Missing close price",
		);
	});

	it("should throw on unparseable date", () => {
		const row = { date: "not-a-date", close: 50.0 };
		const mapping: FieldMapping = { date: "date", close: "close" };

		expect(() => normalizePriceEntry(row, mapping)).toThrow(
			"Cannot parse date",
		);
	});

	it("should extract metadata from unmapped columns", () => {
		const mapping: FieldMapping = {
			date: "date",
			close: "close",
			metadata: {
				factory_code: "Factory Code",
				origin_country: "Origin",
			},
		};

		const row = {
			date: "2024-01-15",
			close: 50.0,
			"Factory Code": "847",
			Origin: "AUS",
		};

		const result = normalizePriceEntry(row, mapping);

		expect(result.metadata).toBeDefined();
		expect(result.metadata?.factory_code).toBe("847");
		expect(result.metadata?.origin_country).toBe("AUS");
	});

	it("should skip null/empty metadata values", () => {
		const mapping: FieldMapping = {
			date: "date",
			close: "close",
			metadata: { grade: "grade", factory: "factory" },
		};

		const row = { date: "2024-01-15", close: 50.0, grade: "M7", factory: null };

		const result = normalizePriceEntry(row, mapping);

		expect(result.metadata).toEqual({ grade: "M7" });
	});

	it("should use source field when provided", () => {
		const mapping: FieldMapping = {
			date: "date",
			close: "close",
			source: "src",
		};
		const row = { date: "2024-01-15", close: 50.0, src: "usda_ams" };

		const result = normalizePriceEntry(row, mapping);

		expect(result.source).toBe("usda_ams");
	});
});
