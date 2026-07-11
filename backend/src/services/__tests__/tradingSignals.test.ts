/**
 * Price Forecast Tests
 *
 * The forecast engine produces a *price forecast* (direction up/down/flat +
 * predicted price + range) from multi-model predictions. These tests pin the
 * direction thresholds, consensus logic, and the price-forecast fields
 * (predictedPrice / range / bestModel) that the semantic refactor introduced.
 *
 * Old BUY/SELL/HOLD trade-signal tests were replaced when the product was
 * repositioned to an information platform. predictionCache is mocked so
 * generateForecast is exercised as pure logic over canned predictions — no
 * Redis, no inference service, no DB.
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
import { generateForecast, getAllModels } from "@/services/tradingSignals";

const mockedGetCached = vi.mocked(getCachedPrediction);
const mockedRunAndCache = vi.mocked(runAndCachePrediction);

/**
 * Build a cached prediction shape matching CachedPrediction from predictionCache.
 * Tight bounds (spread small) → high confidence; wide bounds → low confidence.
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

describe("Price Forecast Engine", () => {
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

	describe("generateForecast — direction classification", () => {
		it("classifies direction 'up' when predicted increase > 1%", async () => {
			// 100 → 101.5 = +1.5% — just above the 1% up band. Boundary chosen
			// so the test fails if the band widens (verified via mutation:
			// changing the band to >2 makes this FAIL).
			mockedGetCached.mockResolvedValue(makePrediction(100, 101.5, 2) as never);

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(forecast.individualForecasts[0].direction).toBe("up");
			expect(forecast.individualForecasts[0].status).toBe("available");
			expect(forecast.availableModels).toBe(1);
		});

		it("classifies direction 'down' when predicted decrease > 1%", async () => {
			// 100 → 88 = -12%
			mockedGetCached.mockResolvedValue(makePrediction(100, 88, 2) as never);

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(forecast.individualForecasts[0].direction).toBe("down");
		});

		it("classifies direction 'flat' when predicted change < 1%", async () => {
			// 100 → 100.5 = +0.5% — inside the ±1% flat band
			mockedGetCached.mockResolvedValue(makePrediction(100, 100.5, 2) as never);

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(forecast.individualForecasts[0].direction).toBe("flat");
		});
	});

	describe("generateForecast — price forecast fields", () => {
		it("exposes predictedPrice, currentPrice, range, and horizon", async () => {
			mockedGetCached.mockResolvedValue(makePrediction(100, 105, 2) as never);

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(forecast.currentPrice).toBe(100);
			expect(forecast.horizon).toBe(10);
			// Consensus predicted price = median of available models' end values
			expect(forecast.predictedPrice).toBe(105);
			// Range spans [min, max] across models (single model → both equal)
			expect(forecast.range.lower).toBe(105);
			expect(forecast.range.upper).toBe(105);
		});

		it("picks the highest-confidence model as bestModel", async () => {
			// arima: spread=2 → confidence high; holtwinters: spread=40 → low
			mockedGetCached.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") return makePrediction(100, 105, 2) as never;
				return makePrediction(100, 106, 40) as never;
			});

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters"],
			});

			expect(forecast.bestModel).toBe("arima");
		});
	});

	describe("generateForecast — fault tolerance (Promise.allSettled)", () => {
		it("marks a failed model 'unavailable' without blocking the others", async () => {
			// arima throws inside runAndCachePrediction; holtwinters returns up
			mockedGetCached.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") return null;
				return makePrediction(100, 112, 2) as never;
			});
			mockedRunAndCache.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") throw new Error("inference down");
				return makePrediction(100, 112, 2) as never;
			});

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters"],
			});

			const arima = forecast.individualForecasts.find((f) => f.modelId === "arima");
			const holt = forecast.individualForecasts.find((f) => f.modelId === "holtwinters");
			expect(arima?.status).toBe("unavailable");
			expect(arima?.error).toBe("inference down");
			expect(holt?.status).toBe("available");
			expect(forecast.availableModels).toBe(1);
		});

		it("returns a flat consensus with zero confidence when ALL models fail", async () => {
			mockedGetCached.mockResolvedValue(null);
			mockedRunAndCache.mockRejectedValue(new Error("all down") as never);

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters"],
			});

			expect(forecast.direction).toBe("flat");
			expect(forecast.confidence).toBe(0);
			expect(forecast.availableModels).toBe(0);
			expect(forecast.distribution).toEqual({ up: 0, down: 0, flat: 0 });
			expect(forecast.individualForecasts.every((f) => f.status === "unavailable")).toBe(true);
		});

		it("treats an empty prediction result (no values) as unavailable", async () => {
			mockedGetCached.mockResolvedValue({
				...makePrediction(100, 100),
				values: [],
			} as never);

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima"],
			});

			expect(forecast.individualForecasts[0].status).toBe("unavailable");
			expect(forecast.individualForecasts[0].error).toBe("Empty prediction result");
		});
	});

	describe("generateForecast — consensus", () => {
		it("returns 'up' consensus when a plurality of models point up", async () => {
			// 2 of 3 up (>1%), 1 flat
			mockedGetCached.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") return makePrediction(100, 115, 2) as never; // up
				if (modelId === "holtwinters") return makePrediction(100, 114, 2) as never; // up
				return makePrediction(100, 100.3, 2) as never; // flat (<1%)
			});

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters", "naive_forecaster"],
			});

			expect(forecast.direction).toBe("up");
			expect(forecast.modelsAgree).toBe(2);
			expect(forecast.distribution.up).toBe(2);
			expect(forecast.distribution.flat).toBe(1);
		});

		it("falls back to 'flat' consensus when no direction is a plurality winner", async () => {
			// 1 up, 1 down, 1 flat — no direction beats the others
			mockedGetCached.mockImplementation(async (_c, modelId) => {
				if (modelId === "arima") return makePrediction(100, 115, 2) as never; // up
				if (modelId === "holtwinters") return makePrediction(100, 85, 2) as never; // down
				return makePrediction(100, 100.3, 2) as never; // flat
			});

			const forecast = await generateForecast({
				commodityId: "c1",
				horizon: 10,
				currentPrice: 100,
				models: ["arima", "holtwinters", "naive_forecaster"],
			});

			expect(forecast.direction).toBe("flat");
			expect(forecast.distribution).toEqual({ up: 1, down: 1, flat: 1 });
		});
	});

	describe("generateForecast — input validation", () => {
		it("throws when currentPrice is 0 (avoids divide-by-zero in change %)", async () => {
			await expect(
				generateForecast({ commodityId: "c1", horizon: 10, currentPrice: 0 }),
			).rejects.toThrow(/current price/i);
		});

		it("throws when currentPrice is negative", async () => {
			await expect(
				generateForecast({ commodityId: "c1", horizon: 10, currentPrice: -50 }),
			).rejects.toThrow(/current price/i);
		});
	});
});
