/**
 * Beef data fetcher — SWR fetcher for the beef pages, now a thin delegate
 * over the single API client (round-115, TD-8). Callers pass "/api/beef/..."
 * paths; apiFetch (via authFetch) prefixes API_BASE — same-origin rewrite by
 * default. The beef endpoints stay public-by-design on the backend; the
 * Bearer header that apiFetch attaches when logged in is simply ignored by
 * them. Previously this was a third hand-rolled cookie-only fetch.
 */
import { apiFetch } from "@/lib/apiFetch";

/** Default generic mirrors the historical untyped contract (Promise<any>)
 * so the beef pages' untyped call sites keep their `.data` access. */
export async function beefFetcher<T = any>(url: string): Promise<T> {
	return apiFetch<T>(url);
}
