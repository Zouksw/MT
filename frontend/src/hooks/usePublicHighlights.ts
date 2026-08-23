"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Public market highlights for the landing page's live-data strip
 * (IMPROVEMENT-PLAN batch 1). Backed by GET /api/market/public/highlights —
 * an UNAUTHENTICATED endpoint that only serves whitelisted public macro
 * series (currently the US beef carcass price, the platform's only
 * daily-updating beef series). The landing Hero renders these instead of
 * fabricated sample prices.
 */

export interface HighlightPoint {
	date: string;
	close: number;
}

export interface PublicHighlight {
	slug: string;
	name?: string;
	unit?: string;
	status: "ok" | "no_data" | "error";
	latest?: { date: string; close: number; source: string };
	/** Source series id (e.g. FRED CBBTCUSD) for on-page traceability. */
	seriesId?: string | null;
	dayChangePct?: number | null;
	series?: HighlightPoint[];
}

export function usePublicHighlights() {
	const [highlights, setHighlights] = useState<PublicHighlight[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiFetch<{
				success: boolean;
				data: { highlights: PublicHighlight[] };
			}>("/api/market/public/highlights");
			setHighlights(res.data?.highlights ?? []);
		} catch (e) {
			setError(e instanceof Error ? e : new Error("Failed to fetch highlights"));
			// No fabricated fallback — the Hero shows an honest maintenance panel.
			setHighlights([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	/** The primary live entry (first "ok" highlight), or null. */
	const live =
		highlights.find((h) => h.status === "ok" && h.latest && (h.series?.length ?? 0) >= 2) ?? null;

	return { highlights, live, loading, error, retry: fetchData };
}
