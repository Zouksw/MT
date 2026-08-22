/**
 * dceFutures source tests — front-month settlement parsing, the honest
 * flat-candle fallback for missing ("-") OHLC fields, and per-symbol
 * failure isolation across both exchange loops.
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

import { dceFuturesScraper } from "@/services/dataIngestion/sources/dceFutures";

function exchangeResponse(row: Record<string, string>) {
	return {
		ok: true,
		status: 200,
		json: async () => ({ data: [row, { settlement: "1", date: "2020-01-01" }] }),
	};
}

describe("dceFuturesScraper", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.ensureCommodity.mockImplementation(async ({ slug }: { slug: string }) => ({
			id: `c-${slug}`,
		}));
		mocks.upsertPrice.mockResolvedValue({ inserted: 1, updated: 0 });
	});

	it("writes the front-month settlement with parsed OHLC and volume", async () => {
		// DCE responds; CZCE is down — only the DCE loop should write.
		mocks.scraperFetch.mockImplementation(async (url: string) => {
			if (url.includes("dce.com.cn")) {
				return exchangeResponse({
					settlement: "3200.5",
					date: "2026-08-21",
					open: "3190",
					high: "3210",
					low: "3185",
					volume: "12345",
				});
			}
			return { ok: false, status: 502, json: async () => ({}) };
		});

		const result = await dceFuturesScraper.fetch();

		// 6 DCE products × 1 insert each; all 4 CZCE products skipped.
		expect(result).toEqual({ inserted: 6, updated: 0 });

		const meal = mocks.upsertPrice.mock.calls.find(
			(c) => c[0].commodityId === "c-soybean_meal_dce",
		)?.[0];
		expect(meal).toMatchObject({
			source: "dce",
			open: 3190,
			high: 3210,
			low: 3185,
			close: 3200.5,
			volume: 12345,
		});
		expect(mocks.ensureCommodity).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: "soybean_meal_dce",
				category: "futures",
				currency: "CNY",
				nameCn: "豆粕（大商所）",
			}),
		);
	});

	it("missing ('-') OHLC fields fall back to the settle price — no fabricated wicks", async () => {
		mocks.scraperFetch.mockResolvedValue(
			exchangeResponse({
				settlement: "2450",
				date: "2026-08-21",
				open: "-",
				high: "-",
				low: "-",
				volume: "-",
			}),
		);

		await dceFuturesScraper.fetch();

		const corn = mocks.upsertPrice.mock.calls.find((c) => c[0].commodityId === "c-corn_dce")?.[0];
		// open=high=low=close=settle: the honest flat candle (round-104 fix).
		expect(corn).toMatchObject({ open: 2450, high: 2450, low: 2450, close: 2450 });
		expect(corn?.volume).toBeNull();
	});

	it("skips unparseable settlement rows without throwing", async () => {
		mocks.scraperFetch.mockResolvedValue(
			exchangeResponse({ settlement: "N/A", date: "2026-08-21", open: "1", high: "1", low: "1" }),
		);

		const result = await dceFuturesScraper.fetch();

		expect(result).toEqual({ inserted: 0, updated: 0 });
		expect(mocks.upsertPrice).not.toHaveBeenCalled();
	});

	it("isolates a failing symbol — the rest still ingest", async () => {
		mocks.scraperFetch.mockImplementation(async (url: string) => {
			if (url.includes("/m.json")) throw new Error("connection reset");
			return exchangeResponse({
				settlement: "780",
				date: "2026-08-21",
				open: "775",
				high: "785",
				low: "770",
				volume: "10",
			});
		});

		const result = await dceFuturesScraper.fetch();

		// Only soybean meal (m) failed; the other 5 DCE + 4 CZCE wrote.
		expect(result.inserted).toBe(9);
		expect(mocks.logger.warn).toHaveBeenCalledWith(expect.stringContaining("m failed"));
	});
});
