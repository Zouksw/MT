"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { API_BASE } from "@/lib/config";
import type { BacktestResponse, PredictionLogResponse } from "@/types/accuracy";

export function useModelDetail(modelId: string) {
	const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
	const [predictions, setPredictions] = useState<PredictionLogResponse["predictions"]>([]);
	const [totalPredictions, setTotalPredictions] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(
		async (cancelled?: { current: boolean }) => {
			setLoading(true);
			setError(null);
			try {
				const [backtestRes, predRes] = await Promise.allSettled([
					apiFetch<{ success: boolean; data: BacktestResponse }>(
						`${API_BASE}/api/signals/models/${modelId}/backtest`,
					),
					apiFetch<{ success: boolean; data: PredictionLogResponse }>(
						`${API_BASE}/api/signals/models/${modelId}/predictions?limit=20`,
					),
				]);

				// Stale-response guard (round-06): two rapid modelId changes run
				// overlapping fetches; without this flag the first response to
				// arrive (possibly for the previous model) would overwrite the
				// new model's state. Same pattern as useTradingData's effects.
				if (cancelled?.current) return;
				if (backtestRes.status === "fulfilled" && backtestRes.value.data) {
					setBacktest(backtestRes.value.data);
				}
				if (predRes.status === "fulfilled" && predRes.value.data) {
					setPredictions(predRes.value.data.predictions || []);
					setTotalPredictions(predRes.value.data.total || 0);
				}
			} catch (e) {
				if (cancelled?.current) return;
				setError(e instanceof Error ? e : new Error("Failed to fetch model data"));
			} finally {
				if (!cancelled?.current) setLoading(false);
			}
		},
		[modelId],
	);

	useEffect(() => {
		const cancelled = { current: false };
		fetchData(cancelled);
		return () => {
			cancelled.current = true;
		};
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
