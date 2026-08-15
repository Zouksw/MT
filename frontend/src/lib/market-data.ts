"use client";

import useSWR from "swr";
import { API_BASE } from "@/lib/config";
import { swrFetcher } from "@/lib/swr-fetcher";

// ── API base ───────────────────────────────────────────────────────────────

const API_URL = `${API_BASE}/api`;

// ── SWR fetcher with auth ──────────────────────────────────────────────────

/**
 * Round-91: delegates to the shared swrFetcher (wraps authFetch) instead of
 * reimplementing the token + credentials + error-throw contract. The API_URL
 * already includes the /api suffix, so callers use paths like "/commodities".
 */
export async function fetcher(url: string) {
	return swrFetcher(`${API_URL}${url}`);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Commodity {
	id: string;
	slug: string;
	name: string;
	nameCn: string;
	category: string;
	subcategory: string;
	grade: string;
	originCountry: string;
	factoryCode: string;
	unit: string;
	currency: string;
}

export interface CommodityPricePoint {
	date: string;
	open?: number;
	high?: number;
	low?: number;
	close: number;
	volume?: number;
	metadata?: Record<string, unknown>;
}

export interface PriceHistoryResponse {
	commodity: Commodity;
	prices: CommodityPricePoint[];
}

export interface LatestPriceResponse {
	commodity: Commodity;
	price: CommodityPricePoint;
}

export interface ExchangeRateResponse {
	rates: Record<string, number>;
	base: string;
	timestamp: string;
}

export interface DataSource {
	id: string;
	label: string;
	description: string;
	tier: string;
	status: "healthy" | "error" | "pending";
	lastRun: string | null;
	error: string | null;
	lastResult: { inserted: number; updated: number } | null;
}

export interface CommoditySourceInfo {
	id: string;
	label: string;
	priceCount: number;
	dateRange: { from: string; to: string };
}

export interface CommoditySourcesResponse {
	commodity: { id: string; slug: string; name: string; unit: string };
	priceSources: CommoditySourceInfo[];
	factorSources: { source: string; type: string; label: string; count: number }[];
}

// ── SWR Hooks ──────────────────────────────────────────────────────────────

/** Fetch all available commodities */
export function useCommodities() {
	const { data, error, isLoading } = useSWR<{
		success: boolean;
		data: { commodities: Commodity[] };
	}>("/market/commodities", fetcher, { revalidateOnFocus: false });

	return {
		commodities: data?.data?.commodities ?? [],
		loading: isLoading,
		error,
	};
}

/** Fetch price history for a specific commodity */
export function usePriceHistory(
	slug: string | null,
	interval: "daily" | "weekly" | "monthly" = "daily",
	from?: string,
	to?: string,
) {
	const params = new URLSearchParams({ interval });
	if (from) params.set("from", from);
	if (to) params.set("to", to);

	const key = slug ? `/market/commodities/${slug}/price?${params.toString()}` : null;

	const { data, error, isLoading } = useSWR<{ data: PriceHistoryResponse }>(key, fetcher, {
		revalidateOnFocus: false,
	});

	return {
		commodity: data?.data?.commodity,
		prices: data?.data?.prices ?? [],
		loading: isLoading,
		error,
	};
}

/** Fetch latest price for a commodity */
export function useLatestPrice(slug: string | null) {
	const { data, error, isLoading } = useSWR<{ data: LatestPriceResponse }>(
		slug ? `/market/commodities/${slug}/latest` : null,
		fetcher,
		{ refreshInterval: 30_000 },
	);

	return {
		commodity: data?.data?.commodity,
		price: data?.data?.price,
		loading: isLoading,
		error,
	};
}

/** Fetch exchange rates */
export function useExchangeRates() {
	const { data, error, isLoading } = useSWR<{ data: ExchangeRateResponse }>(
		"/market/factors/exchange-rates",
		fetcher,
		{ revalidateOnFocus: false, refreshInterval: 300_000 },
	);

	return {
		rates: data?.data?.rates ?? {},
		base: data?.data?.base ?? "USD",
		loading: isLoading,
		error,
	};
}

/** Fetch all data sources and their health status */
export function useDataSources() {
	const { data, error, isLoading } = useSWR<{
		data: { sources: DataSource[]; count: number };
	}>("/market/sources", fetcher, {
		revalidateOnFocus: false,
		refreshInterval: 60_000,
	});

	return {
		sources: data?.data?.sources ?? [],
		loading: isLoading,
		error,
	};
}

/** Fetch data sources for a specific commodity */
export function useCommoditySources(slug: string | null) {
	const { data, error, isLoading } = useSWR<{
		data: CommoditySourcesResponse;
	}>(slug ? `/market/commodities/${slug}/sources` : null, fetcher, {
		revalidateOnFocus: false,
	});

	return {
		commodity: data?.data?.commodity,
		priceSources: data?.data?.priceSources ?? [],
		factorSources: data?.data?.factorSources ?? [],
		loading: isLoading,
		error,
	};
}

/** Fetch multi-source prices for comparison chart */
export function useMultiSourcePrices(slug: string | null, interval: string = "daily") {
	const { data, error, isLoading } = useSWR<{
		data: {
			commodity: { id: string; slug: string; name: string; unit: string };
			interval: string;
			sources: Record<string, Array<{ date: string; close: number }>>;
			sourceCount: number;
		};
	}>(
		slug ? `/market/commodities/${slug}/price-multi?interval=${interval}&limit=365` : null,
		fetcher,
		{ revalidateOnFocus: false },
	);

	return {
		commodity: data?.data?.commodity,
		sources: data?.data?.sources ?? {},
		sourceCount: data?.data?.sourceCount ?? 0,
		loading: isLoading,
		error,
	};
}

/** Fetch market factors (fundamentals) for a commodity */
export function useCommodityFundamentals(slug: string | null) {
	const { data, error, isLoading } = useSWR<{
		data: {
			commodity: { id: string; slug: string; category: string };
			factors: Array<{
				id: string;
				type: string;
				region: string | null;
				date: string;
				value: number;
				unit: string;
				source: string;
				metadata: Record<string, unknown> | null;
			}>;
			count: number;
		};
	}>(slug ? `/market/commodities/${slug}/fundamentals` : null, fetcher, {
		revalidateOnFocus: false,
	});

	return {
		commodity: data?.data?.commodity,
		factors: data?.data?.factors ?? [],
		loading: isLoading,
		error,
	};
}
