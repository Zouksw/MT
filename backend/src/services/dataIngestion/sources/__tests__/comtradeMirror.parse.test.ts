/**
 * Comtrade mirror parser + query-set contract (V8 批0, round-151).
 *
 * Fixtures are the live 2026-08-31 API responses (research doc §4.1): BR
 * 2026-06 HS0202 rows including the transport-mode split (motCode 2100/9900
 * duplicate the motCode 0 total — naive summing doubles the quantity), and
 * the China 2024 annual calibration row (CIF basis, reporter 156). The
 * query-set test pins the reporter/HS constants so the lane composition
 * can't drift silently.
 */

import { describe, expect, it } from "vitest";
import {
	ANNUAL_FALLBACK_REPORTERS,
	type ComtradeRow,
	comtradeUrl,
	HS_CODES,
	MONTHLY_REPORTERS,
	parseTradeRows,
} from "@/services/dataIngestion/sources/comtradeMirror";

/** Live mot-split for BR 2026-06 HS0202 (netWgt kg / fobvalue USD). */
const BR_JUNE_MOT_SPLIT: ComtradeRow[] = [
	{
		period: "202606",
		reporterCode: 76,
		flowCode: "X",
		partnerCode: 156,
		cmdCode: "0202",
		motCode: 2100, // sea — duplicates the total
		netWgt: 158364428,
		fobvalue: 1069148253,
		cifvalue: null,
		classificationCode: "H6",
	},
	{
		period: "202606",
		reporterCode: 76,
		flowCode: "X",
		partnerCode: 156,
		cmdCode: "0202",
		motCode: 0, // ALL modes — the only row that counts
		netWgt: 158364760,
		fobvalue: 1069158523,
		cifvalue: null,
		classificationCode: "H6",
	},
	{
		period: "202606",
		reporterCode: 76,
		flowCode: "X",
		partnerCode: 156,
		cmdCode: "0202",
		motCode: 9900, // other — duplicates the total
		netWgt: 5,
		fobvalue: 45000,
		cifvalue: null,
		classificationCode: "H6",
	},
];

describe("parseTradeRows — motCode trap (research §4.1)", () => {
	it("keeps only motCode==0 rows — transport-mode splits duplicate the total (~2× if summed)", () => {
		const out = parseTradeRows(BR_JUNE_MOT_SPLIT);
		expect(out).toHaveLength(1);
	});

	it("computes the unit price from the motCode 0 row: BR 2026-06 0202 ≈ $6,751/t (live-verified)", () => {
		const [row] = parseTradeRows(BR_JUNE_MOT_SPLIT);
		expect(row.value).toBeCloseTo(6751.24, 1);
		expect(row.unit).toBe("USD/ton");
		// Value must arrive pre-rounded to the column's Decimal(18,6) scale —
		// a raw float would defeat upsertFactor's sameFactor no-op and report
		// phantom updates on every daily re-scan (live-found round-151).
		expect(row.value).toBe(Math.round(row.value * 1e6) / 1e6);
	});

	it("emits mirror-lane type/region: export_to_cn_0202 / BR→CN with FOB basis metadata", () => {
		const [row] = parseTradeRows(BR_JUNE_MOT_SPLIT);
		expect(row.type).toBe("export_to_cn_0202");
		expect(row.region).toBe("BR→CN");
		expect(row.metadata.basis).toBe("FOB (partner-reported export)");
		expect(row.metadata.quantityKg).toBe(158364760);
		expect(row.metadata.valueUsd).toBe(1069158523);
		expect(row.metadata.period).toBe("202606");
	});
});

