/**
 * runAndCachePrediction — write-path tests.
 *
 * Covers the regression introduced when logPrediction failures were silently
 * swallowed by `.catch(() => {})` in predictionCache. The fix logs the error
 * via logger.error so DB-write gaps are observable. These tests pin that
 * behaviour: a failed logPrediction MUST call logger.error and MUST NOT
 * reject the surrounding runAndCachePrediction call.
 *
 * Vitest (backend unit-test convention). Redis, logger, the inference client,
 * the data-fetcher, and mapeTracking are all mocked — no real I/O.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so any mock state they close
// over must be created with vi.hoisted (which runs before hoisting).
const mocks = vi.hoisted(() => ({
	redis: { get: vi.fn(), setEx: vi.fn(), del: vi.fn() },
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	predict: vi.fn(),
	getValues: vi.fn(),
	logPrediction: vi.fn(),
}));

// --- mocks -------------------------------------------------------------

vi.mock("@/lib/redis", () => ({
	getRedisClient: vi.fn(async () => mocks.redis),
}));

// Capture logger.error so we can assert it fires on swallowed failures.
vi.mock("@/lib", () => ({
	logger: mocks.logger,
	// prisma is imported at module load (schedulePredictionsFromPostgreSQL);
	// stub it so the module loads without a real DB.
	prisma: { commodity: { findMany: vi.fn() } },
}));

// Inference client + data fetcher — deterministic happy-path defaults.
vi.mock("@/services/inference/client", () => ({
	predict: (...args: unknown[]) => mocks.predict(...args),
}));
vi.mock("@/services/inference/data-fetcher", () => ({
	getCommodityPriceValues: (...args: unknown[]) => mocks.getValues(...args),
}));

// getAllModels is called in refreshCommodityPredictions path; stub it.
vi.mock("@/services/tradingSignals", () => ({
	getAllModels: vi.fn(() => ["arima", "holtwinters"]),
}));

// mapeTracking.logPrediction — the function whose failure we exercise.
vi.mock("@/services/mapeTracking", () => ({
	logPrediction: (...args: unknown[]) => mocks.logPrediction(...args),
}));

// --- subject ------------------------------------------------------------

import { runAndCachePrediction } from "@/services/predictionCache";

// --- helpers ------------------------------------------------------------

function setupHappyPath() {
	mocks.getValues.mockResolvedValue({
		values: [100, 101, 102],
		timestamps: [1, 2, 3],
	});
	mocks.predict.mockResolvedValue({
		timestamps: [4, 5, 6],
		values: [103, 104, 105],
		lower_bound: [100, 101, 102],
		upper_bound: [106, 107, 108],
		model_id: "arima",
	});
	mocks.redis.setEx.mockResolvedValue("OK");
}

beforeEach(() => {
	vi.clearAllMocks();
	setupHappyPath();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// --- tests --------------------------------------------------------------

describe("runAndCachePrediction — error observability", () => {
	it("returns the cached prediction even when logPrediction fails (non-blocking)", async () => {
		// Regression: previously the catch was `.catch(() => {})` — a silent
		// swallow. The prediction must STILL succeed (caller depends on it),
		// only the MAPE log is lost.
		mocks.logPrediction.mockRejectedValue(new Error("DB write failed"));

		const result = await runAndCachePrediction("c1", "arima", 10);

		// The caller still gets a usable cached prediction.
		expect(result).not.toBeNull();
		expect(result.values).toEqual([103, 104, 105]);
		// ...and it was written to Redis regardless of the log failure.
		expect(mocks.redis.setEx).toHaveBeenCalledTimes(1);
	});

	it("logs an error when logPrediction fails (no silent swallow)", async () => {
		// THIS IS THE REGRESSION TEST. Before the fix, logger.error was never
		// called on a logPrediction failure — the error vanished. After the
		// fix, the failure must be observable with enough context to diagnose.
		mocks.logPrediction.mockRejectedValue(new Error("connection refused"));

		await runAndCachePrediction("c1", "arima", 10);

		// Allow the async .then/.catch chain to flush.
		await vi.waitFor(() => {
			expect(mocks.logger.error).toHaveBeenCalledTimes(1);
		});

		const [msg] = mocks.logger.error.mock.calls[0];
		// Context: which model + commodity failed, and what stage (MAPE tracking).
		expect(msg).toContain("arima");
		expect(msg).toContain("c1");
		expect(msg).toContain("MAPE");
	});
});

describe("runAndCachePrediction — happy path", () => {
	it("caches and logs a successful prediction", async () => {
		mocks.logPrediction.mockResolvedValue("log-id-123");

		const result = await runAndCachePrediction("c1", "arima", 10);

		expect(result.algorithm).toBe("arima");
		expect(mocks.predict).toHaveBeenCalledWith(
			expect.objectContaining({ model_id: "arima", horizon: 10 }),
		);
		expect(mocks.redis.setEx).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => {
			expect(mocks.logPrediction).toHaveBeenCalledTimes(1);
		});
		// No error logged on the happy path.
		expect(mocks.logger.error).not.toHaveBeenCalled();
	});
});
