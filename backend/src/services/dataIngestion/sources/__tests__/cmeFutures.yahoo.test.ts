/**
 * cmeFutures — Yahoo bar normalization tests (round-119).
 *
 * Two production data-quality defects are pinned here:
 *  1. Bar dating: `new Date(epoch)` + server-LOCAL `setHours(0,0,0,0)`
 *     backdated every daily bar one calendar day on a UTC+8 server (session D
 *     stored as D-1 16:00Z — production had Sunday-dated bars and missing
 *     Fridays). The bar date must be UTC-midnight of the session day.
 *  2. OHLC sanity: Yahoo placeholders 0/null on unfinished bars leaked into
 *     storage (a cotton row with open=0.0 and two rows with close>high).
 *
 * scraperFetch / ensureCommodity / upsertPrice are mocked; the FRED phase-1
 * URLs return not-ok so only the Yahoo path writes.
 */

process.env.TZ = "Asia/Shanghai"; // pin the timezone that exposed the dating bug

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	scraperFetch: vi.fn(),
	ensureCommodity: vi.fn(),
	upsertPrice: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib", () => ({ logger: mocks.logger }));
vi.mock("@/services/dataIngestion/helpers", () => ({
	ensureCommodity: mocks.ensureCommodity,
	upsertPrice: mocks.upsertPrice,
}));
vi.mock("@/services/dataIngestion/http", () => ({ scraperFetch: mocks.scraperFetch }));

import { cmeFuturesScraper } from "@/services/dataIngestion/sources/cmeFutures";

function yahooChart(bar: {
	ts: number;
	open?: number | null;
	high?: number | null;
	low?: number | null;
	close?: number | null;
	volume?: number | null;
}) {
	return {
		ok: true,
		status: 200,
		json: async () => ({
			chart: {
				result: [
					{
						timestamp: [bar.ts],
						indicators: {
							quote: [
								{
									open: [bar.open ?? null],
									high: [bar.high ?? null],
									low: [bar.low ?? null],
									close: [bar.close ?? null],
									volume: [bar.volume ?? null],
								},
							],
						},
					},
				],
			},
		}),
	};
}

/** upsertPrice calls for one slug (ensureCommodity mock returns c-{slug}). */
function writesFor(slug: string) {
	return mocks.upsertPrice.mock.calls
		.map(
			(c) =>
				c[0] as {
					commodityId: string;
					date: Date;
					open: number;
					high: number;
					low: number;
					close: number;
				},
		)
		.filter((c) => c.commodityId === `c-${slug}`);
}

// Retargeted per test via assignment before fetch() (declared inside the
// describe below, after beforeEach).

describe("cmeFutures — Yahoo bar normalization (round-119)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.ensureCommodity.mockImplementation(async ({ slug }: { slug: string }) => ({
			id: `c-${slug}`,
		}));
		mocks.upsertPrice.mockResolvedValue({ inserted: 1, updated: 0 });
		mocks.scraperFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("query1.finance.yahoo.com")) return yahooChart(currentBar);
			// FRED phase-1 series: not-ok → phase skips without throwing.
			return { ok: false, status: 502, json: async () => ({}) };
		});
	});

	let currentBar: {
		ts: number;
		open?: number | null;
		high?: number | null;
		low?: number | null;
		close?: number | null;
		volume?: number | null;
	};

	it("stamps the bar at UTC midnight of the SESSION day (not D-1 in local time)", async () => {
		// Friday 2026-08-14 session open 13:30Z. The old local-+08 truncation
		// produced 2026-08-13T16:00:00Z (a Thursday-dated Friday bar).
		currentBar = {
			ts: Math.floor(Date.parse("2026-08-14T13:30:00Z") / 1000),
			open: 224,
			high: 226,
			low: 223,
			close: 225,
			volume: 1000,
		};

		await cmeFuturesScraper.fetch();

		const writes = writesFor("live_cattle_cme");
		expect(writes.length).toBe(1);
		expect(writes[0].date.toISOString()).toBe("2026-08-14T00:00:00.000Z");
	});

	it("falls back a zero/placeholder open to close and clamps high/low around close", async () => {
		// The exact production cotton2_cme 2026-08-20 shape: open=0.0,
		// close above the day's high.
		currentBar = {
			ts: Math.floor(Date.parse("2026-08-20T13:30:00Z") / 1000),
			open: 0,
			high: 0.829,
			low: 0.8196,
			close: 0.886,
			volume: 19788,
		};

		await cmeFuturesScraper.fetch();

		const writes = writesFor("cotton2_cme");
		expect(writes.length).toBe(1);
		// cotton2 has priceFactor 0.01 (cents → USD); assert the RELATIONSHIPS
		// so the factor doesn't mask the normalization being pinned.
		expect(writes[0].open).toBeCloseTo(writes[0].close); // placeholder → close
		expect(writes[0].high).toBeCloseTo(writes[0].close); // clamped to include close
		expect(writes[0].low).toBeCloseTo(0.8196 * 0.01);
		expect(writes[0].close).toBeCloseTo(0.886 * 0.01);
	});

	it("skips a null/zero-close unfinished bar and walks back to the previous one", async () => {
		// Last bar unfinished (close null), previous bar valid → previous wins.
		mocks.scraperFetch.mockImplementation(async (url: string) => {
			if (!String(url).includes("query1.finance.yahoo.com")) {
				return { ok: false, status: 502, json: async () => ({}) };
			}
			return {
				ok: true,
				status: 200,
				json: async () => ({
					chart: {
						result: [
							{
								timestamp: [
									Math.floor(Date.parse("2026-08-13T13:30:00Z") / 1000),
									Math.floor(Date.parse("2026-08-14T13:30:00Z") / 1000),
								],
								indicators: {
									quote: [
										{
											open: [220, null],
											high: [224, null],
											low: [219, null],
											close: [223, null],
											volume: [900, null],
										},
									],
								},
							},
						],
					},
				}),
			};
		});

		await cmeFuturesScraper.fetch();

		const writes = writesFor("live_cattle_cme");
		expect(writes.length).toBe(1);
		expect(writes[0].date.toISOString()).toBe("2026-08-13T00:00:00.000Z");
		expect(writes[0].close).toBeCloseTo(223);
	});
});
