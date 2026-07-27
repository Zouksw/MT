"use client";

import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { tokenManager } from "@/lib/tokenManager";

/**
 * useBeefCutForecasts — fetch the batch forecast summary for all cuts.
 *
 * Consumes GET /api/beef/forecasts?horizon=7 (the layer-2 batch endpoint that
 * returns one consensus summary per forecastable cutCode). Powers the per-row
 * forecast column on the /beef Latest Cut Prices table — one fetch instead of
 * N per-cut calls.
 *
 * Returns a map cutCode → summary, or null while loading / on error. Cuts that
 * can't be forecast (stale/insufficient data) are simply absent from the map;
 * callers render nothing for them (honest absence).
 */

export type ForecastDirection = "up" | "down" | "flat";

export interface CutForecastSummary {
	direction: ForecastDirection;
	predictedChange: number;
	confidence: number;
	predictedPrice: number;
	modelsAgree: number;
	availableModels: number;
	dataPoints: number;
	horizon: number;
}

interface BatchResponse {
	forecasts: Record<string, CutForecastSummary>;
	count: number;
	horizon: number;
}

import { API_BASE } from "@/lib/config";

async function batchFetcher(url: string): Promise<{ data: BatchResponse }> {
	const token = tokenManager.getToken();
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${API_BASE}${url}`, { headers, credentials: "include" });
	if (!res.ok) throw new Error(`${res.status}`);
	return res.json();
}

export function useBeefCutForecasts(horizon = 7) {
	const { data, error, isLoading } = useRetryableFetch(
		`/api/beef/forecasts?horizon=${horizon}`,
		batchFetcher,
	);
	// Failures (incl. 401 unauth) → null map; the table just omits the column.
	const forecasts = error ? null : (data?.data?.forecasts ?? null);
	return { forecasts, isLoading };
}
