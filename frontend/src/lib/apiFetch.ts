import { getAuthToken } from "@/utils/auth";

/**
 * Shared minimal authenticated GET fetcher (TD-8 convergence, round-114):
 * identical private copies of this function lived in useModelDetail and
 * useAccuracyData. Unlike swrFetcher (which prefixes API_BASE and sends
 * cookies), this takes an already-built URL and sends only the Bearer
 * header — the exact semantics the two hooks' call sites rely on.
 */
export async function apiFetch<T>(url: string): Promise<T> {
	const token = getAuthToken();
	const res = await fetch(url, {
		headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
