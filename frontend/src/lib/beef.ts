/**
 * Beef data fetcher — shared SWR fetcher for the beef pages.
 *
 * Cookie-only auth (credentials: "include"); the beef endpoints are public-by-
 * design on the backend, so no Bearer token is attached. SWR keys already carry
 * the /api/beef/... path, so API_BASE has no /api suffix.
 *
 * Consolidated from three byte-identical copies that lived inline in
 * app/beef/page.tsx, app/beef/factories/page.tsx, app/beef/cuts/[cutCode]/page.tsx.
 */

import { API_BASE } from "@/lib/config";

export async function beefFetcher(url: string) {
	const res = await fetch(`${API_BASE}${url}`, {
		headers: { "Content-Type": "application/json" },
		credentials: "include",
	});
	if (!res.ok) throw new Error(`${res.status}`);
	return res.json();
}
