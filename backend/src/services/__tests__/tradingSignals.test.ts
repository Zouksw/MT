/**
 * Trading Signals Tests
 *
 * The signal engine decides BUY/SELL/HOLD from multi-model predictions. These
 * tests pin the classification thresholds and consensus logic that Round 12
 * (model-list pruning) and Round 14 (STL fix) touched — regressions there
 * silently degrade signal quality, so each rule gets an explicit test.
 *
 * predictionCache is mocked so generateSignal is exercised as pure logic over
 * canned predictions — no Redis, no inference service, no DB.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock predictionCache before importing the module under test.
vi.mock("@/services/predictionCache", () => ({
	getCachedPrediction: vi.fn(),
	runAndCachePrediction: vi.fn(),
}));

// Mock logger so failed-model branches don't spam test output.
vi.mock("@/lib", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getCachedPrediction, runAndCachePrediction } from "@/services/predictionCache";
import { generateSignal, getAllModels } from "@/services/tradingSignals";

const mockedGetCached = vi.mocked(getCachedPrediction);
const mockedRunAndCache = vi.mocked(runAndCachePrediction);

/**
 * Build a cached prediction shape matching CachedPrediction from predictionCache.
 * Tight bounds (±1) → high confidence; wide bounds → low confidence.
 */
function makePrediction(currentPrice: number, predictedPrice: number, spread = 2) {
	return {
		timestamps: [Date.now()],
		values: [currentPrice, (currentPrice + predictedPrice) / 2, predictedPrice],
		lowerBound: [currentPrice - spread, predictedPrice - spread, predictedPrice - spread],
		upperBound: [currentPrice + spread, predictedPrice + spread, predictedPrice + spread],
		algorithm: "test",
		cachedAt: Date.now(),
		commodityId: "c1",
		horizon: 10,
	};
}

