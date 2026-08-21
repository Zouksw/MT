import { authFetch } from "@/utils/auth";

/**
 * THE single API client (round-115, TD-8 core). Path-based ("/api/..."):
 * authFetch prefixes API_BASE — same-origin Next rewrite by default
 * (lib/config.ts), so no CORS. Bearer-if-token, session cookie, and the
 * 401 stale-token cleanup all come from the one auth layer instead of being
 * re-implemented per page. swrFetcher (lib/swr-fetcher.ts) and beefFetcher
 * (lib/beef.ts) are thin delegates over this.
 */
export class ApiFetchError extends Error {
	readonly status: number;

	constructor(status: number, statusText: string) {
		super(`HTTP ${status}${statusText ? ` ${statusText}` : ""}`);
		this.name = "ApiFetchError";
		this.status = status;
	}
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
	const res = await authFetch(path, init);
	if (!res.ok) throw new ApiFetchError(res.status, res.statusText);
	return res.json();
}
