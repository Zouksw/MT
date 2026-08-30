"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Public Chinese market digest for /market/digest (IMPROVEMENT-PLAN v3.3.0
 * batch 1). Backed by GET /api/market/public/digest — an UNAUTHENTICATED
 * endpoint serving a FIXED whitelist of public series (IMF beef benchmark,
 * CME live/feeder cattle, USD/CNY, BRL/USD). Same discipline as
 * usePublicHighlights: no fabricated fallback — failures render an honest
 * maintenance state.
 */

export interface DigestPoint {
	date: string;
	close: number;
}

export interface DigestSeries {
	slug: string;
	name?: string;
	nameCn?: string | null;
	unit?: string;
	category?: string;
	status: "ok" | "no_data" | "error";
	latest?: { date: string; close: number; source: string };
	interval?: "daily" | "weekly" | "monthly";
	seriesId?: string | null;
	prevPointChangePct?: number | null;
	/** ~7-day window change (daily series only; monthly report MoM instead). */
	wowChangePct?: number | null;
	momChangePct?: number | null;
	stale?: boolean;
	series?: DigestPoint[];
}

export interface MarketDigest {
	generatedAt: string;
	series: DigestSeries[];
}

export function useMarketDigest() {
	const [digest, setDigest] = useState<MarketDigest | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiFetch<{
				success: boolean;
				data: { digest: MarketDigest };
			}>("/api/market/public/digest");
			setDigest(res.data?.digest ?? null);
		} catch (e) {
			setError(e instanceof Error ? e : new Error("Failed to fetch digest"));
			// No fabricated fallback — the page shows an honest maintenance panel.
			setDigest(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	return { digest, loading, error, retry: fetchData };
}
