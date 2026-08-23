/**
 * Quality-weighted consensus residuals (round-122 batch 3).
 *
 * The elimination bar (round-110) only removed a model's WEIGHT — three
 * places still let eliminated models shape the published consensus:
 *   1. range [min,max] across ALL available models (an eliminated model's
 *      extreme price stretched the displayed consensus range);
 *   2. predictedChange = UNWEIGHTED mean (eliminated models dragged the
 *      headline % change);
 *   3. bestModel = narrowest interval, regardless of verified quality.
 *
 * These tests mock resolveModelWeights (the real one needs DB MAPE data) and
 * pin the three fixes. weightedMedian / weightedDirectionVote stay real —
 * they are the primitives the fixes compose with.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/predictionCache", () => ({
	getCachedPrediction: vi.fn(),
	runAndCachePrediction: vi.fn(),
}));

vi.mock("@/lib", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Real weightedMedian/weightedDirectionVote, mocked weight resolver.
vi.mock("@/services/modelQuality", async (importOriginal) => {
	const orig = await importOriginal<typeof import("@/services/modelQuality")>();
	return { ...orig, resolveModelWeights: vi.fn() };
});

import { resolveModelWeights } from "@/services/modelQuality";
import { getCachedPrediction } from "@/services/predictionCache";
import { generateForecast } from "@/services/tradingSignals";

const mockedGetCached = vi.mocked(getCachedPrediction);
const mockedWeights = vi.mocked(resolveModelWeights);

function prediction(current: number, predicted: number, spread = 2) {
	return {
		timestamps: [Date.now()],
		values: [current, (current + predicted) / 2, predicted],
		lowerBound: [current - spread, predicted - spread, predicted - spread],
		upperBound: [current + spread, predicted + spread, predicted + spread],
		algorithm: "test",
		cachedAt: Date.now(),
		commodityId: "c1",
		horizon: 10,
	};
}

/** Current price 100; per-model end-of-horizon predictions. */
function setupCache(perModel: Record<string, number>, current = 100) {
	mockedGetCached.mockImplementation(async (_commodityId, modelId) =>
		prediction(current, perModel[modelId]),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	// Default: equal weights (the no-quality-data fallback).
	mockedWeights.mockResolvedValue(new Map());
});

describe("quality-weighted consensus residuals (batch 3)", () => {
	it("an eliminated model's extreme price does NOT stretch the consensus range", async () => {
		// naive (weight .5) + arima (.5) predict ~100-104; chronos_base is
		// ELIMINATED (weight 0) with an absurd 500 — the published range must
		// come from the voting models only.
		setupCache({ naive_forecaster: 100, arima: 104, chronos_base: 500 });
		mockedWeights.mockResolvedValue(
			new Map([
				["naive_forecaster", 0.5],
				["arima", 0.5],
				["chronos_base", 0],
			]),
		);

		const forecast = await generateForecast({
			commodityId: "c1",
			horizon: 10,
			currentPrice: 100,
			models: ["naive_forecaster", "arima", "chronos_base"],
		});

		expect(forecast.range.upper).toBeLessThanOrEqual(104);
		expect(forecast.range.upper).toBeGreaterThanOrEqual(100);
		// The eliminated model is still reported per-model — transparency, not
		// erasure.
		expect(forecast.individualForecasts.find((f) => f.modelId === "chronos_base")?.status).toBe(
			"available",
		);
	});

	it("predictedChange is the quality-weighted mean, not a headcount mean", async () => {
		setupCache({ naive_forecaster: 110, arima: 102, chronos_base: 100 });
		// predictedChange: naive +10%, arima +2%, chronos 0%.
		// Weights .75/.25/0 → weighted mean = 10%*.75 + 2%*.25 = 8%.
		// Old unweighted mean over 3 models = 4%.
		mockedWeights.mockResolvedValue(
			new Map([
				["naive_forecaster", 0.75],
				["arima", 0.25],
				["chronos_base", 0],
			]),
		);

		const forecast = await generateForecast({
			commodityId: "c1",
			horizon: 10,
			currentPrice: 100,
			models: ["naive_forecaster", "arima", "chronos_base"],
		});

		expect(forecast.predictedChange).toBe(8);
	});

	it("bestModel is the highest-weight model, confidence only tie-breaks", async () => {
		// chronos_mini has the NARROWEST interval (highest confidence) but the
		// lowest weight — under the old confidence-only rule it would win.
		// Best must be the verified-best naive_forecaster.
		mockedGetCached.mockImplementation(async (_c, modelId) =>
			modelId === "chronos_mini" ? prediction(100, 101, 0.5) : prediction(100, 101, 3),
		);
		mockedWeights.mockResolvedValue(
			new Map([
				["naive_forecaster", 0.8],
				["chronos_mini", 0.2],
			]),
		);

		const forecast = await generateForecast({
			commodityId: "c1",
			horizon: 10,
			currentPrice: 100,
			models: ["naive_forecaster", "chronos_mini"],
		});

		expect(forecast.bestModel).toBe("naive_forecaster");
		// Sanity: chronos_mini really did have the narrower interval.
		const byId = new Map(forecast.individualForecasts.map((f) => [f.modelId, f]));
		expect(byId.get("chronos_mini")?.confidence ?? 0).toBeGreaterThan(
			byId.get("naive_forecaster")?.confidence ?? 1,
		);
	});

	it("all-eliminated degenerates gracefully to the equal-weight pool (documented edge)", async () => {
		// Every model weight 0 → resolveModelWeights would never return this
		// (it normalizes to equal weights), but generateForecast must stay
		// sane if it ever sees a zero map: range over ALL available models,
		// plain-mean change, a defined bestModel.
		setupCache({ naive_forecaster: 100, arima: 106 });
		mockedWeights.mockResolvedValue(
			new Map([
				["naive_forecaster", 0],
				["arima", 0],
			]),
		);

		const forecast = await generateForecast({
			commodityId: "c1",
			horizon: 10,
			currentPrice: 100,
			models: ["naive_forecaster", "arima"],
		});

		expect(forecast.availableModels).toBe(2);
		expect(forecast.range.lower).toBeLessThanOrEqual(100);
		expect(forecast.range.upper).toBeGreaterThanOrEqual(106);
		expect(forecast.bestModel).toBeDefined();
	});
});
