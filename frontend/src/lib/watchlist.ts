"use client";

import useSWR from "swr";
import { fetcher } from "./market-data";

// ── Types ──

export interface WatchlistItemQuote {
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

export interface WatchlistData {
  id: string;
  name: string;
  isDefault: boolean;
  itemCount: number;
  items: Array<{
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
  }>;
  createdAt: string;
}

// ── Hooks ──

export function useWatchlists() {
  const { data, error, mutate } = useSWR<{ success: boolean; data: { watchlists: WatchlistData[] } }>(
    "/watchlists",
    fetcher,
    { refreshInterval: 30000 },
  );

  return {
    watchlists: data?.data?.watchlists ?? [],
    loading: !data && !error,
    error,
    mutate,
  };
}

export function useWatchlistQuotes(watchlistId: string | null) {
  const { data, error } = useSWR<{ success: boolean; data: { quotes: WatchlistItemQuote[] } }>(
    watchlistId ? `/watchlists/${watchlistId}/quotes` : null,
    fetcher,
    { refreshInterval: 15000 },
  );

  return {
    quotes: data?.data?.quotes ?? [],
    loading: !data && !error,
    error,
  };
}

export interface PortfolioData {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  positionCount: number;
  positions: Array<{
    id: string;
    commodity: { slug: string; name: string; unit: string };
    side: string;
    quantity: number;
    avgEntryPrice: number;
    currentPrice: number | null;
    unrealizedPnl: number | null;
  }>;
  createdAt: string;
}

export function usePortfolios() {
  const { data, error, mutate } = useSWR<{ success: boolean; data: { portfolios: PortfolioData[] } }>(
    "/portfolios",
    fetcher,
    { refreshInterval: 30000 },
  );

  return {
    portfolios: data?.data?.portfolios ?? [],
    loading: !data && !error,
    error,
    mutate,
  };
}

export function usePortfolioPerformance(portfolioId: string | null) {
  const { data, error } = useSWR<{ success: boolean; data: { performance: {
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
    totalPnl: number;
    positionCount: number;
    longCount: number;
    shortCount: number;
    positions: Array<{
      id: string;
      commodity: { slug: string; name: string; unit: string };
      side: string;
      quantity: number;
      avgEntryPrice: number;
      currentPrice: number | null;
      unrealizedPnl: number | null;
      realizedPnl: number | null;
    }>;
  } } }>(
    portfolioId ? `/portfolios/${portfolioId}/performance` : null,
    fetcher,
    { refreshInterval: 30000 },
  );

  return {
    performance: data?.data?.performance ?? null,
    loading: !data && !error,
    error,
  };
}
