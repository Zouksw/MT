/**
 * Tests for manual CSV import
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib", () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { parseCSV } from "../sources/manualImport";

describe("parseCSV", () => {
	it("should parse a simple CSV with headers", () => {
		const csv = `date,open,high,low,close,volume
2024-01-15,78.5,80.0,77.2,79.8,15000
2024-01-16,79.8,81.0,78.5,80.5,12000`;

		const rows = parseCSV(Buffer.from(csv));

		expect(rows).toHaveLength(2);
		expect(rows[0].date).toBe("2024-01-15");
		expect(rows[0].close).toBe(79.8);
		expect(rows[1].volume).toBe(12000);
	});

	it("should skip empty lines", () => {
		const csv = `date,close

2024-01-15,50.0

2024-01-16,51.0`;

		const rows = parseCSV(Buffer.from(csv));

		expect(rows).toHaveLength(2);
	});

	it("should use dynamic typing for numbers", () => {
		const csv = `date,close,volume
2024-01-15,78.5,15000`;

		const rows = parseCSV(Buffer.from(csv));

		expect(typeof rows[0].close).toBe("number");
		expect(typeof rows[0].volume).toBe("number");
	});

	it("should throw on critical parse errors", () => {
		// Malformed CSV with unmatched quotes
		const csv = `date,close
"2024-01-15,50.0`;

		expect(() => parseCSV(Buffer.from(csv))).toThrow();
	});

	it("should handle custom delimiter", () => {
		const csv = `date;close
2024-01-15;50.0`;

		const rows = parseCSV(Buffer.from(csv), { delimiter: ";" });

		expect(rows).toHaveLength(1);
		expect(rows[0].close).toBe(50.0);
	});

	it("should handle CSV with extra whitespace in headers", () => {
		const csv = `date , close
2024-01-15,50.0`;

		const rows = parseCSV(Buffer.from(csv));

		expect(rows).toHaveLength(1);
	});

	it("should handle empty CSV", () => {
		const csv = `date,close`;
		const rows = parseCSV(Buffer.from(csv));

		expect(rows).toHaveLength(0);
	});
});
