/**
 * INAC DIAE precios CSV parser tests (round-159 revival).
 *
 * Fixture shapes come from the live service (2026-09-07 fetch): quote-wrapped
 * decimal-comma values ("2,948"), TWO year columns side by side
 * ("NNNN (USD/Kg)"), Uruguayan "Setiembre", junk first row ("null,,,,"),
 * footer rows ("Fuente: INAC" / pagination / server timestamp).
 */

import { describe, expect, it } from "vitest";
import { parseInacPreciosCsv } from "@/services/dataIngestion/sources/inacData";

const HEADER = ",Mes,,2026 (USD/Kg),,,,2025 (USD/Kg),,,Variación %";

describe("parseInacPreciosCsv", () => {
	it("parses both year columns, decimal commas, and Uruguayan Setiembre", () => {
		const csv = [
			"null,,,,,,,,,,",
			HEADER,
			'Enero,,,,"2,948",,,"2,277",,"29,47%"',
			'Julio,,,,"3,166",,,"2,653",,"19,34%"',
			'Setiembre,,,,,,,"2,954",,"31,35%"',
		].join("\n");
		const rows = parseInacPreciosCsv(csv);
		expect(rows).toHaveLength(5); // 2 + 2 + 1 (Setiembre carries 2025 only)
		expect(rows[0].date.toISOString()).toBe("2025-01-01T00:00:00.000Z");
		expect(rows[0].valueUsdKg).toBeCloseTo(2.277, 5);
		expect(rows[1].date.toISOString()).toBe("2025-07-01T00:00:00.000Z");
		expect(rows[1].valueUsdKg).toBeCloseTo(2.653, 5);
		// Setiembre (Uruguayan spelling) lands on September of the 2025 column.
		expect(rows[2].date.toISOString()).toBe("2025-09-01T00:00:00.000Z");
		expect(rows[2].valueUsdKg).toBeCloseTo(2.954, 5);
		expect(rows[3].date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
		expect(rows[3].valueUsdKg).toBeCloseTo(2.948, 5);
		expect(rows[4].date.toISOString()).toBe("2026-07-01T00:00:00.000Z");
		expect(rows[4].valueUsdKg).toBeCloseTo(3.166, 5);
	});

	it("skips footer/pagination rows (no month name)", () => {
		const csv = [
			HEADER,
			'Enero,,,,"2,948",,,"2,277",,"29,47%"',
			",,Fuente: INAC,,,Página 1, de 1,,6/9/26 1:35 PM,,",
		].join("\n");
		const rows = parseInacPreciosCsv(csv);
		expect(rows).toHaveLength(2); // only the Enero row's two year points
	});

	it("keeps the sibling year column when the newer cell is missing/garbage/zero (column identity, not row order)", () => {
		const csv = [
			"null,,,,,,,,,,",
			HEADER,
			'Marzo,,,,"3,092",,,"2,442",,"26,62%"', // both valid → 2 points
			'Febrero,,,,,,,"2,328",,"17,40%"', // newer cell empty → 2025 only
			'Abril,,,,"n/d",,,"2,479",,"22,84%"', // newer garbage → 2025 only
			'Mayo,,,,"0",,,"2,528",,"23,38%"', // newer zero → 2025 only
		].join("\n");
		const rows = parseInacPreciosCsv(csv);
		expect(rows).toHaveLength(5);
		const both = rows.filter((r) => r.date.getUTCMonth() === 2); // Marzo
		expect(both).toHaveLength(2);
		expect(both.map((r) => r.date.getUTCFullYear()).sort()).toEqual([2025, 2026]);
		for (const r of rows.filter((r) => r.date.getUTCMonth() !== 2)) {
			expect(r.date.getUTCFullYear()).toBe(2025);
		}
	});

	it("refuses to guess when only one value column exists in the whole report (drift guard)", () => {
		const csv = [HEADER, 'Febrero,,,,,,,"2,328",,"17,40%"', 'Marzo,,,,,,,"2,442",,"21,07%"'].join(
			"\n",
		);
		expect(parseInacPreciosCsv(csv)).toHaveLength(0);
	});

	it("returns zero rows when no 'NNNN (USD/Kg)' header exists (schema drift → refuse to write)", () => {
		expect(parseInacPreciosCsv("")).toHaveLength(0);
		expect(parseInacPreciosCsv("foo,bar\n1,2\n")).toHaveLength(0);
		expect(
			parseInacPreciosCsv(',Mes,,2026 (USD/lb),,,2025 (USD/lb)\nEnero,,"2,9",,"2,2",'),
		).toHaveLength(0);
	});
});
