/**
 * fredData source tests — key gating, observation filtering, series-key
 * disambiguation, and per-series failure isolation.
 *
 * The production .env currently has an EMPTY FRED_API_KEY, so the live source
 * reports "Missing FRED_API_KEY" every cycle — the key-gate test pins the
 * exact behavior that keeps those runs honest (0 rows, no fetches).
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

describe("fredScraper", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.FRED_API_KEY;
		mocks.upsertFactor.mockResolvedValue({ inserted: 1, updated: 0 });
	});

	it("returns zeros without fetching when FRED_API_KEY is missing", async () => {
		const result = await fredScraper.fetch();

		expect(result).toEqual({ inserted: 0, updated: 0 });
		expect(mocks.scraperFetch).not.toHaveBeenCalled();
		expect(mocks.logger.warn).toHaveBeenCalledWith(expect.stringContaining("No FRED_API_KEY"));
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
		const forWheat = mocks.upsertFactor.mock.calls.filter((c) => c[0].seriesKey === "PWHEAMTUSD");
		expect(forWheat).toHaveLength(12);

		// Every write is disambiguated by seriesKey (the round-fix for 15
		// "economic"/"US" series overwriting each other per date).
		expect(forWheat[0][0]).toMatchObject({
			type: "economic",
			region: "US",
			source: "fred",
			seriesKey: "PWHEAMTUSD",
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

	it("exposes requiresKey so the board shows skipped_no_key, not error", () => {
		expect(fredScraper.name).toBe("fred");
		expect(fredScraper.requiresKey).toBe("FRED_API_KEY");
	});
});
