/**
 * Shared SWR fetcher — the single API client for SWR hooks.
 *
 * Replaces the 3+ parallel fetcher implementations (lib/api.ts apiFetcher,
 * lib/market-data.ts fetcher, lib/beef.ts beefFetcher) that each
 * reimplemented the same auth + credentials + error-throw contract.
 *
 * Wraps authFetch (utils/auth.ts) which handles:
 *   - Bearer token from tokenManager
 *   - credentials:"include" for session cookie
 *   - 401 cleanup (clears stale token)
 *
 * Adds the SWR-specific contract:
 *   - throws on non-2xx (so SWR's error binding works)
 *   - returns parsed JSON (so consumers get data directly)
 *
 * Usage in SWR hooks:
 *   const { data } = useSWR("/api/commodities", swrFetcher);
 *   // or with a path prefix:
 *   const { data } = useSWR("/commodities", (url) => swrFetcher(`/api${url}`));
 */

import { authFetch } from "@/utils/auth";

export async function swrFetcher(url: string): Promise<any> {
	const response = await authFetch(url, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		const error = new Error(`${response.status} ${response.statusText}`);
		(error as { status?: number }).status = response.status;
		throw error;
	}

	return response.json();
}
