/**
 * Shared scraper HTTP client tests (round-105, audit batch 10b).
 *
 * Pins the contract the 19 sources now rely on: init passthrough
 * (method/headers/body), the 15s default timeout signal, the FAO-style
 * transient retry policy (429/5xx≠521 retried, 4xx/521/network never), and
 * the opt-in proxy dispatch (undici ProxyAgent only when SCRAPER_PROXY_URL is
 * set AND viaProxy requested).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const undiciFetchMock = vi.fn();
const proxyAgentMock = vi.fn();

vi.mock("undici", () => ({
	fetch: (...args: unknown[]) => undiciFetchMock(...args),
	ProxyAgent: class {
		constructor(url: string) {
			proxyAgentMock(url);
		}
	},
}));

import { scraperFetch } from "@/services/dataIngestion/http";

const nativeFetch = vi.fn();
const okResponse = (status = 200) => new Response(null, { status });

beforeEach(() => {
	vi.stubGlobal("fetch", nativeFetch);
	nativeFetch.mockReset().mockResolvedValue(okResponse());
	undiciFetchMock.mockReset();
	proxyAgentMock.mockClear();
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete process.env.SCRAPER_PROXY_URL;
	vi.useRealTimers();
});

describe("scraperFetch", () => {
	test("passes method/headers/body through and sets a timeout signal", async () => {
		nativeFetch.mockResolvedValue(okResponse());
		const res = await scraperFetch("https://x.test/api", {
			method: "POST",
			headers: { "x-api-key": "k" },
			body: '{"a":1}',
		});
		expect(res.status).toBe(200);
		const [url, init] = nativeFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://x.test/api");
		expect(init.method).toBe("POST");
		expect(init.headers).toEqual({ "x-api-key": "k" });
		expect(init.body).toBe('{"a":1}');
		// default timeout armed (15s) — signal present, abort deadline set
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect((init.signal as AbortSignal).aborted).toBe(false);
	});

	test("retries a 429 once and returns the second response", async () => {
		vi.useFakeTimers();
		nativeFetch.mockResolvedValueOnce(okResponse(429)).mockResolvedValueOnce(okResponse(200));
		const p = scraperFetch("https://x.test", { retries: 1 });
		await vi.advanceTimersByTimeAsync(2100); // past the 2s retry delay
		const res = await p;
		expect(res.status).toBe(200);
		expect(nativeFetch).toHaveBeenCalledTimes(2);
	});

	test("retries a 500 but not a 521 or a 404", async () => {
		vi.useFakeTimers();
		// 500 → retried
		nativeFetch.mockResolvedValueOnce(okResponse(500)).mockResolvedValue(okResponse(200));
		let p = scraperFetch("https://x.test", { retries: 1 });
		await vi.advanceTimersByTimeAsync(2100);
		expect((await p).status).toBe(200);
		expect(nativeFetch).toHaveBeenCalledTimes(2);

		// 521 (Cloudflare origin-down) → deterministic, never retried
		nativeFetch.mockClear().mockResolvedValue(okResponse(521));
		p = scraperFetch("https://x.test", { retries: 1 });
		await vi.advanceTimersByTimeAsync(2100);
		expect((await p).status).toBe(521);
		expect(nativeFetch).toHaveBeenCalledTimes(1);

		// 404 → deterministic, never retried
		nativeFetch.mockClear().mockResolvedValue(okResponse(404));
		p = scraperFetch("https://x.test", { retries: 1 });
		await vi.advanceTimersByTimeAsync(2100);
		expect((await p).status).toBe(404);
		expect(nativeFetch).toHaveBeenCalledTimes(1);
	});

	test("a network failure throws immediately — never retried", async () => {
		nativeFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
		await expect(scraperFetch("https://x.test", { retries: 3 })).rejects.toThrow("fetch failed");
		expect(nativeFetch).toHaveBeenCalledTimes(1);
	});

	test("viaProxy + SCRAPER_PROXY_URL dispatches through undici exactly once", async () => {
		process.env.SCRAPER_PROXY_URL = "http://127.0.0.1:7890";
		undiciFetchMock.mockResolvedValue(okResponse(200));

		await scraperFetch("https://blocked.test/yahoo", { viaProxy: true });
		await scraperFetch("https://blocked.test/yahoo", { viaProxy: true });

		expect(undiciFetchMock).toHaveBeenCalledTimes(2);
		expect(nativeFetch).not.toHaveBeenCalled();
		// one cached ProxyAgent per process, not one per request
		expect(proxyAgentMock).toHaveBeenCalledTimes(1);
		expect(proxyAgentMock).toHaveBeenCalledWith("http://127.0.0.1:7890");
		const [, init] = undiciFetchMock.mock.calls[0] as [string, { dispatcher: unknown }];
		expect(init.dispatcher).toBeDefined();
	});

	test("viaProxy without SCRAPER_PROXY_URL falls back to direct fetch", async () => {
		delete process.env.SCRAPER_PROXY_URL;
		await scraperFetch("https://x.test", { viaProxy: true });
		expect(nativeFetch).toHaveBeenCalledTimes(1);
		expect(undiciFetchMock).not.toHaveBeenCalled();
	});
});
