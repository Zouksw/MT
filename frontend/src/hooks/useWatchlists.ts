"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/apiFetch";
import { swrFetcher } from "@/lib/swr-fetcher";

/**
 * useWatchlists — minimal client for the watchlist API (IMPROVEMENT-PLAN D1).
 *
 * The backend surface (7 endpoints, backend/src/routes/watchlist.ts) shipped
 * with zero frontend consumers; this hook + the /watchlists page are the
 * minimal consuming UI: list watchlists, add/remove a commodity, see its
 * latest quote. Deliberately NOT built: rename/delete-list UI. (The
 * /api/portfolios analysis groups never gained a consumer either and were
 * removed with their tables — round-140 D3.)
 */

export interface WatchlistItem {
	id: string;
	commodityId: string;
	commodity: {
		slug: string;
		name: string;
		nameCn: string | null;
		category: string;
		unit: string;
	};
	latestPrice: number | null;
	latestDate: string | null;
	notes: string | null;
	addedAt: string;
}

export interface WatchlistData {
	id: string;
	name: string;
	isDefault: boolean;
	itemCount: number;
	items: WatchlistItem[];
	createdAt: string;
}

export interface WatchlistQuote {
	commodityId: string;
	slug: string;
	name: string;
	nameCn: string | null;
	unit: string;
	price: number | null;
	previousPrice: number | null;
	change: number | null;
	changePercent: number | null;
	date: string | null;
}

/** Picker source — GET /api/market/commodities (authoritative latest price). */
export interface CommodityOption {
	id: string;
	slug: string;
	name: string;
	nameCn: string | null;
	category: string;
	unit: string;
	currency: string | null;
	latestPrice: number | null;
	latestDate: string | null;
}

export function useWatchlists() {
	const { data, error, mutate } = useSWR<{ data: { watchlists: WatchlistData[] } }>(
		"/api/watchlists",
		swrFetcher,
		{ refreshInterval: 60_000 },
	);
	return {
		watchlists: data?.data?.watchlists ?? [],
		loading: !data && !error,
		error,
		mutate,
	};
}

export function useWatchlistQuotes(watchlistId: string | null) {
	const { data } = useSWR<{ data: { quotes: WatchlistQuote[] } }>(
		watchlistId ? `/api/watchlists/${watchlistId}/quotes` : null,
		swrFetcher,
		{ refreshInterval: 30_000 },
	);
	return { quotes: data?.data?.quotes ?? [] };
}

export function useCommodityOptions() {
	const { data, error } = useSWR<{ data: { commodities: CommodityOption[] } }>(
		"/api/market/commodities",
		swrFetcher,
	);
	return {
		commodities: data?.data?.commodities ?? [],
		loading: !data && !error,
	};
}

// Mutations — plain callbacks (one-shot side effects, not cacheable GETs);
// the page revalidates via the hooks' mutate after each call.

export async function createWatchlist(name: string): Promise<void> {
	await apiFetch("/api/watchlists", { method: "POST", body: JSON.stringify({ name }) });
}

export async function addWatchlistItem(watchlistId: string, commodityId: string): Promise<void> {
	await apiFetch(`/api/watchlists/${watchlistId}/items`, {
		method: "POST",
		body: JSON.stringify({ commodityId }),
	});
}

export async function removeWatchlistItem(watchlistId: string, commodityId: string): Promise<void> {
	await apiFetch(`/api/watchlists/${watchlistId}/items/${commodityId}`, { method: "DELETE" });
}
