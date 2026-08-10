/**
 * Backtesting Service — trend + MAPE aggregation tests.
 *
 * runBacktest computes per-window MAPE (7/30/90 day) from verified
 * PredictionLog rows, then computeTrend compares 7d vs 90d MAPE to label the
 * accuracy trend (improving / stable / degrading / insufficient_data). The
 * trend threshold (±1 percentage point) is the load-bearing business rule —
 * a regression there would misreport whether a model is getting better.
 *
 * Prisma.predictionLog is mocked. MAPE values come back as Prisma Decimal
 * objects (the .mape column), so each canned row supplies a toNumber() stub.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
	count: vi.fn(),
}));

vi.mock("@/lib", () => ({
	prisma: { predictionLog: { findMany: mocks.findMany, count: mocks.count } },
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runBacktest } from "@/services/backtesting";

/** A Prisma-Decimal-like object — backtesting calls l.mape?.toNumber(). */
function dec(n: number) {
	return { toNumber: () => n };
}

/** Build verified-prediction rows for a window. verifiedAt must be recent
 *  enough to fall inside the window's `since` cutoff (Date.now() - days*86400000). */
function verifiedRows(mapes: number[]) {
	const now = Date.now();
	return mapes.map((m) => ({ mape: dec(m), verifiedAt: new Date(now - 1000) }));
}

beforeEach(() => {
	vi.clearAllMocks();
	// Default: count returns 0; each test overrides findMany/count per window.
	mocks.count.mockResolvedValue(0);
});

describe("runBacktest — MAPE aggregation", () => {
	it("averages verified MAPEs per window and rounds to 2 decimals", async () => {
		// Three windows (7/30/90). Each findMany call returns rows for that window.
		// We can't control WHICH window a call serves (the loop calls in order),
		// but the mock returns the same rows each time → each window's MAPE = mean.
		mocks.findMany.mockResolvedValue(verifiedRows([10, 20, 30])); // mean = 20
		mocks.count.mockResolvedValue(3);

		const result = await runBacktest("model-1");
		expect(result.windows).toHaveLength(3);
		// Every window got the same 3 rows → MAPE = 20.00 for each.
		for (const w of result.windows) {
			expect(w.mape).toBe(20);
			expect(w.verifiedCount).toBe(3);
			expect(w.predictionCount).toBe(3);
		}
	});

	it("reports null MAPE when a window has zero verified predictions", async () => {
		mocks.findMany.mockResolvedValue([]); // no verified rows in any window
		const result = await runBacktest("model-1");
		for (const w of result.windows) {
			expect(w.mape).toBeNull();
			expect(w.verifiedCount).toBe(0);
		}
	});

	it("handles rows where mape is null (toNumber is skipped via ?.)", async () => {
		// A null mape contributes 0 to the sum (the `?.toNumber() ?? 0` fallback).
		mocks.findMany.mockResolvedValue([
			{ mape: dec(10), verifiedAt: new Date() },
			{ mape: null, verifiedAt: new Date() },
			{ mape: dec(20), verifiedAt: new Date() },
		]);
		const result = await runBacktest("model-1");
		// sum = 10 + 0 + 20 = 30, /3 rows = 10.00
		expect(result.windows[0].mape).toBe(10);
	});
});

describe("runBacktest — trend classification (7d vs 90d MAPE)", () => {
	it("labels 'improving' when recent (7d) MAPE is >1pp lower than long-term (90d)", async () => {
		// Make findMany return different rows per call: 7d window first (low MAPE),
		// 30d second, 90d third (high MAPE). The loop order is windows[7,30,90].
		mocks.findMany
			.mockResolvedValueOnce(verifiedRows([5])) // 7d: MAPE 5
			.mockResolvedValueOnce(verifiedRows([8])) // 30d: MAPE 8
			.mockResolvedValueOnce(verifiedRows([10])); // 90d: MAPE 10
		mocks.count.mockResolvedValue(1);

		const result = await runBacktest("model-1");
		expect(result.trend).toBe("improving");
		expect(result.trendDescription).toContain("improved by");
	});

	it("labels 'degrading' when recent (7d) MAPE is >1pp higher than long-term (90d)", async () => {
		mocks.findMany
			.mockResolvedValueOnce(verifiedRows([12])) // 7d: MAPE 12
			.mockResolvedValueOnce(verifiedRows([9])) // 30d
			.mockResolvedValueOnce(verifiedRows([7])); // 90d: MAPE 7 → 12-7 = +5 > 1
		mocks.count.mockResolvedValue(1);

		const result = await runBacktest("model-1");
		expect(result.trend).toBe("degrading");
		expect(result.trendDescription).toContain("worsened by");
	});

	it("labels 'stable' when 7d vs 90d MAPE differs by ≤1pp", async () => {
		mocks.findMany
			.mockResolvedValueOnce(verifiedRows([8.4])) // 7d
			.mockResolvedValueOnce(verifiedRows([8.5])) // 30d
			.mockResolvedValueOnce(verifiedRows([8.6])); // 90d → delta 8.4-8.6 = -0.2, within ±1
		mocks.count.mockResolvedValue(1);

		const result = await runBacktest("model-1");
		expect(result.trend).toBe("stable");
		expect(result.trendDescription).toContain("stable within 1pp");
	});

	it("labels 'insufficient_data' when either 7d or 90d window has no MAPE", async () => {
		// 7d empty (null MAPE) → can't compare → insufficient_data.
		mocks.findMany
			.mockResolvedValueOnce([]) // 7d: no verified rows → null MAPE
			.mockResolvedValueOnce(verifiedRows([10])) // 30d
			.mockResolvedValueOnce(verifiedRows([10])); // 90d
		const result = await runBacktest("model-1");
		expect(result.trend).toBe("insufficient_data");
	});
});

describe("runBacktest — result shape", () => {
	it("passes modelId + commodityId through and defaults commodityId to null", async () => {
		mocks.findMany.mockResolvedValue([]);
		const without = await runBacktest("model-1");
		expect(without.modelId).toBe("model-1");
		expect(without.commodityId).toBeNull();

		const withCommodity = await runBacktest("model-1", "comm-9");
		expect(withCommodity.commodityId).toBe("comm-9");
	});

	it("filters by commodityId in both the verified query and the count query when provided", async () => {
		mocks.findMany.mockResolvedValue([]);
		mocks.count.mockResolvedValue(0);
		await runBacktest("model-1", "comm-9");
		// Every findMany + count call must carry the commodityId filter.
		for (const call of mocks.findMany.mock.calls) {
			expect(call[0].where.commodityId).toBe("comm-9");
		}
		for (const call of mocks.count.mock.calls) {
			expect(call[0].where.commodityId).toBe("comm-9");
		}
	});

	it("includes status:'verified' in the count denominator (round-86)", async () => {
		// REGRESSION: predictionCount (denominator) previously had no status
		// filter, so it counted completed/unverifiable/pending rows — predictions
		// that can NEVER be verified in the window. This structurally depressed
		// predictionCount/verifiedCount toward 0 for short windows. The fix adds
		// status:'verified' so numerator and denominator share the same population.
		mocks.findMany.mockResolvedValue([]);
		mocks.count.mockResolvedValue(0);
		await runBacktest("model-1");
		// Every count call (one per window) must filter by status:verified.
		for (const call of mocks.count.mock.calls) {
			expect(call[0].where.status).toBe("verified");
		}
	});
});
