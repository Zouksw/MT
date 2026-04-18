"use client";

import useSWR from "swr";
import axios from "axios";
import { tokenManager } from "@/lib/tokenManager";

// ── API base ───────────────────────────────────────────────────────────────

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ── SWR fetcher with auth ──────────────────────────────────────────────────

export async function fetcher(url: string) {
  const token = tokenManager.getToken();
  const response = await axios.get(url, {
    baseURL: API_URL,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    withCredentials: true,
  });
  return response.data;
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

// ── SWR Hooks ──────────────────────────────────────────────────────────────

/** Fetch all available commodities */
export function useCommodities() {
  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: { commodities: Commodity[] };
  }>(
    "/market/commodities",
    fetcher,
    { revalidateOnFocus: false }
  );

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
  to?: string
) {
  const params = new URLSearchParams({ interval });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const key = slug
    ? `/market/commodities/${slug}/price?${params.toString()}`
    : null;

  const { data, error, isLoading } = useSWR<{ data: PriceHistoryResponse }>(
    key,
    fetcher,
    { revalidateOnFocus: false }
  );

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
    { refreshInterval: 30_000 }
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
    { revalidateOnFocus: false, refreshInterval: 300_000 }
  );

  return {
    rates: data?.data?.rates ?? {},
    base: data?.data?.base ?? "USD",
    loading: isLoading,
    error,
  };
}
