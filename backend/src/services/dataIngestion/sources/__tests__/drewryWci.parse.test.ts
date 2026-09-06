/**
 * drewryWci parse contract (round-161 批2) — fixture trimmed from the live
 * free WCI page (captured 2026-09-07: composite $4,465/40ft assessed
 * Thursday 03 Sep 2026).
 */

import { describe, expect, it } from "vitest";
import { parseWciPage } from "@/services/dataIngestion/sources/drewryWci";

const LIVE_FIXTURE = `
<p>&nbsp;</p>
<h4>Our detailed assessment for Thursday, 03 Sep 2026</h4>
<ul><li>The Drewry World Container Index (WCI), the benchmark widely referenced
by procurement teams, remained stable at $4,465 per 40ft container, as the
increase in Transpacific trade routes was offset by ...</li>
<li>Freight rates from Shanghai to Los Angeles rose to $7,185 per 40ft...</li>
<li>Freight rates from Shanghai to New York rose to $9,587 per 40ft...</li>
<li>Freight rates from Shanghai to Genoa ... $4,368 per 40ft...</li>
<li>... Shanghai–Rotterdam ... $4,092 per 40ft...</li>
</ul>
`;

describe("parseWciPage", () => {
	it("extracts the composite (FIRST $-per-40ft match) and the assessment Thursday", () => {
		const parsed = parseWciPage(LIVE_FIXTURE);
		expect(parsed).not.toBeNull();
		expect(parsed?.compositeUsd).toBe(4465);
		expect(parsed?.date.toISOString().slice(0, 10)).toBe("2026-09-03");
	});

	it("returns null when either marker is gone (page reformat → honest 0-row warning, no guess)", () => {
		expect(parseWciPage("<html>no markers at all</html>")).toBeNull();
		// Value present but assessment-date heading gone.
		expect(parseWciPage("Index at $4,465 per 40ft container")).toBeNull();
		// Date present but no dollar figure.
		expect(parseWciPage("Our detailed assessment for Thursday, 03 Sep 2026</h4>")).toBeNull();
	});

	it("rejects non-positive or unparseable values", () => {
		const withBadValue = LIVE_FIXTURE.replace("$4,465", "$0");
		expect(parseWciPage(withBadValue)).toBeNull();
	});

	it("rounds through the Decimal(18,6) contract via the caller (value itself integer-like here)", () => {
		const cents = LIVE_FIXTURE.replace("$4,465 per", "$4,465.55 per");
		expect(parseWciPage(cents)?.compositeUsd).toBe(4465.55);
	});
});
