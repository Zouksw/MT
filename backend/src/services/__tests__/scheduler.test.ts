/**
 * Scheduler unit tests (round-105, audit batch 10a).
 *
 * The scheduler is the single owner of timer lifecycle for background jobs,
 * so these tests pin the guarantees server.ts used to re-implement per job:
 * startup runs fire at their delay, intervals keep firing, a thrown job body
 * is logged and contained (next tick still runs), overlapping runs are
 * skipped, and interval-less jobs are true one-shots.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// vi.mock factories are hoisted above every const — the spy must come from
// vi.hoisted or it's referenced before initialization (same trap family as
// the round-104 describe-body-const snapshot bug).
const { loggerWarn } = vi.hoisted(() => ({ loggerWarn: vi.fn() }));

vi.mock("@/lib", () => ({
	logger: { info: vi.fn(), warn: loggerWarn, error: vi.fn() },
}));

import { clearAllJobs, registerJob, type ScheduledJob, scheduleJobs } from "@/services/scheduler";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	clearAllJobs();
	vi.useRealTimers();
	loggerWarn.mockClear();
});

describe("scheduler", () => {
	test("recurring job fires at interval, with optional startup run at its delay", async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		registerJob({ name: "t", intervalMs: 1000, firstRunDelayMs: 50, run });

		await vi.advanceTimersByTimeAsync(49);
		expect(run).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1); // 50ms — startup run
		expect(run).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1000); // first interval tick
		expect(run).toHaveBeenCalledTimes(2);
	});

	test("recurring job without firstRunDelayMs does NOT run at startup", async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		registerJob({ name: "t", intervalMs: 1000, run });

		await vi.advanceTimersByTimeAsync(50);
		expect(run).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(950); // 1000ms — first interval tick only
		expect(run).toHaveBeenCalledTimes(1);
	});

	test("delay-only job is a one-shot: never repeats", async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		registerJob({ name: "once", firstRunDelayMs: 20, run });

		await vi.advanceTimersByTimeAsync(20);
		expect(run).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1_000_000);
		expect(run).toHaveBeenCalledTimes(1);
	});

	test("a thrown job body is contained: logged once, next tick still fires", async () => {
		const run = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
		registerJob({ name: "fragile", intervalMs: 100, run });

		await vi.advanceTimersByTimeAsync(100); // throws
		expect(run).toHaveBeenCalledTimes(1);
		expect(loggerWarn).toHaveBeenCalledTimes(1);
		expect(loggerWarn.mock.calls[0][0]).toContain("[job:fragile]");
		expect(loggerWarn.mock.calls[0][0]).toContain("boom");

		await vi.advanceTimersByTimeAsync(100); // recovers
		expect(run).toHaveBeenCalledTimes(2);
		expect(loggerWarn).toHaveBeenCalledTimes(1); // no new error
	});

	test("overlap guard: a tick while the previous run is still in flight is skipped", async () => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const run = vi
			.fn()
			.mockImplementationOnce(() => gate)
			.mockResolvedValue(undefined);
		registerJob({ name: "slow", intervalMs: 100, run });

		await vi.advanceTimersByTimeAsync(100); // first run starts, awaits gate
		expect(run).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(100); // overlaps — must skip
		expect(run).toHaveBeenCalledTimes(1);
		expect(loggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("[job:slow] skipped — previous run still in progress"),
		);

		release();
		await vi.advanceTimersByTimeAsync(0); // let the finally settle
		await vi.advanceTimersByTimeAsync(100); // next tick runs normally
		expect(run).toHaveBeenCalledTimes(2);
	});

	test("rejects a no-op job (no interval, no delay)", () => {
		expect(() => registerJob({ name: "noop", run: async () => {} } as ScheduledJob)).toThrow(
			/no-op/,
		);
	});

	test("rejects duplicate registration and non-positive interval", () => {
		registerJob({ name: "dup", intervalMs: 1000, run: async () => {} });
		expect(() => registerJob({ name: "dup", intervalMs: 2000, run: async () => {} })).toThrow(
			/already registered/,
		);
		expect(() => registerJob({ name: "neg", intervalMs: 0, run: async () => {} })).toThrow(
			/non-positive/,
		);
	});

	test("scheduleJobs registers a batch", async () => {
		const a = vi.fn().mockResolvedValue(undefined);
		const b = vi.fn().mockResolvedValue(undefined);
		scheduleJobs([
			{ name: "a", firstRunDelayMs: 10, run: a },
			{ name: "b", firstRunDelayMs: 10, run: b },
		]);
		await vi.advanceTimersByTimeAsync(10);
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});
});
