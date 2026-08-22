/**
 * parseImportDate — slash-date timezone tests (round-119).
 *
 * "MM/DD/YYYY" cells used to go through bare `new Date(dateStr)`, which
 * parses slash dates in the SERVER's local timezone. On the production
 * UTC+8 host, "08/21/2026" became 2026-08-20T16:00Z and the import loop's
 * setUTCHours(0,0,0,0) then pinned the row to August 20 — every slash-dated
 * import was silently backdated one day. The helper now builds slash
 * components as explicit UTC; ISO strings were already safe.
 *
 * TZ is pinned to Asia/Shanghai (the timezone that exposed the bug) so the
 * regression stays visible even when the test container itself runs UTC.
 * Same pattern as cmeFutures.yahoo.test.ts.
 */

process.env.TZ = "Asia/Shanghai";

import { describe, expect, it } from "vitest";
import { parseImportDate } from "../beefIngest";

describe("parseImportDate", () => {
	it("parses MM/DD/YYYY as UTC midnight — not server-local midnight", () => {
		const d = parseImportDate("08/21/2026");
		expect(d).not.toBeNull();
		expect(d?.toISOString()).toBe("2026-08-21T00:00:00.000Z");
	});

	it("parses single-digit month/day slash dates (M/D/YYYY)", () => {
		expect(parseImportDate("1/5/2026")?.toISOString()).toBe("2026-01-05T00:00:00.000Z");
	});

	it("keeps ISO date strings on the same UTC day", () => {
		expect(parseImportDate("2026-08-21")?.toISOString()).toBe("2026-08-21T00:00:00.000Z");
	});

	it("returns null for unparseable date cells", () => {
		expect(parseImportDate("not-a-date")).toBeNull();
		expect(parseImportDate("")).toBeNull();
		// Out-of-range components must not roll over into a different date.
		expect(parseImportDate("13/45/2026")).toBeNull();
		expect(parseImportDate("02/31/2026")).toBeNull(); // Feb 31 → would roll to Mar 3
	});
});
