/**
 * Unit tests for the inference service client — focus on checkReadiness().
 *
 * checkReadiness() distinguishes liveness (process up, /health ok) from
 * readiness (chronos ensemble usable, /ready 200). The split matters because
 * the inference process can be alive while chronos weights are missing — in
 * that state statistical baselines still serve /predict, so the platform is
 * degraded, not down.
 *
 * These tests stub global.fetch (the client uses the bare global) and verify
 * the readiness contract without any network. They are the regression guard
 * for the batch-27 fix: before it, /health/ready probed only liveness and
 * reported chronos as healthy even when weights were gone.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The client reads INFERENCE_URL at module load; the default points at
// localhost:10810 which is fine for these network-free tests.

const READY_BODY = {
	ready: true,
	chronos_usable_variants: { chronos_tiny: true, chronos_mini: true },
	chronos_pipelines_loaded: ["amazon/chronos-t5-tiny"],
	preload_failures: {},
	ready_variants: ["chronos_tiny", "chronos_mini"],
};

const NOT_READY_BODY = {
	ready: false,
	chronos_usable_variants: { chronos_tiny: false, chronos_mini: false },
	chronos_pipelines_loaded: [],
	preload_failures: { chronos_tiny: "weights not cached" },
	ready_variants: [],
};

/** Build a fetch mock that responds to a given URL with status + body. */
function mockFetch(routes: Record<string, { status: number; body?: unknown }>) {
	return vi.fn(async (url: string | URL) => {
		const path = typeof url === "string" ? url : url.toString();
		// Match by suffix so the INFERENCE_URL prefix doesn't matter.
		const entry = Object.entries(routes).find(([suffix]) => path.endsWith(suffix));
		if (!entry) throw new Error(`unexpected fetch ${path}`);
		const { status, body } = entry[1];
		return {
			ok: status >= 200 && status < 300,
			status,
			json: async () => body,
			text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
		} as unknown as Response;
	});
}

describe("inference client — checkReadiness()", () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		// Reset between tests so each sets its own fetch mock.
		global.fetch = vi.fn() as unknown as typeof global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("returns alive+ready when /health and /ready both succeed", async () => {
		global.fetch = mockFetch({
			"/health": { status: 200 },
			"/ready": { status: 200, body: READY_BODY },
		});

		const { checkReadiness } = await import("@/services/inference/client");
		const result = await checkReadiness();

		expect(result.alive).toBe(true);
		expect(result.ready).toBe(true);
		expect(result.readyVariants).toEqual(["chronos_tiny", "chronos_mini"]);
		expect(result.detail?.preload_failures).toEqual({});
	});

	it("returns alive=true, ready=false when process is up but chronos is not (503)", async () => {
		// This is the core regression: before the fix, /health/ready would
		// report inference as healthy (liveness only) even in this state.
		global.fetch = mockFetch({
			"/health": { status: 200 },
			"/ready": { status: 503, body: NOT_READY_BODY },
		});

		const { checkReadiness } = await import("@/services/inference/client");
		const result = await checkReadiness();

		expect(result.alive).toBe(true);
		expect(result.ready).toBe(false);
		expect(result.readyVariants).toEqual([]);
		// Diagnostics are preserved so operators can see WHY chronos is down.
		expect(result.detail?.preload_failures.chronos_tiny).toBe("weights not cached");
	});

	it("returns alive=false when /health itself fails (process down)", async () => {
		global.fetch = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof global.fetch;

		const { checkReadiness } = await import("@/services/inference/client");
		const result = await checkReadiness();

		// Short-circuits: doesn't even try /ready.
		expect(result.alive).toBe(false);
		expect(result.ready).toBe(false);
		expect(result.readyVariants).toEqual([]);
	});

	it("treats a /ready timeout as not-ready (alive stays true)", async () => {
		// /health succeeds (alive), but /ready throws (timeout/network).
		let callCount = 0;
		global.fetch = vi.fn(async (url: string | URL) => {
			callCount++;
			const path = typeof url === "string" ? url : url.toString();
			if (path.endsWith("/health")) return { ok: true, status: 200 } as Response;
			// /ready errors out
			throw new Error("ETIMEDOUT");
		}) as unknown as typeof global.fetch;

		const { checkReadiness } = await import("@/services/inference/client");
		const result = await checkReadiness();

		expect(result.alive).toBe(true);
		expect(result.ready).toBe(false);
		// Both endpoints were attempted.
		expect(callCount).toBe(2);
	});

	it("falls back gracefully when /ready body is unparseable", async () => {
		global.fetch = mockFetch({
			"/health": { status: 200 },
			"/ready": { status: 200, body: "not json" },
		});

		const { checkReadiness } = await import("@/services/inference/client");
		const result = await checkReadiness();

		// Body present but not the expected shape (no boolean `.ready` field) —
		// fall back to trusting the HTTP status alone. No detail is attached
		// since the body wasn't a valid readiness document.
		expect(result.alive).toBe(true);
		expect(result.ready).toBe(true);
		expect(result.detail).toBeUndefined();
	});
});
