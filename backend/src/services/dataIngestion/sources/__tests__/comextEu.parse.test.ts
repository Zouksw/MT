/**
 * comextEu parse contract (round-161 批1) — fixtures are the LIVE Eurostat
 * Comext DS-045409 responses for IE→CN HS0202 (captured 2026-09-07, trimmed
 * to the 2026-01..2026-07 time window). The value/qty bodies keep their
 * original sparse flat indices (36-42) plus stray low-index values that no
 * longer map to any period — pinning the decode's index-inversion contract
 * and its skip-unknown-index guard.
 */

import { describe, expect, it } from "vitest";
import {
	comextUrl,
	decodeJsonStat,
	type JsonStatDataset,
	parseComextSeries,
} from "@/services/dataIngestion/sources/comextEu";

const IE_VALUE_FIXTURE: JsonStatDataset = {
	value: {
		"10": 123587,
		"17": 645967,
		"36": 574484,
		"38": 23227,
		"39": 58810,
		"40": 156323,
		"41": 129310,
	},
	id: ["freq", "reporter", "partner", "product", "flow", "indicators", "time"],
	size: [1, 1, 1, 1, 1, 1, 7],
	dimension: {
		time: {
			category: {
				index: {
					"2026-01": 36,
					"2026-02": 37,
					"2026-03": 38,
					"2026-04": 39,
					"2026-05": 40,
					"2026-06": 41,
					"2026-07": 42,
				},
			},
		},
	},
};

const IE_QTY_FIXTURE: JsonStatDataset = {
	value: {
		"17": 775.37,
		"36": 741.89,
		"38": 148.97,
		"39": 259.82,
		"40": 274.02,
		"41": 505.0,
	},
	id: ["freq", "reporter", "partner", "product", "flow", "indicators", "time"],
	size: [1, 1, 1, 1, 1, 1, 7],
	dimension: {
		time: {
			category: {
				index: {
					"2026-01": 36,
					"2026-02": 37,
					"2026-03": 38,
					"2026-04": 39,
					"2026-05": 40,
					"2026-06": 41,
					"2026-07": 42,
				},
			},
		},
	},
};

describe("decodeJsonStat — flat index equals time index (single-value dims)", () => {
	it("maps sparse flat indices back to periods and skips indices absent from the time category", () => {
		const decoded = decodeJsonStat(IE_VALUE_FIXTURE);
		// 7 entries in value{}, but flat indices 10/17 have no period in the
		// trimmed time category — only the 5 known periods survive.
		expect(decoded.size).toBe(5);
		expect(decoded.get("2026-01")).toBe(574484);
		expect(decoded.get("2026-06")).toBe(129310);
		expect(decoded.has("2026-02")).toBe(false); // genuinely no Feb flow
	});

	it("returns empty on malformed bodies (missing time index / values / size)", () => {
		expect(decodeJsonStat({}).size).toBe(0);
		expect(decodeJsonStat({ value: { "0": 1 } }).size).toBe(0);
		expect(
			decodeJsonStat({
				value: { "0": 1 },
				size: [1, 1, 1, 1, 1, 1, 1],
				dimension: { time: { category: { index: { "2026-01": 0 } } } },
			}).size,
		).toBe(1);
	});
});

describe("parseComextSeries — EUR lane contract", () => {
	it("joins value+quantity lanes into EUR/ton unit prices (live IE 2026 values)", () => {
		const rows = parseComextSeries(
			decodeJsonStat(IE_VALUE_FIXTURE),
			decodeJsonStat(IE_QTY_FIXTURE),
			"IE",
			"0202",
		);

		expect(rows).toHaveLength(5); // 2026-02 has neither lane → absent, not zero
		const jan = rows.find((r) => (r.metadata as { period?: string }).period === "2026-01");
		expect(jan).toBeDefined();
		// 574,484 € ÷ (741.89 × 100 kg / 1000) = 7,743.519929 €/t — exact.
		expect(jan?.value).toBe(7743.519929);
		expect(jan?.type).toBe("export_eu_to_cn_0202");
		expect(jan?.region).toBe("IE→CN");
		expect(jan?.unit).toBe("EUR/ton");
		expect(jan?.date.toISOString().slice(0, 10)).toBe("2026-01-01");

		const jun = rows.find((r) => (r.metadata as { period?: string }).period === "2026-06");
		expect(jun?.value).toBe(2560.594059);

		// 口径 carrier: the read side keys EUR off metadata.currency.
		for (const row of rows) {
			expect(row.metadata.currency).toBe("EUR");
			expect(row.metadata.basis).toContain("FOB-EUR");
			expect(row.metadata.quantityKg).toBeGreaterThan(0);
		}
	});

	it("rounds to Decimal(18,6) scale so a re-scan is a true no-op", () => {
		const rows = parseComextSeries(
			decodeJsonStat(IE_VALUE_FIXTURE),
			decodeJsonStat(IE_QTY_FIXTURE),
			"IE",
			"0202",
		);
		for (const row of rows) {
			expect(row.value).toBe(Math.round(row.value * 1e6) / 1e6);
		}
	});

	it("drops months where either lane is missing or non-positive (never fabricates zero flow)", () => {
		const value = new Map([
			["2026-01", 100],
			["2026-02", 200],
			["2026-03", 300],
		]);
		const qty = new Map([
			["2026-01", 10],
			["2026-03", 0], // zero quantity → no unit price exists
		]);
		const rows = parseComextSeries(value, qty, "NL", "020230");
		expect(rows).toHaveLength(1);
		expect(rows[0].region).toBe("NL→CN");
		expect(rows[0].value).toBe(100); // 100 € ÷ (10×100/1000 = 1 t)
	});
});

describe("comextUrl — single product / single indicator / time range", () => {
	it("builds the documented contract (flow=2, partner=CN, since/until range)", () => {
		const url = comextUrl({
			reporter: "IE",
			product: "0202",
			indicator: "VALUE_IN_EUROS",
			since: "2026-04",
			until: "2026-07",
		});
		// Multi-value on product/indicators collapses (size 0) or 413s — the
		// URL must always carry exactly one of each.
		expect(url).toBe(
			"https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/ds-045409" +
				"?lang=EN&freq=M&reporter=IE&partner=CN&product=0202&flow=2" +
				"&indicators=VALUE_IN_EUROS&sinceTimePeriod=2026-04&untilTimePeriod=2026-07",
		);
	});
});
