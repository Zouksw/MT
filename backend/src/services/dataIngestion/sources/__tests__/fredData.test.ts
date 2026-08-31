/**
 * fredData source tests — dual fetch paths, observation filtering, series-key
 * disambiguation, per-series failure isolation, and the keyless fallback
 * contract (round-153).
 *
 * The production .env has no FRED_API_KEY. Before round-153 the source
 * hard-skipped every cycle ("Missing FRED_API_KEY" error rows ~30/36h); now
 * it falls back to the public fredgraph.csv download and keeps ingesting.
 * With a key the official JSON API path runs unchanged.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	scraperFetch: vi.fn(),
	upsertFactor: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib", () => ({ logger: mocks.logger }));
vi.mock("@/services/dataIngestion/helpers", () => ({ upsertFactor: mocks.upsertFactor }));
vi.mock("@/services/dataIngestion/http", () => ({ scraperFetch: mocks.scraperFetch }));

import { fredScraper } from "@/services/dataIngestion/sources/fredData";

function observations(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		realtime_start: "2026-08-22",
		realtime_end: "9999-12-31",
		date: `2026-${String(((i % 12) + 1).toString()).padStart(2, "0")}-01`,
		value: i === 3 ? "." : String(100 + i), // one missing observation
	}));
}

/** A fredgraph.csv body with `count` daily rows carrying >6dp values. */
function csvObservations(count: number) {
	const rows = Array.from(
		{ length: count },
		(_, i) => `2026-08-${String(i + 1).padStart(2, "0")},${(100 + i).toFixed(9)}`,
	);
	return `observation_date,X\n${rows.join("\n")}\n`;
}

describe("fredScraper", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.FRED_API_KEY;
		mocks.upsertFactor.mockResolvedValue({ inserted: 1, updated: 0 });
	});

	it("without FRED_API_KEY: keyless fredgraph.csv fallback ingests every series (12-obs cap, 6dp rounding, csv provenance)", async () => {
		mocks.scraperFetch.mockImplementation(async (url: string) => {
			if (url.includes("fredgraph.csv")) {
				return { ok: true, status: 200, text: async () => csvObservations(15) };
			}
			return { ok: false, status: 0 };
		});

		const result = await fredScraper.fetch();

		expect(result.inserted).toBeGreaterThan(0);
		// The fallback fetches the public CSV endpoint, never the keyed API.
		expect(mocks.scraperFetch).toHaveBeenCalledWith(
			expect.stringContaining("fredgraph.csv"),
			expect.anything(),
		);
		expect(mocks.scraperFetch).not.toHaveBeenCalledWith(
			expect.stringContaining("api.stlouisfed.org"),
			expect.anything(),
		);

		// 15 observations → last 12 kept (CSV arrives oldest-first).
		const forWheat = mocks.upsertFactor.mock.calls.filter((c) => c[0].seriesKey === "PWHEAMTUSDM");
		expect(forWheat).toHaveLength(12);

		// Decimal(18,6) storage precision — the value equals its own 6dp
		// rounding so a re-scrape is a true no-op.
		for (const call of forWheat) {
			expect(call[0].value).toBe(Math.round(call[0].value * 1e6) / 1e6);
		}
		// Provenance: which path produced the row.
		expect(forWheat[0][0].metadata.fetchPath).toBe("csv");
		// Region + series-key disambiguation unchanged by the fallback.
		expect(forWheat[0][0]).toMatchObject({ type: "economic", region: "US", source: "fred" });
		const dexCall = mocks.upsertFactor.mock.calls.find((c) => c[0].seriesKey === "DEXCHUS")?.[0];
		expect(dexCall?.region).toBe("global");
	});

	it("confirmed-unchanged cycle (no key, data seen, 0/0 writes) → noChange:true", async () => {
		mocks.scraperFetch.mockImplementation(async (url: string) => {
			if (url.includes("fredgraph.csv")) {
				return { ok: true, status: 200, text: async () => csvObservations(3) };
			}
			return { ok: false, status: 0 };
		});
		mocks.upsertFactor.mockResolvedValue({ inserted: 0, updated: 0 });

		const result = await fredScraper.fetch();

		expect(result).toEqual({ inserted: 0, updated: 0, noChange: true });
	});

	it("an HTML error page (series absent on fredgraph.csv) is skipped, never parsed as data", async () => {
		mocks.scraperFetch.mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => '<html lang="en"><body>not found</body></html>',
		});

		const result = await fredScraper.fetch();

		expect(mocks.upsertFactor).not.toHaveBeenCalled();
		expect(result).toEqual({ inserted: 0, updated: 0 });
		expect(mocks.logger.warn).toHaveBeenCalledWith(expect.stringContaining("HTML"));
	});

	it("stores only the last 12 non-missing observations per series, keyed by seriesId", async () => {
		process.env.FRED_API_KEY = "test-key";
		mocks.scraperFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ observations: observations(15) }),
		});

		const result = await fredScraper.fetch();

		// 15 observations minus the "." one = 14 valid, capped at 12 per series.
		const forWheat = mocks.upsertFactor.mock.calls.filter((c) => c[0].seriesKey === "PWHEAMTUSDM");
		expect(forWheat).toHaveLength(12);

		// Every write is disambiguated by seriesKey (the round-fix for 15
		// "economic"/"US" series overwriting each other per date).
		expect(forWheat[0][0]).toMatchObject({
			type: "economic",
			region: "US",
			source: "fred",
			seriesKey: "PWHEAMTUSDM",
		});

		// DEX* series are global-region.
		const dexCall = mocks.upsertFactor.mock.calls.find((c) => c[0].seriesKey === "DEXCHUS")?.[0];
		expect(dexCall?.region).toBe("global");

		// The fetch URL carries the series + key.
		expect(mocks.scraperFetch).toHaveBeenCalledWith(
			expect.stringContaining("series_id=DEXCHUS"),
			expect.anything(),
		);
		expect(mocks.scraperFetch).toHaveBeenCalledWith(
			expect.stringContaining("api_key=test-key"),
			expect.anything(),
		);

		// The keyed path records its provenance too.
		expect(forWheat[0][0].metadata.fetchPath).toBe("api");

		expect(result.inserted).toBeGreaterThan(0);
	});

	it("isolates a failing series — the rest of the loop still ingests", async () => {
		process.env.FRED_API_KEY = "test-key";
		mocks.scraperFetch.mockImplementation(async (url: string) => {
			if (url.includes("series_id=DCOILWTICO")) throw new Error("timeout");
			return {
				ok: true,
				status: 200,
				json: async () => ({ observations: observations(2) }),
			};
		});

		const result = await fredScraper.fetch();

		// No throw; other series still wrote (all series minus the failed one).
		expect(result.inserted).toBeGreaterThan(0);
		expect(mocks.logger.warn).toHaveBeenCalledWith(expect.stringContaining("DCOILWTICO"));
	});

	it("no requiresKey gate — the keyless fallback keeps the source running without a key", () => {
		expect(fredScraper.name).toBe("fred");
		expect(fredScraper.requiresKey).toBeUndefined();
	});
});
