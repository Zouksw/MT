/**
 * Deep scheduler for background jobs (round-105, audit batch 10a).
 *
 * Before this module, server.ts armed every background job with the same
 * hand-rolled pattern: a `runX` async wrapper with its own try/catch (an
 * escaped error would crash the process), a `setTimeout(runX, delay)` for the
 * startup run, a `setInterval(runX, interval)` for the cadence, and a prayer
 * that nothing overlapped. Nine copies of that pattern meant the cross-cutting
 * concerns — error isolation, overlap guarding, timer lifecycle — were
 * re-implemented (or skipped) per job, and the boot sequence's shape was
 * buried inside 200 lines of imperative glue.
 *
 * This module owns ALL of that behind one small interface: callers declare
 * WHAT runs and HOW OFTEN; the scheduler guarantees errors are contained and
 * logged (never crash, next tick still fires), overlapping runs are skipped,
 * and timers never block process exit (unref).
 *
 * Not covered here: the prediction refresh timer inside predictionCache.ts.
 * That timer's lifecycle is tied to its subscribe/unsubscribe model (commodities
 * subscribe dynamically), so it keeps its own in-flight guard; everything with
 * a static cadence lives in the JOBS table in server.ts.
 */

import { logger } from "@/lib";

export interface ScheduledJob {
	/** Stable identifier used in error logs — make it grep-able. */
	name: string;
	/** Cadence. Omit for a one-shot (firstRunDelayMs required in that case). */
	intervalMs?: number;
	/** Schedule one run this many ms after registration. Omit for no startup run. */
	firstRunDelayMs?: number;
	/**
	 * The job body — business logic only, NO try/catch needed. Whatever it
	 * throws is caught here, logged with the job name, and never propagates.
	 */
	run: () => Promise<void>;
}

interface TrackedJob {
	job: ScheduledJob;
	running: boolean;
	timer: ReturnType<typeof setInterval> | null;
	firstRunTimer: ReturnType<typeof setTimeout> | null;
}

const tracked = new Map<string, TrackedJob>();

/**
 * Wrap a single execution with error isolation + overlap guard. Exposed for
 * tests; production code goes through scheduleJobs/registerJob.
 */
async function executeOnce(t: TrackedJob): Promise<void> {
	if (t.running) {
		logger.warn(`⏭️ [job:${t.job.name}] skipped — previous run still in progress`);
		return;
	}
	t.running = true;
	try {
		await t.job.run();
	} catch (err) {
		// A failed job must never take down the process: the HTTP server, the
		// websocket, and every OTHER job keep running. Warn-level (matching the
		// pre-refactor per-job catch blocks) — a single failed cron cycle is an
		// operational event, not a process fault.
		logger.warn(`[job:${t.job.name}] failed: ${err instanceof Error ? err.message : String(err)}`);
	} finally {
		t.running = false;
	}
}

function armJob(job: ScheduledJob): void {
	const t: TrackedJob = { job, running: false, timer: null, firstRunTimer: null };

	if (job.intervalMs === undefined && job.firstRunDelayMs === undefined) {
		throw new Error(`Job "${job.name}" is a no-op: provide intervalMs and/or firstRunDelayMs`);
	}
	if (job.intervalMs !== undefined && job.intervalMs <= 0) {
		throw new Error(`Job "${job.name}" has non-positive intervalMs (${job.intervalMs})`);
	}

	if (job.firstRunDelayMs !== undefined) {
		// Startup run. Recurring jobs keep their interval timer afterwards;
		// interval-less jobs are one-shots (delay-only) by design.
		t.firstRunTimer = setTimeout(() => {
			void executeOnce(t);
		}, job.firstRunDelayMs);
		t.firstRunTimer.unref?.();
	}

	if (job.intervalMs !== undefined) {
		t.timer = setInterval(() => {
			void executeOnce(t);
		}, job.intervalMs);
		t.timer.unref?.();
	}

	tracked.set(job.name, t);
}

/** Register a single job. Registering an existing name is a programmer error. */
export function registerJob(job: ScheduledJob): void {
	if (tracked.has(job.name)) {
		throw new Error(`Job "${job.name}" already registered`);
	}
	armJob(job);
}

/** Register a batch of jobs (the normal entry point from server.ts). */
export function scheduleJobs(jobs: ScheduledJob[]): void {
	for (const job of jobs) registerJob(job);
}

/** Test/teardown hook: clear every timer. Production never calls this. */
export function clearAllJobs(): void {
	for (const t of tracked.values()) {
		if (t.timer) clearInterval(t.timer);
		if (t.firstRunTimer) clearTimeout(t.firstRunTimer);
	}
	tracked.clear();
}
