/**
 * Backtesting Service — trend + MAPE aggregation tests.
 *
 * runBacktest computes per-window MAPE (7/30/90 day) via SQL-side aggregate
 * (_avg over verified rows), counts the window denominator (predictions MADE
 * in the window, any terminal/active status — round-104), then computeTrend
 * compares 7d vs 90d MAPE to label the accuracy trend (improving / stable /
 * degrading / insufficient_data). The trend threshold (±1 percentage point)
 * is the load-bearing business rule — a regression there would misreport
 * whether a model is getting better.
 *
 * Prisma.predictionLog is mocked. _avg.mape comes back as a Prisma Decimal,
 * so each canned aggregate supplies a toNumber() stub.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	aggregate: vi.fn(),
	count: vi.fn(),
}));

vi.mock("@/lib", () => ({
	prisma: { predictionLog: { aggregate: mocks.aggregate, count: mocks.count } },
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runBacktest } from "@/services/backtesting";

/** A Prisma-Decimal-like object — backtesting calls agg._avg.mape.toNumber(). */
function dec(n: number) {
	return { toNumber: () => n };
}

/** Canned aggregate result for one window: mean MAPE `m` over `n` rows. */
function agg(m: number | null, n: number) {
	return { _avg: { mape: m == null ? null : dec(m) }, _count: { _all: n } };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.count.mockResolvedValue(0);
	mocks.aggregate.mockResolvedValue(agg(null, 0));
});

describe("runBacktest — MAPE aggregation (SQL-side)", () => {
	it("reports each window's SQL average MAPE and verified count", async () => {
		// Three windows (7/30/90) — the loop calls aggregate in that order.
		mocks.aggregate
			.mockResolvedValueOnce(agg(20, 3))
			.mockResolvedValueOnce(agg(20, 3))
			.mockResolvedValueOnce(agg(20, 3));
		mocks.count.mockResolvedValue(3);

		const result = await runBacktest("model-1");
		expect(result.windows).toHaveLength(3);
		for (const w of result.windows) {
			expect(w.mape).toBe(20);
			expect(w.verifiedCount).toBe(3);
			expect(w.predictionCount).toBe(3);
		}
	});

	it("reports null MAPE when a window has zero verified predictions", async () => {
		const result = await runBacktest("model-1");
		for (const w of result.windows) {
			expect(w.mape).toBeNull();
			expect(w.verifiedCount).toBe(0);
		}
	});
});

describe("runBacktest — trend classification (7d vs 90d MAPE)", () => {
	it("labels 'improving' when recent (7d) MAPE is >1pp lower than long-term (90d)", async () => {
		mocks.aggregate
			.mockResolvedValueOnce(agg(5, 1)) // 7d: MAPE 5
			.mockResolvedValueOnce(agg(8, 1)) // 30d
			.mockResolvedValueOnce(agg(10, 1)); // 90d: MAPE 10
		mocks.count.mockResolvedValue(1);

		const result = await runBacktest("model-1");
		expect(result.trend).toBe("improving");
		expect(result.trendDescription).toContain("improved by");
	});

	it("labels 'degrading' when recent (7d) MAPE is >1pp higher than long-term (90d)", async () => {
		mocks.aggregate
			.mockResolvedValueOnce(agg(12, 1)) // 7d: MAPE 12
			.mockResolvedValueOnce(agg(9, 1)) // 30d
			.mockResolvedValueOnce(agg(7, 1)); // 90d: MAPE 7 → 12-7 = +5 > 1
		mocks.count.mockResolvedValue(1);

		const result = await runBacktest("model-1");
		expect(result.trend).toBe("degrading");
		expect(result.trendDescription).toContain("worsened by");
	});

	it("labels 'stable' when 7d vs 90d MAPE differs by ≤1pp", async () => {
		mocks.aggregate
			.mockResolvedValueOnce(agg(8.4, 1)) // 7d
			.mockResolvedValueOnce(agg(8.5, 1)) // 30d
			.mockResolvedValueOnce(agg(8.6, 1)); // 90d → delta -0.2, within ±1
		mocks.count.mockResolvedValue(1);

		const result = await runBacktest("model-1");
		expect(result.trend).toBe("stable");
		expect(result.trendDescription).toContain("stable within 1pp");
	});

	it("labels 'insufficient_data' when either 7d or 90d window has no MAPE", async () => {
		mocks.aggregate
			.mockResolvedValueOnce(agg(null, 0)) // 7d: no verified rows → null
			.mockResolvedValueOnce(agg(10, 1)) // 30d
			.mockResolvedValueOnce(agg(10, 1)); // 90d
		const result = await runBacktest("model-1");
		expect(result.trend).toBe("insufficient_data");
	});

	it("treats mape 0 (perfect model) as data, not insufficient (round-106)", async () => {
		// `!recent?.mape` used to send a legitimately perfect 0% MAPE down the
		// insufficient_data path. 0 must be usable by the trend math.
		mocks.aggregate
			.mockResolvedValueOnce(agg(0, 3)) // 7d: perfect
			.mockResolvedValueOnce(agg(2, 5)) // 30d
			.mockResolvedValueOnce(agg(2, 9)); // 90d → delta -2, improving
		mocks.count.mockResolvedValue(9);

		const result = await runBacktest("model-1");
		expect(result.trend).not.toBe("insufficient_data");
	});
});

describe("runBacktest — result shape & query contracts", () => {
	it("passes modelId + commodityId through and defaults commodityId to null", async () => {
		const without = await runBacktest("model-1");
		expect(without.modelId).toBe("model-1");
		expect(without.commodityId).toBeNull();

		const withCommodity = await runBacktest("model-1", "comm-9");
		expect(withCommodity.commodityId).toBe("comm-9");
	});

	it("filters by commodityId in both the aggregate and the count when provided", async () => {
		await runBacktest("model-1", "comm-9");
		for (const call of mocks.aggregate.mock.calls) {
			expect(call[0].where.commodityId).toBe("comm-9");
		}
		for (const call of mocks.count.mock.calls) {
			expect(call[0].where.commodityId).toBe("comm-9");
		}
	});

	it("verified average filters status:'verified' + verifiedAt window (numerator)", async () => {
		await runBacktest("model-1");
		for (const call of mocks.aggregate.mock.calls) {
			expect(call[0].where.status).toBe("verified");
			expect(call[0].where.verifiedAt).toBeDefined();
		}
	});

	it("denominator counts predictions MADE in the window — predictedAt + any active status (round-104)", async () => {
		// REGRESSION (round-104): the denominator previously re-ran the
		// numerator's own query (status:'verified' + verifiedAt), pinning the
		// verification ratio at 100% by construction. It must now count rows
		// by predictedAt across completed/verified/stale/unverifiable —
		// immature predictions legitimately lower the ratio.
		await runBacktest("model-1");
		expect(mocks.count.mock.calls.length).toBeGreaterThan(0);
		for (const call of mocks.count.mock.calls) {
			expect(call[0].where.predictedAt).toBeDefined();
			expect(Array.isArray(call[0].where.status.in)).toBe(true);
			expect(call[0].where.status.in).toContain("completed");
			expect(call[0].where.status.in).toContain("unverifiable");
		}
	});
});
