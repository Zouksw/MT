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
// monthlyNewPointState is imported by predictionCache for the monthly
// refresh guard (ADR-0001 ④) — stub it so the mock stays shape-complete.
vi.mock("@/services/mapeTracking", () => ({
	logPrediction: (...args: unknown[]) => mocks.logPrediction(...args),
	monthlyNewPointState: vi.fn(async () => ({ hasNewPoint: true, newestRowId: null })),
}));

// --- subject ------------------------------------------------------------

import { getRedisClient } from "@/lib/redis";
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

describe("runAndCachePrediction — concurrent miss dedup (round-119)", () => {
	// logPrediction is an unconditional create: two concurrent misses for the
	// same (commodity, model, horizon) used to run the full pipeline twice and
	// write duplicate prediction_logs rows, inflating the MAPE denominator.
	it("shares ONE computation + ONE logPrediction across concurrent same-key calls", async () => {
		mocks.logPrediction.mockResolvedValue("log-id-dedup");
		// Keep the shared computation pending until both callers have piled up.
		let resolvePredict: (v: unknown) => void = () => {};
		mocks.predict.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolvePredict = resolve;
				}),
		);

		const p1 = runAndCachePrediction("c1", "arima", 10);
		const p2 = runAndCachePrediction("c1", "arima", 10);

		// The resolver isn't installed until the shared computation actually
		// reaches predict() (an await sits in front of it), so wait for that
		// call before resolving. This also proves the second caller joined the
		// in-flight run instead of starting its own predict.
		await vi.waitFor(() => {
			expect(mocks.predict).toHaveBeenCalledTimes(1);
		});
		resolvePredict({
			timestamps: [4, 5, 6],
			values: [103, 104, 105],
			lower_bound: null,
			upper_bound: null,
			model_id: "arima",
		});
		const [r1, r2] = await Promise.all([p1, p2]);

		expect(mocks.predict).toHaveBeenCalledTimes(1);
		expect(mocks.logPrediction).toHaveBeenCalledTimes(1);
		// Both callers receive the SAME shared result object.
		expect(r1).toBe(r2);
		expect(r1.values).toEqual([103, 104, 105]);
	});

	it("does not memoize failures — the next caller retries (no negative cache)", async () => {
		mocks.logPrediction.mockResolvedValue("log-id-retry");
		mocks.predict.mockRejectedValueOnce(new Error("inference down"));

		await expect(runAndCachePrediction("c2", "arima", 10)).rejects.toThrow("inference down");

		// After the rejection settles, the in-flight entry is gone: a fresh
		// caller runs a real computation instead of inheriting the failure.
		const result = await runAndCachePrediction("c2", "arima", 10);
		expect(result.values).toEqual([103, 104, 105]);
		expect(mocks.predict).toHaveBeenCalledTimes(2);
	});

	it("different keys compute independently", async () => {
		mocks.logPrediction.mockResolvedValue("log-id-multi");
		await Promise.all([
			runAndCachePrediction("c1", "arima", 10),
			runAndCachePrediction("c1", "holtwinters", 10),
		]);
		expect(mocks.predict).toHaveBeenCalledTimes(2);
	});
});

describe("runAndCachePrediction — Redis outage degradation (round-119)", () => {
	// getRedisClient() REJECTS while Redis is down (it never returns null —
	// the old `if (!client)` checks were dead code). An already-computed
	// prediction must not be discarded and logPrediction must still run:
	// inference cost is paid and the MAPE loop depends on the DB row.
	it("returns the prediction and still logs when the cache write fails", async () => {
		mocks.logPrediction.mockResolvedValue("log-id-456");
		setupHappyPath();
		vi.mocked(getRedisClient).mockRejectedValueOnce(
			new Error("Redis is temporarily unreachable (connection cooldown)"),
		);

		const result = await runAndCachePrediction("c1", "arima", 10);

		expect(result.algorithm).toBe("arima");
		expect(result.values).toEqual([103, 104, 105]);
		await vi.waitFor(() => {
			expect(mocks.logPrediction).toHaveBeenCalledTimes(1);
		});
		// Degrades loudly but not fatally.
		expect(mocks.logger.warn).toHaveBeenCalled();
	});
});
