/**
 * Argentina SSPM 75.3 parser tests (V8 批2, round-151).
 *
 * Fixture shapes come from the live CSV (2026-08-31 fetch): header row with
 * the full ICA rubro column set, dates as YYYY-MM-01, carnes values in
 * millions USD. Schema drift (missing ica_carnes column) must return zero
 * rows so the fetch path refuses to write anything.
 */

import { describe, expect, it } from "vitest";
import { CARNES_FIELD, parseCarnesCsv } from "@/services/dataIngestion/sources/argentinaExports";

/** Minimal slice of the real header — carnes sits between total MOA and fish. */
const HEADER = `indice_tiempo,ica_exportaciones_total_general,ica_total_moa,${CARNES_FIELD},ica_pescados_mariscos_elaborados`;

describe("parseCarnesCsv", () => {
	it("parses dates and the carnes column from the ICA layout", () => {
		const rows = parseCarnesCsv(
			`${HEADER}
2026-05-01,9577.82038154,2997.16455438,470.5,100.1
2026-06-01,9054.98573695,3344.37322903,491.2,100.2`,
		);
		expect(rows).toHaveLength(2);
		expect(rows[0].date.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(rows[0].valueUsdM).toBeCloseTo(470.5, 5);
		expect(rows[1].valueUsdM).toBeCloseTo(491.2, 5);
	});

	it("returns zero rows when the carnes column is missing (schema drift → warning, never wrong data)", () => {
		const rows = parseCarnesCsv(
			"indice_tiempo,ica_exportaciones_total_general,ica_total_moa\n2026-06-01,1.0,2.0",
		);
		expect(rows).toHaveLength(0);
	});

	it("returns zero rows when indice_tiempo is missing or the CSV is empty", () => {
		expect(parseCarnesCsv("")).toHaveLength(0);
		expect(parseCarnesCsv("foo,bar\n1,2\n")).toHaveLength(0);
	});

	it("drops malformed rows: bad date, non-numeric value, short line", () => {
		const rows = parseCarnesCsv(
			`${HEADER}
not-a-date,1,2,3,4
2026-06-01,1,2,NaN,4
2026-07-01,1`,
		);
		expect(rows).toHaveLength(0);
	});

	it("parses the full-history shape (1992-01 onward) without row limits", () => {
		const body = Array.from({ length: 413 }, (_, i) => {
			const year = 1992 + Math.floor(i / 12);
			const month = (i % 12) + 1;
			return `${year}-${String(month).padStart(2, "0")}-01,${100 + i},${50 + i},${64.0 + i},${10 + i}`;
		}).join("\n");
		const rows = parseCarnesCsv(`${HEADER}\n${body}`);
		expect(rows).toHaveLength(413);
		expect(rows[0].date.getUTCFullYear()).toBe(1992);
	});
});
