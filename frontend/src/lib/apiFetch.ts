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
	/** Parsed JSON error body, when the API sent one. */
	readonly body?: unknown;

	constructor(status: number, statusText: string, body?: unknown) {
		super(errorMessage(status, statusText, body));
		this.name = "ApiFetchError";
		this.status = status;
		this.body = body;
	}
}

/**
 * Prefer the API's own message over "HTTP 500". The backend has two error
 * shapes in the wild — `{ error: { message } }` (AppError/Zod paths) and
 * `{ message }` (auth routes) — plus the apikeys route's bare `{ error }`
 * string. Cover all three, fall back to the status line.
 */
function errorMessage(status: number, statusText: string, body: unknown): string {
	if (body && typeof body === "object") {
		const b = body as Record<string, unknown>;
		const nested = b.error;
		if (typeof nested === "string" && nested) return nested;
		if (nested && typeof nested === "object") {
			const m = (nested as Record<string, unknown>).message;
			if (typeof m === "string" && m) return m;
		}
		if (typeof b.message === "string" && b.message) return b.message;
	}
	return `HTTP ${status}${statusText ? ` ${statusText}` : ""}`;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
	const res = await authFetch(path, init);
	if (!res.ok) {
		// Best-effort body parse: a non-JSON error (HTML 502 page, empty body)
		// must still throw — the message falls back to the status line.
		const body: unknown = await res.json().catch(() => undefined);
		throw new ApiFetchError(res.status, res.statusText, body);
	}
	return res.json();
}
