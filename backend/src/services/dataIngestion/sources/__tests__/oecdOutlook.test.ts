import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib";
import {
	OUTLOOK_MEASURES,
	type OutlookRow,
	parseOutlookCsv,
	persistOutlookRows,
	splitCsvLine,
} from "../oecdOutlook";

// Live-shaped labeled-CSV excerpt: the real column order from the 2026-2035
// edition, including label columns (which may carry quoted commas) BEFORE
// OBS_VALUE. Rows cover: landed bovine rows, a non-bovine commodity, a
// non-landed area (URY is NOT modeled — but e.g. ZAF is modeled and skipped),
// a non-landed measure (PP), projection years, and a quoted label with a
// comma that must not shift columns.
const HEADER =
	"STRUCTURE,STRUCTURE_ID,STRUCTURE_NAME,ACTION,REF_AREA,Reference area,FREQ,Frequency of observation,COMMODITY,Commodity,MEASURE,Measure,UNIT_MEASURE,Unit of measure,VERSION_ID,Version ID,TIME_PERIOD,Time period,OBS_VALUE,Observation value";
const FIXTURE_CSV = [
	HEADER,
	// Realistic row (verified live): CHN QP 2024 = 7791 kt. The quoted
	// "Production, total" label contains a comma and must not shift columns.
	'DATAFLOW,OECD.TAD.ATM:DSD_AGR@DF_OUTLOOK_2026_2035(1.1),"OECD-FAO Agricultural Outlook 2026-2035",I,CHN,China,A,Annual,CPC_EX_BV,Bovine Meat,QP,"Production, total",T,Tonnes,AO_2026_2035,2026-2035,2024,2024,7791,Normal value',
	// Projection year (2027 > 2026 fixture currentYear).
	"DF,S,S,I,CHN,China,A,Annual,CPC_EX_BV,Bovine Meat,IM,Imports,T,Tonnes,AO,2026-2035,2027,2027,3950.5,x",
	// Non-bovine commodity — filtered out.
	"DF,S,S,I,CHN,China,A,Annual,CPC_EX_SKM,Skim milk,QP,Production,T,Tonnes,AO,2026-2035,2024,2024,999,x",
	// Bovine but non-landed area — filtered out.
	"DF,S,S,I,ZAF,South Africa,A,Annual,CPC_EX_BV,Bovine Meat,QP,Production,T,Tonnes,AO,2026-2035,2024,2024,555,x",
	// Bovine landed area but non-landed measure (PP producer price) — filtered out.
	"DF,S,S,I,BRA,Brazil,A,Annual,CPC_EX_BV,Bovine Meat,PP,Producer price,XDC_T,Local currency per tonne,AO,2026-2035,2024,2024,123,x",
	// Bovine, landed, exports with full precision.
	"DF,S,S,I,BRA,Brazil,A,Annual,CPC_EX_BV,Bovine Meat,EX,Exports,T,Tonnes,AO,2026-2035,2024,2024,3779,x",
].join("\n");

afterAll(async () => {
	await prisma.marketFactor.deleteMany({ where: { source: "oecd_outlook" } });
});

// ---------------------------------------------------------------------------
// splitCsvLine — quote-aware column split.
// ---------------------------------------------------------------------------
describe("splitCsvLine", () => {
	test("comma inside quotes does not split a column", () => {
		expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
	});
	test('escaped double quote ("" → ")', () => {
		expect(splitCsvLine('"a""b",c')).toEqual(['a"b', "c"]);
	});
	test("plain line behaves like split(',')", () => {
		expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
	});
});

// ---------------------------------------------------------------------------
// parseOutlookCsv — the shared filter (same code path the live stream uses).
// ---------------------------------------------------------------------------
describe("parseOutlookCsv", () => {
	const rows = parseOutlookCsv(FIXTURE_CSV, 2026);

	test("keeps only bovine × landed areas × landed measures", () => {
		expect(rows).toHaveLength(3); // CHN QP, CHN IM 2027, BRA EX
		expect(rows.every((r) => ["QP", "IM", "EX"].includes(r.measure))).toBe(true);
	});

	test("quoted-comma labels do not shift columns", () => {
		const chnQp = rows.find((r) => r.area === "CHN" && r.measure === "QP");
		// If the quoted "Production, total" label split naively, OBS_VALUE
		// would misalign and the value would not parse.
		expect(chnQp?.value).toBe(7791);
		expect(chnQp?.projection).toBe(false);
	});

	test("years beyond the current calendar year are marked as projections", () => {
		const im2027 = rows.find((r) => r.measure === "IM");
		expect(im2027?.projection).toBe(true);
		expect(im2027?.value).toBe(3950.5);
	});

	test("missing key columns → [] (format change stays honest-empty)", () => {
		expect(parseOutlookCsv("no,expected,columns\n1,2,3", 2026)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// persistOutlookRows — integration on the test DB (mt_test).
// ---------------------------------------------------------------------------
describe("persistOutlookRows", () => {
	const rows: OutlookRow[] = [
		{ area: "CHN", measure: "QP", year: 2024, value: 7791, projection: false },
		{ area: "CHN", measure: "QP", year: 2027, value: 8300.25, projection: true },
	];

	test("insert then true no-op, revision updates, projection stored in metadata", async () => {
		const first = await persistOutlookRows(rows);
		expect(first.inserted).toBe(2);

		const second = await persistOutlookRows(rows);
		expect(second.inserted).toBe(0);
		expect(second.updated).toBe(0);

		const revised = rows.map((r) => ({ ...r, value: r.value + 1 }));
		const third = await persistOutlookRows(revised);
		expect(third.updated).toBe(2);

		const stored = await prisma.marketFactor.findMany({
			where: { source: "oecd_outlook", region: "CHN", seriesKey: "QP" },
			orderBy: { date: "asc" },
		});
		expect(stored).toHaveLength(2);
		expect(stored.map((f) => f.date.getUTCFullYear())).toEqual([2024, 2027]);
		expect(stored[0].type).toBe("outlook_bovine");
		expect(stored[0].unit).toBe("kt (thousand tonnes, OECD-FAO Outlook)");
		expect(stored[0].metadata?.projection).toBe(false);
		expect(stored[1].metadata?.projection).toBe(true);
		expect(stored[1].metadata?.edition).toBe("2026-2035");
	});

	test("all four balance measures share the type family", async () => {
		const all: OutlookRow[] = Object.keys(OUTLOOK_MEASURES).map((measure) => ({
			area: "PRY",
			measure,
			year: 2025,
			value: 100 + measure.length,
			projection: false,
		}));
		await persistOutlookRows(all);
		const pry = await prisma.marketFactor.findMany({
			where: { source: "oecd_outlook", region: "PRY" },
		});
		expect(pry.map((f) => f.seriesKey).sort()).toEqual(["EX", "IM", "QC", "QP"]);
	});
});