describe("Trading Signals", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedGetCached.mockResolvedValue(null);
		mockedRunAndCache.mockResolvedValue(null as never);
	});

	describe("getAllModels", () => {
		it("returns the 5 pretrained statistical models (no timer_xl/sundial)", () => {
			const models = getAllModels();
			// Round 12 removed timer_xl/sundial (self-training). This guards
			// against accidental re-addition.
			expect(models).not.toContain("timer_xl");
			expect(models).not.toContain("sundial");
			expect(models).toEqual(
				expect.arrayContaining([
					"arima",
					"holtwinters",
					"exponential_smoothing",
					"naive_forecaster",
					"stl_forecaster",
				]),
			);
			expect(models).toHaveLength(5);
		});

		it("returns a defensive copy (mutating it does not change future calls)", () => {
			const a = getAllModels();
			a.push("injected");
			const b = getAllModels();
			expect(b).not.toContain("injected");
		});
	});

	describe("generateSignal — classification thresholds", () => {
		it("classifies BUY when predicted increase > 1% AND confidence > 70%", async () => {
			// 100 → 101.5 = +1.5% change — just above the 1% BUY bar. Chosen at
			// the boundary so the test fails if someone nudges the threshold up
			// (verified via mutation: flipping >1 to >2 makes this FAIL).
			mockedGetCached.mockResolvedValue(makePrediction(100, 101.5, 2) as never);

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(signal.individualSignals[0].type).toBe("BUY");
			expect(signal.individualSignals[0].status).toBe("available");
			expect(signal.availableModels).toBe(1);
		});

		it("classifies SELL when predicted decrease > 1% AND confidence > 70%", async () => {
			// 100 → 88 = -12% change
			mockedGetCached.mockResolvedValue(makePrediction(100, 88, 2) as never);

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(signal.individualSignals[0].type).toBe("SELL");
		});

		it("classifies HOLD when predicted change < 1% (below threshold)", async () => {
			// 100 → 100.5 = +0.5% change — under the 1% BUY bar
			mockedGetCached.mockResolvedValue(makePrediction(100, 100.5, 2) as never);

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(signal.individualSignals[0].type).toBe("HOLD");
		});

		it("classifies HOLD when confidence <= 70% even with large predicted change", async () => {
			// 100 → 120 = +20%, but wide bounds (spread=40) → low confidence.
			// spread/price = 40/100 = 0.4 → confidence = 1 - 0.4 = 0.6 < 0.7
			mockedGetCached.mockResolvedValue(makePrediction(100, 120, 40) as never);

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(signal.individualSignals[0].type).toBe("HOLD");
			expect(signal.individualSignals[0].confidence).toBeLessThanOrEqual(0.7);
		});
	});

	describe("generateSignal — fault tolerance (Promise.allSettled)", () => {
		it("marks a failed model 'unavailable' without blocking the others", async () => {
			// arima throws inside runAndCachePrediction; holtwinters returns a BUY
			mockedGetCached.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") return null;
				return makePrediction(100, 112, 2) as never;
			});
			mockedRunAndCache.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") throw new Error("inference down");
				return makePrediction(100, 112, 2) as never;
			});

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters"],
			});

			const arima = signal.individualSignals.find((s) => s.modelId === "arima");
			const holt = signal.individualSignals.find((s) => s.modelId === "holtwinters");
			expect(arima?.status).toBe("unavailable");
			expect(arima?.error).toBe("inference down");
			expect(holt?.status).toBe("available");
			expect(signal.availableModels).toBe(1);
		});

		it("returns a HOLD consensus with zero confidence when ALL models fail", async () => {
			mockedGetCached.mockResolvedValue(null);
			mockedRunAndCache.mockRejectedValue(new Error("all down") as never);

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters"],
			});

			expect(signal.type).toBe("HOLD");
			expect(signal.confidence).toBe(0);
			expect(signal.availableModels).toBe(0);
			expect(signal.distribution).toEqual({ buy: 0, sell: 0, hold: 0 });
			expect(signal.individualSignals.every((s) => s.status === "unavailable")).toBe(true);
		});

		it("treats an empty prediction result (no values) as unavailable", async () => {
			mockedGetCached.mockResolvedValue({
				...makePrediction(100, 100),
				values: [],
			} as never);

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(signal.individualSignals[0].status).toBe("unavailable");
			expect(signal.individualSignals[0].error).toBe("Empty prediction result");
		});
	});

	describe("generateSignal — consensus", () => {
		it("returns BUY consensus when a majority of available models vote BUY", async () => {
			// 2 of 3 BUY (>1% up, high confidence), 1 HOLD
			mockedGetCached.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") return makePrediction(100, 115, 2) as never; // BUY
				if (modelId === "holtwinters") return makePrediction(100, 114, 2) as never; // BUY
				return makePrediction(100, 100.3, 2) as never; // HOLD (<1%)
			});

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters", "naive_forecaster"],
			});

			expect(signal.type).toBe("BUY");
			expect(signal.modelsAgree).toBe(2);
			expect(signal.distribution.buy).toBe(2);
			expect(signal.distribution.hold).toBe(1);
		});

		it("falls back to HOLD consensus when no single direction reaches majority", async () => {
			// 1 BUY, 1 SELL, 1 HOLD — no majority for either direction
			mockedGetCached.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") return makePrediction(100, 115, 2) as never; // BUY
				if (modelId === "holtwinters") return makePrediction(100, 85, 2) as never; // SELL
				return makePrediction(100, 100.3, 2) as never; // HOLD
			});

			const signal = await generateSignal({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters", "naive_forecaster"],
			});

			expect(signal.type).toBe("HOLD");
			expect(signal.distribution).toEqual({ buy: 1, sell: 1, hold: 1 });
		});
	});

	describe("generateSignal — input validation", () => {
		it("throws when currentPrice is 0 (avoids divide-by-zero in change %)", async () => {
			await expect(
				generateSignal({ commodityId: "c1", horizon: 10, currentPrice: 0 }),
			).rejects.toThrow(/current price/i);
		});

		it("throws when currentPrice is negative", async () => {
			await expect(
				generateSignal({ commodityId: "c1", horizon: 10, currentPrice: -50 }),
			).rejects.toThrow(/current price/i);
		});
	});
});
