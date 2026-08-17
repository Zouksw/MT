/**
 * generateBaselinePredictions — baseline revival (round-110) unit tests.
 *
 * Pins the contract of the daily baseline batch:
 *  - runs ONLY the BASELINE_MODELS on fresh commodities (never chronos),
 *  - honors the ≥2-fresh-prices gate (frozen commodities skipped),
 *  - a per-model inference failure must not abort the batch.
 *
 * Vitest (backend unit-test convention). Redis, logger, prisma, the
 * inference client, the data-fetcher, and mapeTracking are mocked — no
 * real I/O. Mirrors predictionCache.runAndCache.test.ts's hoisted-mock
 * pattern (logPrediction is a dynamic import inside runAndCachePrediction;
 * vi.mock intercepts it the same way).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	redis: { get: vi.fn(), setEx: vi.fn(), del: vi.fn() },
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	predict: vi.fn(),
	getValues: vi.fn(),
	logPrediction: vi.fn(),
	commodityFindMany: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
	getRedisClient: vi.fn(async () => mocks.redis),
}));

vi.mock("@/lib", () => ({
	logger: mocks.logger,
	prisma: { commodity: { findMany: (...args: unknown[]) => mocks.commodityFindMany(...args) } },
}));

vi.mock("@/services/inference/client", () => ({
	predict: (...args: unknown[]) => mocks.predict(...args),
}));
vi.mock("@/services/inference/data-fetcher", () => ({
	getCommodityPriceValues: (...args: unknown[]) => mocks.getValues(...args),
}));

vi.mock("@/services/mapeTracking", () => ({
	logPrediction: (...args: unknown[]) => mocks.logPrediction(...args),
}));

import { generateBaselinePredictions } from "@/services/predictionCache";

const BASELINE_IDS = ["naive_forecaster", "arima", "holtwinters", "exponential_smoothing"];

function setupHappyPath() {
	mocks.getValues.mockResolvedValue({ values: [100, 101, 102], timestamps: [1, 2, 3] });
	mocks.predict.mockResolvedValue({
		timestamps: [4, 5, 6],
		values: [103, 104, 105],
		lower_bound: [100, 101, 102],
		upper_bound: [106, 107, 108],
		model_id: "arima",
	});
	mocks.redis.setEx.mockResolvedValue("OK");
	mocks.logPrediction.mockResolvedValue("log-id");
}

beforeEach(() => {
	vi.clearAllMocks();
	setupHappyPath();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("generateBaselinePredictions — baseline revival (round-110)", () => {
	it("runs exactly the baseline models on fresh commodities, never chronos", async () => {
		mocks.commodityFindMany.mockResolvedValue([
			{ id: "fresh-1", _count: { prices: 5 } },
			{ id: "fresh-2", _count: { prices: 2 } },
		]);

		const n = await generateBaselinePredictions();

		// 2 commodities × 4 baseline models
		expect(n).toBe(8);
		const loggedModels = mocks.logPrediction.mock.calls.map((c) => c[0].modelId);
		expect(loggedModels).toHaveLength(8);
		for (const modelId of loggedModels) {
			expect(BASELINE_IDS).toContain(modelId);
		}
		// The primary ensemble must stay out of the baseline batch.
		expect(loggedModels.some((m) => m.startsWith("chronos"))).toBe(false);
	});

	it("skips commodities below the ≥2 fresh-prices gate", async () => {
		mocks.commodityFindMany.mockResolvedValue([
			{ id: "fresh-1", _count: { prices: 3 } },
			{ id: "frozen-1", _count: { prices: 1 } },
			{ id: "frozen-2", _count: { prices: 0 } },
		]);

		const n = await generateBaselinePredictions();

		expect(n).toBe(4);
		const loggedCommodities = new Set(mocks.logPrediction.mock.calls.map((c) => c[0].commodityId));
		expect(loggedCommodities).toEqual(new Set(["fresh-1"]));
	});

	it("a per-model inference failure must not abort the batch", async () => {
		mocks.commodityFindMany.mockResolvedValue([{ id: "fresh-1", _count: { prices: 3 } }]);
		// First model's inference fails; the other three must still run.
		mocks.predict.mockRejectedValueOnce(new Error("inference down")).mockResolvedValue({
			timestamps: [4, 5, 6],
			values: [103, 104, 105],
			model_id: "arima",
		});

		const n = await generateBaselinePredictions();

		expect(n).toBe(3);
		expect(mocks.logger.error).toHaveBeenCalled();
	});
});
