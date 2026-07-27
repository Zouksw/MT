/**
 * Time constants — regression guard against MINUTE/HOUR/DAY confusion.
 *
 * Round-44 fixed a real bug where a "10 minute" alert interval was written as
 * `10 * MS_PER_HOUR` (= 10 hours). These tests pin the magnitudes so a future
 * MINUTE↔HOUR mix-up fails loudly instead of silently running 60× too slow.
 */

import { describe, expect, it } from "vitest";
import {
	MS_PER_DAY,
	MS_PER_HOUR,
	MS_PER_MINUTE,
	MS_PER_SECOND,
	MS_PER_WEEK,
} from "@/lib/constants";

describe("time constants (ms)", () => {
	it("MS_PER_SECOND = 1000", () => {
		expect(MS_PER_SECOND).toBe(1000);
	});

	it("MS_PER_MINUTE = 60_000 (60 seconds)", () => {
		expect(MS_PER_MINUTE).toBe(60_000);
		expect(MS_PER_MINUTE).toBe(60 * MS_PER_SECOND);
	});

	it("MS_PER_HOUR = 3_600_000 (60 minutes, NOT 60 seconds)", () => {
		// The round-44 bug was using MS_PER_HOUR where MS_PER_MINUTE was meant.
		// This magnitude gap (60×) is exactly what made the bug silent.
		expect(MS_PER_HOUR).toBe(3_600_000);
		expect(MS_PER_HOUR).toBe(60 * MS_PER_MINUTE);
		expect(MS_PER_HOUR).not.toBe(MS_PER_MINUTE); // never equal — they differ 60×
	});

	it("MS_PER_DAY = 86_400_000 (24 hours)", () => {
		expect(MS_PER_DAY).toBe(86_400_000);
		expect(MS_PER_DAY).toBe(24 * MS_PER_HOUR);
	});

	it("MS_PER_WEEK = 604_800_000 (7 days)", () => {
		expect(MS_PER_WEEK).toBe(604_800_000);
		expect(MS_PER_WEEK).toBe(7 * MS_PER_DAY);
	});

	it("10 * MS_PER_MINUTE is 10 minutes (600_000 ms), not 10 hours", () => {
		// Direct pin for the round-44 alert-interval fix.
		expect(10 * MS_PER_MINUTE).toBe(600_000);
		expect(10 * MS_PER_MINUTE).not.toBe(10 * MS_PER_HOUR);
	});
});
