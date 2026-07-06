/**
 * Prediction Queue Tests
 *
 * The queue is backed by BullMQ + Redis. initPredictionQueue() opens real
 * connections, which we don't want in a unit test. Instead we exercise the
 * guards: before init, every scheduling function returns null (a guard that
 * protects the dashboard endpoint when the queue hasn't been initialized —
 * e.g. during a partial startup or after shutdownQueues). shutdownQueues must
 * be idempotent (calling it twice or before init must not throw).
 *
 * We reset module state between tests via vi.resetModules() so the module-level
 * `let predictionQueue = null` starts fresh each time.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Logger is used by the module; stub it so we don't pull real config.
vi.mock("@/lib", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Prediction Queue — uninitialized guards", () => {
	beforeEach(async () => {
		vi.resetModules();
	});

	it("schedulePrediction returns null when the queue is not initialized", async () => {
		const { schedulePrediction } = await import("@/services/predictionQueue");
		const jobId = await schedulePrediction("c1", 10);
		expect(jobId).toBeNull();
	});

	it("scheduleCorrelation returns null when the queue is not initialized", async () => {
		const { scheduleCorrelation } = await import("@/services/predictionQueue");
		const jobId = await scheduleCorrelation(["c1", "c2"], 30);
		expect(jobId).toBeNull();
	});

	it("scheduleRecurringPredictions does not throw when uninitialized", async () => {
		const { scheduleRecurringPredictions } = await import("@/services/predictionQueue");
		// Guards return void; the only contract is "no throw" before init.
		await expect(scheduleRecurringPredictions("c1", 10)).resolves.toBeUndefined();
	});

	it("cancelRecurringPredictions does not throw when uninitialized", async () => {
		const { cancelRecurringPredictions } = await import("@/services/predictionQueue");
		await expect(cancelRecurringPredictions("c1")).resolves.toBeUndefined();
	});

	it("shutdownQueues is idempotent — safe to call before init and repeatedly", async () => {
		const { shutdownQueues } = await import("@/services/predictionQueue");
		await expect(shutdownQueues()).resolves.toBeUndefined();
		// Second call: workers/queues are null, optional chaining should no-op.
		await expect(shutdownQueues()).resolves.toBeUndefined();
	});
});
