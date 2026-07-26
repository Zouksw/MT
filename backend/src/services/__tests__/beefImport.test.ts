import { describe, expect, it } from "vitest";
import { parseBeefCSV } from "../beefImport";

describe("parseBeefCSV", () => {
	it("parses a well-formed CSV with header row", () => {
		const csv = Buffer.from(
			"factoryCode,cutCode,price,date\nAU-847,BRISKET_NAVEL,7.42,2026-07-26\nBR-SIF2057,RIB_EYE_ROLL,12.5,2026-07-26",
		);
		const rows = parseBeefCSV(csv);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			factorycode: "AU-847",
			cutcode: "BRISKET_NAVEL",
			price: "7.42",
			date: "2026-07-26",
		});
		expect(rows[1].factorycode).toBe("BR-SIF2057");
	});

	it("normalizes headers — case-insensitive, strips whitespace", () => {
		const csv = Buffer.from(
			"Factory Code, Cut Code , Price,Date\nAU-847,BRISKET_NAVEL,7.42,2026-07-26",
		);
		const rows = parseBeefCSV(csv);
		expect(rows[0].factorycode).toBe("AU-847");
		expect(rows[0].cutcode).toBe("BRISKET_NAVEL");
	});

	it("strips a UTF-8 BOM if present", () => {
		const csv = Buffer.from(
			"\uFEFFfactoryCode,cutCode,price,date\nAU-847,BRISKET_NAVEL,7.42,2026-07-26",
		);
		const rows = parseBeefCSV(csv);
		expect(rows).toHaveLength(1);
		// BOM must not have leaked into the first header key
		expect(rows[0].factorycode).toBe("AU-847");
	});

	it("handles CRLF line endings", () => {
		const csv = Buffer.from(
			"factoryCode,cutCode,price,date\r\nAU-847,BRISKET_NAVEL,7.42,2026-07-26\r\n",
		);
		const rows = parseBeefCSV(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].price).toBe("7.42");
	});

	it("skips empty lines", () => {
		const csv = Buffer.from(
			"factoryCode,cutCode,price,date\nAU-847,BRISKET_NAVEL,7.42,2026-07-26\n\n\nBR-SIF2057,TOPSIDE,5.0,2026-07-26",
		);
		const rows = parseBeefCSV(csv);
		expect(rows).toHaveLength(2);
	});

	it("returns empty array for header-only CSV (no data rows)", () => {
		const csv = Buffer.from("factoryCode,cutCode,price,date");
		expect(parseBeefCSV(csv)).toEqual([]);
	});

	it("returns empty array for empty buffer", () => {
		expect(parseBeefCSV(Buffer.from(""))).toEqual([]);
	});

	it("supports optional columns (currency, unit, grade)", () => {
		const csv = Buffer.from(
			"factoryCode,cutCode,price,date,currency,unit,grade\nAU-847,BRISKET_NAVEL,7.42,2026-07-26,USD,USD/kg,M7",
		);
		const rows = parseBeefCSV(csv);
		expect(rows[0].currency).toBe("USD");
		expect(rows[0].unit).toBe("USD/kg");
		expect(rows[0].grade).toBe("M7");
	});

	it("supports a custom delimiter", () => {
		const csv = Buffer.from("factoryCode;cutCode;price;date\nAU-847;BRISKET_NAVEL;7.42;2026-07-26");
		const rows = parseBeefCSV(csv, ";");
		expect(rows).toHaveLength(1);
		expect(rows[0].cutcode).toBe("BRISKET_NAVEL");
	});
});
