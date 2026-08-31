/**
 * fredCsv shared module — Decimal(18,6) storage precision contract (round-153).
 *
 * commodity_prices OHLC columns are Decimal(18,6), and upsertPrice's samePrice
 * no-op compares the incoming float against the stored value with ===. A FRED
 * CSV value with more than 6 decimal places (the Pink Sheet indices carry 14,
 * e.g. 89.61709686727274) stores truncated and then never compares equal —
 * every world_bank run rewrote 23-35 unchanged rows (observed live 2026-08-31,
 * ingestion_logs updated column). These tests pin the parse-boundary rounding
 * so a re-scrape of the same CSV is a true no-op.
 *
 * scraperFetch + upsert helpers are mocked (commodityPrices.test.ts
 * convention): what's under test is THIS module's own parse/write logic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	scraperFetch: vi.fn(),
	ensureCommodity: vi.fn(),
	upsertPrice: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib", () => ({ logger: mocks.logger }));
vi.mock("@/services/dataIngestion/helpers", () => ({
	ensureCommodity: mocks.ensureCommodity,
	upsertPrice: mocks.upsertPrice,
}));
vi.mock("@/services/dataIngestion/http", () => ({ scraperFetch: mocks.scraperFetch }));

import { fetchFredCsvSeries } from "@/services/dataIngestion/fredCsv";

// Live fredgraph.csv body for PPORKUSDM (2026-05→07, fetched 2026-08-31) —
// raw values carry 14 decimal places.
const PORK_CSV = `observation_date,PPORKUSDM
2026-05-01,88.80053536000000
2026-06-01,89.61709686727274
2026-07-01,92.29046216818182
`;

function csvResponse(body: string) {
	return { ok: true, status: 200, text: async () => body };
}

const CONFIG = {
	seriesId: "PPORKUSDM",
	slug: "pork_world",
	name: "Pork (World Bank Index)",
	category: "proteins",
	unit: "index (2010=100)",
};

describe("fetchFredCsvSeries — 6dp storage rounding (round-153)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.ensureCommodity.mockResolvedValue({ id: "c-pork" });
		mocks.upsertPrice.mockResolvedValue({ inserted: 1, updated: 0 });
	});

	it("rounds >6dp values to Decimal(18,6) precision on every OHLC field", async () => {
		mocks.scraperFetch.mockResolvedValue(csvResponse(PORK_CSV));

		const r = await fetchFredCsvSeries({
			config: CONFIG,
			start: new Date("2026-05-01T00:00:00Z"),
			interval: "monthly",
			commoditySource: "fred_monthly",
			logPrefix: "[TEST]",
		});

		// Parsed-rows count so callers can distinguish a confirmed-unchanged
		// 0/0 cycle (seen>0) from a truly empty fetch (seen===0).
		expect(r.seen).toBe(3);
		expect(mocks.upsertPrice).toHaveBeenCalledTimes(3);
		const june = mocks.upsertPrice.mock.calls[1][0];
		const raw = 89.61709686727274;
		// The stored/storable value is exactly the 6dp rounding — and therefore
		// equal to what a re-scrape of the same CSV will send next run.
		expect(june.close).toBe(Math.round(raw * 1e6) / 1e6);
		expect(june.close).toBe(89.617097);
		expect(june.open).toBe(89.617097);
		expect(june.high).toBe(89.617097);
		expect(june.low).toBe(89.617097);
	});

	it("re-scraping the same CSV sends values that equal their own 6dp rounding (no-op guarantee)", async () => {
		mocks.scraperFetch.mockResolvedValue(csvResponse(PORK_CSV));

		await fetchFredCsvSeries({
			config: CONFIG,
			start: new Date("2026-05-01T00:00:00Z"),
			interval: "monthly",
			commoditySource: "fred_monthly",
			logPrefix: "[TEST]",
		});

		// The invariant samePrice needs: value === Math.round(value * 1e6) / 1e6.
		// Before round-153 the raw 14dp float violated it for every row.
		for (const call of mocks.upsertPrice.mock.calls) {
			const { close } = call[0];
			expect(close).toBe(Math.round(close * 1e6) / 1e6);
		}
	});

	it("short-decimal values pass through unchanged (rounding must not alter clean values)", async () => {
		mocks.scraperFetch.mockResolvedValue(
			csvResponse("observation_date,DEXCHUS\n2026-08-03,6.7563\n"),
		);

		await fetchFredCsvSeries({
			config: { ...CONFIG, seriesId: "DEXCHUS", slug: "usd_cny", unit: "CNY/USD" },
			start: new Date("2026-08-01T00:00:00Z"),
			interval: "daily",
			commoditySource: "fred",
			logPrefix: "[TEST]",
		});

		const only = mocks.upsertPrice.mock.calls[0][0];
		expect(only.close).toBe(6.7563);
		// Flat-candle honesty + attribution contract preserved by the rounding fix.
		expect(only).toMatchObject({
			source: "fred",
			interval: "daily",
			volume: null,
		});
	});
});