describe("parseTradeRows — lanes, periods, malformed rows", () => {
	it("monthly period 202606 → date on the 1st (UTC)", () => {
		const [row] = parseTradeRows(BR_JUNE_MOT_SPLIT);
		expect(row.date.toISOString()).toBe("2026-06-01T00:00:00.000Z");
	});

	it("annual period 2024 → Jan 1 (annual lanes share the monthly date shape)", () => {
		const out = parseTradeRows([
			{
				period: "2024",
				reporterCode: 32,
				flowCode: "X",
				partnerCode: 156,
				cmdCode: "0202",
				motCode: 0,
				netWgt: 592359800,
				fobvalue: 1870000000,
				cifvalue: null,
				classificationCode: "H6",
			},
		]);
		expect(out).toHaveLength(1);
		expect(out[0].date.toISOString()).toBe("2024-01-01T00:00:00.000Z");
		expect(out[0].region).toBe("AR→CN");
	});

	it("China-reported imports (flow M) use CIF value and the calibration type — never merged with the FOB mirror", () => {
		const out = parseTradeRows([
			{
				period: "2024",
				reporterCode: 156,
				flowCode: "M",
				partnerCode: 76,
				cmdCode: "0202",
				motCode: 0,
				netWgt: 1339849200,
				fobvalue: 123, // must be ignored on the import lane
				cifvalue: 6191927449,
				classificationCode: "H6",
			},
		]);
		expect(out).toHaveLength(1);
		expect(out[0].type).toBe("import_cn_cif_0202");
		expect(out[0].region).toBe("CN←BR");
		// live-verified: China 2024 HS0202 imports from BR = 1,339,849 t / $6,191.9M CIF
		expect(out[0].value).toBeCloseTo(4621.36, 1);
		expect(out[0].metadata.basis).toBe("CIF (China-reported import)");
	});

	it("maps calibration partner 0 to CN←WORLD (global total line)", () => {
		const out = parseTradeRows([
			{
				period: "2024",
				reporterCode: 156,
				flowCode: "M",
				partnerCode: 0,
				cmdCode: "0202",
				motCode: 0,
				netWgt: 2802592593,
				fobvalue: null,
				cifvalue: 12891959218,
				classificationCode: "H6",
			},
		]);
		expect(out[0].region).toBe("CN←WORLD");
	});

	it("drops malformed rows: missing value, zero weight, unparseable period, unknown reporter", () => {
		const base = {
			flowCode: "X" as const,
			partnerCode: 156,
			cmdCode: "0202",
			motCode: 0,
		};
		const out = parseTradeRows([
			{ ...base, period: "202606", reporterCode: 76, netWgt: 1000, fobvalue: null, cifvalue: null },
			{ ...base, period: "202606", reporterCode: 76, netWgt: 0, fobvalue: 5000, cifvalue: null },
			{ ...base, period: "202613", reporterCode: 76, netWgt: 1000, fobvalue: 5000, cifvalue: null },
			{
				...base,
				period: "202606",
				reporterCode: 999,
				netWgt: 1000,
				fobvalue: 5000,
				cifvalue: null,
			},
		]);
		expect(out).toHaveLength(0);
	});
});

describe("comtradeUrl + query set contract", () => {
	it("builds the preview URL with the full 8-code HS batch, single period, flow X, partner 156", () => {
		const url = comtradeUrl({
			freq: "M",
			reporterCode: 76,
			period: "202606",
			flowCode: "X",
			partnerCode: "156",
		});
		expect(url).toBe(
			"https://comtradeapi.un.org/public/v1/preview/C/M/HS?reporterCode=76&period=202606&cmdCode=0201%2C0202%2C020230%2C020220%2C020610%2C020621%2C020622%2C020629&flowCode=X&partnerCode=156",
		);
	});

	it("pins the lane composition (drift here changes what the mirror covers)", () => {
		expect(MONTHLY_REPORTERS.map((r) => r.code)).toEqual([76, 36, 554, 842]);
		expect(ANNUAL_FALLBACK_REPORTERS.map((r) => r.code)).toEqual([32, 858]);
		expect(HS_CODES).toEqual([
			"0201",
			"0202",
			"020230",
			"020220",
			"020610",
			"020621",
			"020622",
			"020629",
		]);
	});
});
