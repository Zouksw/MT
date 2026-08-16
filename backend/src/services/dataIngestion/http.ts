/**
 * Shared HTTP client for scraper data sources (round-105, audit batch 10b).
 *
 * Before this module the 19 sources rolled their own fetch calls: 4 generic
 * wrappers, ~9 per-endpoint functions, ~11 bare inline `fetch`es — no two
 * alike in timeout (8/10/15/20/30s/none), User-Agent (3 strings or absent),
 * error policy (throw / warn+[] / silent null), retry (exactly one source),
 * or proxy support (exactly one source). Two sources had NO timeout at all,
 * so a hanging host stalled the scraper cycle indefinitely.
 *
 * scraperFetch is the one seam for all of that: per-call timeout (default
 * 15s), custom headers, POST bodies, opt-in transient retry (the FAO policy:
 * 429 or 5xx-except-521, deterministic statuses are never retried), and
 * opt-in proxy dispatch (the cmeFutures Yahoo pattern: undici ProxyAgent from
 * SCRAPER_PROXY_URL, direct fetch when unset). It returns the raw Response —
 * JSON/HTML/CSV parsing stays with the caller, where the domain knowledge
 * lives. Callers keep their own catch-and-warn policy: this client THROWS on
 * network/timeout failure (like bare fetch) so each source decides whether a
 * dead host is a hard failure or an empty cycle.
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";
import { logger } from "@/lib";

export interface ScraperFetchRequest {
	/** Per-request timeout. Default 15s. Sources with slow hosts pass more. */
	timeoutMs?: number;
	method?: "GET" | "POST";
	headers?: Record<string, string>;
	/** Request body (POST). Pass the already-serialized JSON string. */
	body?: string;
	/**
	 * Extra attempts after a transient response (429 or 5xx-except-521),
	 * 2s apart. Default 0. Network/timeout failures and deterministic 4xx
	 * are never retried — the identical request cannot succeed.
	 */
	retries?: number;
	/**
	 * Route through the undici ProxyAgent built from SCRAPER_PROXY_URL
	 * (direct fetch when the env is unset). Opt-in: only hosts that are
	 * IP-blocked for this machine (Yahoo edge) need it.
	 */
	viaProxy?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2000;

// Module-cached agent — one ProxyAgent per process, created lazily on first
// proxied request (mirrors the cmeFutures pattern this generalizes).
let proxyAgent: ProxyAgent | undefined;

function isTransientStatus(status: number): boolean {
	return status === 429 || (status >= 500 && status !== 521);
}

/**
 * Fetch a scraper URL with timeout, optional retry, and optional proxy.
 * Throws on network/timeout errors (AbortError surfaces as the cause).
 */
export async function scraperFetch(url: string, req: ScraperFetchRequest = {}): Promise<Response> {
	const { timeoutMs = DEFAULT_TIMEOUT_MS, method = "GET", headers, body, retries = 0 } = req;

	const doFetch = (): Promise<Response> => {
		const init: RequestInit = {
			method,
			headers,
			body,
			signal: AbortSignal.timeout(timeoutMs),
		};
		if (req.viaProxy && process.env.SCRAPER_PROXY_URL) {
			proxyAgent ??= new ProxyAgent(process.env.SCRAPER_PROXY_URL);
			// undici's fetch understands `dispatcher`; native fetch ignores it,
			// so the proxied path must run on undici explicitly.
			return undiciFetch(url, {
				...(init as Parameters<typeof undiciFetch>[1]),
				dispatcher: proxyAgent,
			}) as unknown as Promise<Response>;
		}
		return fetch(url, init);
	};

	let res = await doFetch();
	for (let attempt = 0; attempt < retries && !res.ok && isTransientStatus(res.status); attempt++) {
		logger.warn(
			`[http] ${url} returned ${res.status} (retry ${attempt + 1}/${retries} in ${RETRY_DELAY_MS}ms)`,
		);
		await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
		res = await doFetch();
	}
	return res;
}
