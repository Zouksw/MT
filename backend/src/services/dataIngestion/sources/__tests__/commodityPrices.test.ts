/**
 * commodityPrices source tests — the hourly FX source that feeds the
 * usd_cny / aud_usd / brl_usd series (one of the 3 currently-producing
 * sources, per ingestion_logs 2026-08-22).
 *
 * scraperFetch + upsert helpers are mocked: what's under test is THIS
 * source's own logic — pair derivation, USD-per-unit inversion, the flat
 * doji honesty rule, and failure containment.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	scraperFetch: vi.fn(),
	upsertFactor: vi.fn(),
	upsertPrice: vi.fn(),
	commodityFindUnique: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib", () => ({
	logger: mocks.logger,
	prisma: { commodity: { findUnique: mocks.commodityFindUnique } },
}));
vi.mock("@/services/dataIngestion/helpers", () => ({
	upsertFactor: mocks.upsertFactor,
	upsertPrice: mocks.upsertPrice,
}));
vi.mock("@/services/dataIngestion/http", () => ({ scraperFetch: mocks.scraperFetch }));

import { commodityPriceScraper } from "@/services/dataIngestion/sources/commodityPrices";

function erApi(rates: Record<string, number>) {
	return { ok: true, status: 200, json: async () => ({ rates }) };
}

describe("commodityPriceScraper", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.upsertFactor.mockResolvedValue({ inserted: 1, updated: 0 });
		mocks.upsertPrice.mockResolvedValue({ inserted: 1, updated: 0 });
	});

	it("derives the three pairs, inverts USD-per-unit, and writes flat doji candles", async () => {
		mocks.scraperFetch.mockResolvedValue(erApi({ CNY: 7.2, AUD: 1.5, BRL: 5 }));
		// Commodity rows exist for all three slugs → factor + price per pair.
		mocks.commodityFindUnique.mockImplementation(
			async ({ where }: { where: { slug: string } }) => ({ id: `c-${where.slug}` }),
		);

		const result = await commodityPriceScraper.fetch();

		expect(result).toEqual({ inserted: 6, updated: 0 }); // 3 factors + 3 prices

		// er-api quotes units-per-USD; the platform stores USD-per-unit for
		// aud_usd / brl_usd — the inversion R2 spent four rounds fixing.
		const audFactor = mocks.upsertFactor.mock.calls.find((c) => c[0].region === "AUD/USD")?.[0];
		expect(audFactor).toMatchObject({
			type: "exchange_rate",
			region: "AUD/USD",
			value: 1 / 1.5,
			unit: "AUD/USD",
			source: "exchange_rate_api",
		});
		const brlFactor = mocks.upsertFactor.mock.calls.find((c) => c[0].region === "BRL/USD")?.[0];
		expect(brlFactor?.value).toBeCloseTo(0.2, 10);

		const audPrice = mocks.upsertPrice.mock.calls.find(
			(c) => c[0].commodityId === "c-aud_usd",
		)?.[0];
		// A single daily rate has no intraday range — open=high=low=close
		// (flat doji), never a fabricated spread.
		expect(audPrice).toMatchObject({
			open: 1 / 1.5,
			high: 1 / 1.5,
			low: 1 / 1.5,
			close: 1 / 1.5,
			interval: "daily",
			source: "exchange_rate_api",
		});
	});

	it("skips pairs without a rate and still writes the others", async () => {
		mocks.scraperFetch.mockResolvedValue(erApi({ CNY: 7.2 })); // no AUD/BRL keys
		mocks.commodityFindUnique.mockResolvedValue({ id: "c-usd_cny" });

		const result = await commodityPriceScraper.fetch();

		expect(result).toEqual({ inserted: 2, updated: 0 });
		expect(mocks.upsertFactor).toHaveBeenCalledTimes(1);
		expect(mocks.upsertPrice).toHaveBeenCalledTimes(1);
	});

	it("returns zeros without throwing when the API is down", async () => {
		mocks.scraperFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

		const result = await commodityPriceScraper.fetch();

		expect(result).toEqual({ inserted: 0, updated: 0 });
		expect(mocks.upsertFactor).not.toHaveBeenCalled();
		expect(mocks.upsertPrice).not.toHaveBeenCalled();
		expect(mocks.logger.error).toHaveBeenCalled();
	});

	it("exposes the scraper under the scheduled source name", () => {
		expect(commodityPriceScraper.name).toBe("commodity_prices");
	});
});
