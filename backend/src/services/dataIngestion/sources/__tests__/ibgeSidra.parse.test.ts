/**
 * IBGE SIDRA t/1092 parser tests (round-158 批B).
 *
 * Fixture shapes come from the live API (2026-09-06 fetch): legend row first,
 * then value rows keyed by D2C variable code (151 informantes / 284 head /
 * 285 carcass kg), quarter codes as YYYYQQ ("202601" = 1º trimestre 2026).
 * Schema drift must yield zero rows so the fetch path refuses to write.
 */

import { describe, expect, it } from "vitest";
import { parseQuarterCode, parseSidraSlaughter } from "@/services/dataIngestion/sources/ibgeSidra";

const LEGEND = {
	NC: "Nível Territorial (Código)",
	D2C: "Variável (Código)",
	D2N: "Variável",
	D3C: "Trimestre (Código)",
	D3N: "Trimestre",
	V: "Valor",
	MN: "Unidade de Medida",
};

function row(variableCode: string, quarterCode: string, value: string, quarterLabel: string) {
	return {
		...LEGEND,
		D2C: variableCode,
		D2N:
			variableCode === "284"
				? "Animais abatidos"
				: variableCode === "285"
					? "Peso total das carcaças"
					: "Número de informantes",
		D3C: quarterCode,
		D3N: quarterLabel,
		V: value,
		MN: variableCode === "285" ? "Quilogramas" : "Cabeças",
	};
}

describe("parseQuarterCode", () => {
	it("maps YYYYQQ codes to quarter starts", () => {
		expect(parseQuarterCode("202601").toISOString()).toBe("2026-01-01T00:00:00.000Z");
		expect(parseQuarterCode("202602").toISOString()).toBe("2026-04-01T00:00:00.000Z");
		expect(parseQuarterCode("202604").toISOString()).toBe("2026-10-01T00:00:00.000Z");
	});

	it("rejects malformed codes (SIDRA also uses YYYYMM in monthly tables — must not alias)", () => {
		expect(parseQuarterCode("202613")).toBeNull(); // quarter 13
		expect(parseQuarterCode("20261")).toBeNull(); // short
		expect(parseQuarterCode("202605")).toBeNull(); // quarter 05
		expect(parseQuarterCode("")).toBeNull();
	});
});

describe("parseSidraSlaughter", () => {
	it("keeps head + carcass rows, drops informantes, sorts ascending by date", () => {
		const rows = parseSidraSlaughter([
			LEGEND,
			row("151", "202601", "1118", "1º trimestre 2026"),
			row("284", "202601", "10289201", "1º trimestre 2026"),
			row("284", "202504", "9876543", "4º trimestre 2025"),
			row("285", "202601", "2600000000", "1º trimestre 2026"),
		]);
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({
			variable: "head",
			value: 9876543,
			quarter: "4º trimestre 2025",
		});
		expect(rows[0].date.toISOString()).toBe("2025-10-01T00:00:00.000Z");
		expect(rows[2]).toMatchObject({ variable: "carcassKg", value: 2600000000 });
	});

	it("returns zero rows on non-array payload or legend-only response", () => {
		expect(parseSidraSlaughter(null)).toHaveLength(0);
		expect(parseSidraSlaughter({})).toHaveLength(0);
		expect(parseSidraSlaughter([LEGEND])).toHaveLength(0);
	});

	it("drops rows with missing/unparseable value or malformed quarter code", () => {
		const rows = parseSidraSlaughter([
			LEGEND,
			row("284", "202699", "100", "bad quarter"),
			row("284", "202601", "...", "1º trimestre 2026"), // SIDRA null marker
			row("284", "202601", "-5", "1º trimestre 2026"), // non-positive
			row("284", "202601", "0", "1º trimestre 2026"),
		]);
		expect(rows).toHaveLength(0);
	});
});
