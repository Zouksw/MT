/**
 * NW_LS421 (Import Beef Trade) PDF-text parser (V7 批1, round-149).
 *
 * Fixture is the verbatim `pdftotext -layout` output of the real 2026-08-28
 * report (ams_2823.pdf), including its layout quirks the state machine must
 * tolerate: the South America 16-45 section header sitting at the bottom of
 * page 1 with its rows only arriving after the repeated page-2 header, and
 * West Coast columns present-but-empty. Layout drift must surface as 0 quotes
 * (the fetch path then refuses to write), never as wrong-shaped rows.
 */

import { describe, expect, it } from "vitest";
import { parseImportBeefReport } from "@/services/dataIngestion/sources/usdaImportBeef";

const REAL_REPORT_2026_08_28 = `
                  Import Beef Trade (NW_LS421)
                  Agricultural Marketing Service
                  Livestock, Poultry, and Grain Market News                                 Fri Aug 28, 2026
Email us with accessibility issues with this report.

Report for: 08/28/2026
Compared to last market test: Import prices were weak to lower, instances moderately to sharply lower.
Trading activity was very slow. Weaker demand continued to pressure domestic and imported lean and
trimmings prices.

                                             Australia / New Zealand
BEEF
                                       0-15 Days (Per Cwt - F.O.B / T.I.S.)
                                                    East Coast                        West Coast
                                                   Price Range                         Price Range
Bull Meat (95%)                                   388.00 - 392.00
Cow Meat (95%)                                    378.00 - 382.00
Cow Meat (90%)                                    342.00 - 354.00
CFM Fores (85%)                                   330.00 - 336.00
Beef Trim (85%)                                   328.00 - 334.00

                                      16-45 Days (Per Cwt - F.O.B / T.I.S.)
                                                    East Coast                         West Coast
                                                    Price Range                        Price Range
Bull Meat (95%)                                   388.00 - 392.00
Cow Meat (95%)                                    378.00 - 382.00
Cow Meat (90%)                                    342.00 - 354.00
CFM Fores (85%)                                   330.00 - 335.00
Beef Trim (85%)                                   328.00 - 332.00




                                                 South America
BEEF
                                       0-15 Days (Per Cwt - F.O.B / T.I.S.)
                                                    East Coast                         West Coast
                                                     Price Range                       Price Range
Bull Meat (95%)                                    339.00 - 340.00
Cow Meat (90%)                                     328.00 - 332.00

                                      16-45 Days (Per Cwt - F.O.B / T.I.S.)
                                                    East Coast                         West Coast
                                                     Price Range                       Price Range

 Source:   USDA AMS Livestock, Poultry & Grain Market News                                           Page 1 of 2
           Des Moines, IA | (515) 284-4460
           www.ams.usda.gov/lpgmn
           https://mymarketnews.ams.usda.gov/ | https://mymarketnews.ams.usda.gov/viewReport/2823
                  Import Beef Trade (NW_LS421)
                  Agricultural Marketing Service
                  Livestock, Poultry, and Grain Market News                                 Fri Aug 28, 2026
Email us with accessibility issues with this report.
                                                     Price Range
Bull Meat (95%)                                    339.00 - 342.00
Cow Meat (90%)                                     320.00 - 332.00




 Source:   USDA AMS Livestock, Poultry & Grain Market News                                           Page 2 of 2
           Des Moines, IA | (515) 284-4460
           www.ams.usda.gov/lpgmn
           https://mymarketnews.ams.usda.gov/ | https://mymarketnews.ams.usda.gov/viewReport/2823
`;

describe("parseImportBeefReport — real 2026-08-28 NW_LS421 layout", () => {
	it("extracts the report date from the 'Report for:' line (MM/DD/YYYY → UTC)", () => {
		const { date } = parseImportBeefReport(REAL_REPORT_2026_08_28);
		expect(date).toEqual(new Date("2026-08-28T00:00:00Z"));
	});

	it("parses all 14 quotes: 5+5 AU/NZ, 2+2 South America (page-split section)", () => {
		const { quotes } = parseImportBeefReport(REAL_REPORT_2026_08_28);
		expect(quotes).toHaveLength(14);
		const anz = quotes.filter((q) => q.origin === "australia_nz");
		const sa = quotes.filter((q) => q.origin === "south_america");
		expect(anz).toHaveLength(10);
		expect(sa).toHaveLength(4);
	});

	it("canonical 90CL row: AU/NZ 0-15 Cow Meat (90%) East Coast 342.00-354.00", () => {
		const { quotes } = parseImportBeefReport(REAL_REPORT_2026_08_28);
		const q = quotes.find(
			(x) => x.origin === "australia_nz" && x.window === "0-15" && x.item === "Cow Meat (90%)",
		);
		expect(q).toBeDefined();
		expect(q).toMatchObject({
			leanPct: 90,
			eastLow: 342,
			eastHigh: 354,
			// West Coast column present-but-empty in this edition
			westLow: null,
			westHigh: null,
		});
	});

	it("rows after the page break land in the section the header started (SA 16-45)", () => {
		const { quotes } = parseImportBeefReport(REAL_REPORT_2026_08_28);
		const sa1645 = quotes.filter((x) => x.origin === "south_america" && x.window === "16-45");
		expect(sa1645.map((x) => x.item)).toEqual(["Bull Meat (95%)", "Cow Meat (90%)"]);
		expect(sa1645[1]).toMatchObject({ eastLow: 320, eastHigh: 332 });
	});

	it("empty West Coast cells never produce phantom quotes", () => {
		const { quotes } = parseImportBeefReport(REAL_REPORT_2026_08_28);
		expect(quotes.every((q) => q.westLow == null && q.westHigh == null)).toBe(true);
	});
});

describe("parseImportBeefReport — drift and robustness", () => {
	it("returns no quotes for empty text", () => {
		expect(parseImportBeefReport("")).toEqual({ date: null, quotes: [] });
	});

	it("quote-shaped rows outside any section header are ignored", () => {
		const stray = "Cow Meat (90%)\t331.00 - 335.00";
		expect(parseImportBeefReport(stray).quotes).toEqual([]);
	});

	it("a West Coast second range is captured when quoted", () => {
		const text = [
			"Australia / New Zealand",
			"0-15 Days (Per Cwt - F.O.B / T.I.S.)",
			"Cow Meat (90%)                                    342.00 - 354.00   346.00 - 350.00",
		].join("\n");
		const { quotes } = parseImportBeefReport(text);
		expect(quotes).toHaveLength(1);
		expect(quotes[0]).toMatchObject({ westLow: 346, westHigh: 350 });
	});

	it("a malformed range (low > high) is dropped, not written", () => {
		const text = [
			"Australia / New Zealand",
			"0-15 Days (Per Cwt - F.O.B / T.I.S.)",
			"Cow Meat (90%)                                    354.00 - 342.00",
		].join("\n");
		expect(parseImportBeefReport(text).quotes).toEqual([]);
	});

	it("unknown item labels are ignored (layout growth stays explicit)", () => {
		const text = [
			"Australia / New Zealand",
			"0-15 Days (Per Cwt - F.O.B / T.I.S.)",
			"Heifer Meat (90%)                                 342.00 - 354.00",
		].join("\n");
		expect(parseImportBeefReport(text).quotes).toEqual([]);
	});
});
