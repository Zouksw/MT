import { describe, expect, it } from "vitest";
import {
	classifyBeefFreshness,
	FRESH_WINDOW_DAYS,
	pageFreshnessSummary,
	STALE_WINDOW_DAYS,
	withFreshness,
} from "../beefFreshness";

// Fixed "now" so age calculations are deterministic. 2026-07-26T00:00:00Z.
const NOW = new Date("2026-07-26T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("classifyBeefFreshness", () => {
	describe("bridge rows are ALWAYS proxy (regardless of age)", () => {
		it("a fresh bridge row (age 0) is still proxy, not live", () => {
			const r = classifyBeefFreshness(
				{ source: "bridge:commodity:aus_cube_roll_m9", date: NOW },
				NOW,
			);
			expect(r.freshness).toBe("proxy");
		});

		it("an old bridge row is still proxy (not snapshot)", () => {
			const r = classifyBeefFreshness(
				{ source: "bridge:commodity:aus_brisket_m7", date: daysAgo(90) },
				NOW,
			);
			expect(r.freshness).toBe("proxy");
		});

		it("reason mentions 'proxy' and the age", () => {
			const r = classifyBeefFreshness(
				{ source: "bridge:commodity:bra_topside", date: daysAgo(5) },
				NOW,
			);
			expect(r.reason).toContain("proxy");
			expect(r.reason).toContain("5d");
		});
	});

	describe("seed rows are ALWAYS snapshot", () => {
		it("a seed-prefixed source is snapshot even at age 0", () => {
			const r = classifyBeefFreshness({ source: "seed:demo", date: NOW }, NOW);
			expect(r.freshness).toBe("snapshot");
		});
	});

	describe("real scraper output is gated on age", () => {
		it("real source within FRESH_WINDOW_DAYS is live", () => {
			const r = classifyBeefFreshness({ source: "usda_ams_xb405", date: daysAgo(1) }, NOW);
			expect(r.freshness).toBe("live");
		});

		it(`real source at exactly STALE_WINDOW_DAYS (${STALE_WINDOW_DAYS}d) is still live`, () => {
			// Boundary: age == STALE_WINDOW_DAYS → live (<= check)
			const r = classifyBeefFreshness(
				{ source: "mla_nlrs", date: daysAgo(STALE_WINDOW_DAYS) },
				NOW,
			);
			expect(r.freshness).toBe("live");
		});

		it(`real source older than STALE_WINDOW_DAYS becomes snapshot`, () => {
			const r = classifyBeefFreshness(
				{ source: "mla_nlrs", date: daysAgo(STALE_WINDOW_DAYS + 1) },
				NOW,
			);
			expect(r.freshness).toBe("snapshot");
			expect(r.reason).toContain("stale");
		});

		it("the documented 2026-04-30 frozen seed (mis-labeled mla_nlrs) classifies as snapshot by age", () => {
			// This is the real-world case: source says 'mla_nlrs' but the data is
			// 87 days old. The honesty framework catches it via the age gate, even
			// though the source column itself is not prefixed.
			const r = classifyBeefFreshness(
				{ source: "mla_nlrs", date: new Date("2026-04-30T00:00:00.000Z") },
				NOW,
			);
			expect(r.freshness).toBe("snapshot");
			expect(r.reason).toContain("stale");
		});
	});

	it("dataDate is echoed back unchanged", () => {
		const d = daysAgo(2);
		const r = classifyBeefFreshness({ source: "inac", date: d }, NOW);
		expect(r.dataDate).toBe(d);
	});
});

describe("withFreshness", () => {
	it("adds freshness/dataDate/reason to each row without mutating input", () => {
		const rows = [
			{ source: "usda_ams_xb405", date: daysAgo(1), price: 5.2, cutCode: "BRISKET_NAVEL" },
			{ source: "bridge:commodity:bra_topside", date: daysAgo(2), price: 4.1, cutCode: "TOPSIDE" },
		];
		const out = withFreshness(rows, NOW);
		expect(out).toHaveLength(2);
		expect(out[0].freshness).toBe("live");
		expect(out[0].price).toBe(5.2); // original fields preserved
		expect(out[0].cutCode).toBe("BRISKET_NAVEL");
		expect(out[1].freshness).toBe("proxy");
		// input not mutated
		expect(rows[0]).not.toHaveProperty("freshness");
	});
});

describe("pageFreshnessSummary", () => {
	it("allStale=true when zero live rows but some proxy/snapshot exist", () => {
		const rows = [
			{ source: "bridge:commodity:aus_cube_roll_m9", date: daysAgo(1) },
			{ source: "mla_nlrs", date: daysAgo(90) }, // stale → snapshot
		];
		const s = pageFreshnessSummary(rows, NOW);
		expect(s.allStale).toBe(true);
		expect(s.liveCount).toBe(0);
		expect(s.proxyCount).toBe(1);
		expect(s.snapshotCount).toBe(1);
	});

	it("allStale=false when at least one live row exists", () => {
		const rows = [
			{ source: "usda_ams_xb405", date: daysAgo(1) }, // live
			{ source: "bridge:commodity:bra_topside", date: daysAgo(2) }, // proxy
		];
		const s = pageFreshnessSummary(rows, NOW);
		expect(s.allStale).toBe(false);
		expect(s.liveCount).toBe(1);
	});

	it("empty rows → allStale=false (no banner on empty page)", () => {
		const s = pageFreshnessSummary([], NOW);
		expect(s.allStale).toBe(false);
		expect(s.latestDate).toBeNull();
	});

	it("latestDate is the maximum date across rows", () => {
		const rows = [
			{ source: "mla_nlrs", date: daysAgo(10) },
			{ source: "usda_ams_xb405", date: daysAgo(1) },
			{ source: "inac", date: daysAgo(5) },
		];
		const s = pageFreshnessSummary(rows, NOW);
		expect(s.latestDate).toEqual(daysAgo(1));
	});
});

describe("constants are sane", () => {
	it("FRESH_WINDOW_DAYS < STALE_WINDOW_DAYS", () => {
		expect(FRESH_WINDOW_DAYS).toBeLessThanOrEqual(STALE_WINDOW_DAYS);
	});
});
