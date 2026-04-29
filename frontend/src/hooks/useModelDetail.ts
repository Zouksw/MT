"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthToken } from "@/utils/auth";
import type {
  BacktestResponse,
  PredictionLogResponse,
} from "@/types/accuracy";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(url: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useModelDetail(modelId: string) {
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [predictions, setPredictions] = useState<PredictionLogResponse["predictions"]>([]);
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [backtestRes, predRes] = await Promise.allSettled([
        apiFetch<{ success: boolean; data: BacktestResponse }>(
          `${API_BASE}/api/signals/models/${modelId}/backtest`
        ),
        apiFetch<{ success: boolean; data: PredictionLogResponse }>(
          `${API_BASE}/api/signals/models/${modelId}/predictions?limit=20`
        ),
      ]);

      if (backtestRes.status === "fulfilled" && backtestRes.value.data) {
        setBacktest(backtestRes.value.data);
      }
      if (predRes.status === "fulfilled" && predRes.value.data) {
        setPredictions(predRes.value.data.predictions || []);
        setTotalPredictions(predRes.value.data.total || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch model data"));
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    backtest,
    predictions,
    totalPredictions,
    loading,
    error,
    retry: fetchData,
  };
}
