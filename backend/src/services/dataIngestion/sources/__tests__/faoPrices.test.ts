/**
 * FAO fetchWithRetry — retry-policy contract (round-63).
 *
 * The previous version retried EVERY failure with a 30s timeout, causing a
 * ~272s stall when the FAO origin was unreachable. The fix distinguishes
 * transient from deterministic failures. These tests pin the 4 branches so
 * a regression that re-introduces blanket retrying fails loudly.
 *
 * global.fetch is mocked per-test; AbortSignal.timeout is stubbed to a
 * no-op (we don't actually want to wait 8s — the test controls what fetch
 * resolves/rejects to).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "@/services/dataIngestion/sources/faoPrices";

// Minimal Response shape fetchWithRetry reads: .ok and .status.
function mockResponse(status: number, ok = status >= 200 && status < 300) {
	return { ok, status } as Response;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
	// AbortSignal.timeout(8000) arms a real 8s timer in the source. Stub it
	// to a never-aborting signal so tests control fetch's behavior without
	// waiting. Wrap in vi.stubGlobal so unstubAllGlobals restores the real
	// AbortSignal in afterEach.
	const RealAbortSignal = AbortSignal;
	const stub = Object.create(RealAbortSignal);
	stub.timeout = () => new AbortController().signal;
	vi.stubGlobal("AbortSignal", stub);
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("FAO fetchWithRetry — retry policy", () => {
	it("returns the response on HTTP 200 (no retry needed)", async () => {
		const fetchMock = vi.fn(async () => mockResponse(200));
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const res = await fetchWithRetry("https://example.com/api");

		expect(res).not.toBeNull();
		expect(res?.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1); // success path, no retry
	});

	it("retries once on HTTP 429 (rate limit, transient)", async () => {
		const fetchMock = vi
			.fn<Promise<Response>, []>()
			.mockResolvedValueOnce(mockResponse(429))
			.mockResolvedValueOnce(mockResponse(200));
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const res = await fetchWithRetry("https://example.com/api");

		expect(res?.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
	});

	it("retries once on HTTP 503 (5xx-other-than-521, transient)", async () => {
		const fetchMock = vi
			.fn<Promise<Response>, []>()
			.mockResolvedValueOnce(mockResponse(503))
			.mockResolvedValueOnce(mockResponse(200));
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const res = await fetchWithRetry("https://example.com/api");

		expect(res?.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does NOT retry on HTTP 404 (deterministic 4xx)", async () => {
		const fetchMock = vi.fn(async () => mockResponse(404));
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const res = await fetchWithRetry("https://example.com/api");

		expect(res).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1); // no retry on 404
	});

	it("does NOT retry on HTTP 521 (Cloudflare origin-down, deterministic)", async () => {
		// 521 is the specific Cloudflare code for origin hard-down. Retrying
		// within seconds cannot revive a down origin — the old code retried
		// these 10× causing the 272s stall.
		const fetchMock = vi.fn(async () => mockResponse(521));
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const res = await fetchWithRetry("https://example.com/api");

		expect(res).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1); // no retry on 521
	});

	it("does NOT retry on network timeout (host unreachable = deterministic for a single origin)", async () => {
		// The prod failure mode: fenixservices.fao.org times out (HTTP 000).
		// The old code retried, doubling the stall. A 2s-later retry of a
		// dead host hits the same timeout — no point.
		const fetchMock = vi.fn(async () => {
			throw new Error("The operation was aborted due to timeout");
		});
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const res = await fetchWithRetry("https://example.com/api");

		expect(res).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1); // no retry on network error
	});

	it("gives up after one retry when 503 persists (does not loop)", async () => {
		// Transient status that never clears → exactly one retry, then bail.
		const fetchMock = vi.fn(async () => mockResponse(503));
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const res = await fetchWithRetry("https://example.com/api");

		expect(res).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry, not more
	});
});
