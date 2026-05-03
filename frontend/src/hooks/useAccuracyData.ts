"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BacktestResponse, ModelAccuracy, ModelWithBacktest } from "@/types/accuracy";
import { MODEL_NAME_MAP } from "@/types/accuracy";
import { getAuthToken } from "@/utils/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(url: string): Promise<T> {
	const token = getAuthToken();
	const res = await fetch(url, {
		headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

export function useAccuracyData() {
	const [accuracy, setAccuracy] = useState<ModelAccuracy[]>([]);
	const [backtests, setBacktests] = useState<Map<string, BacktestResponse>>(new Map());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiFetch<{
				success: boolean;
				data: { accuracy: ModelAccuracy[]; days: number };
			}>(`${API_BASE}/api/signals/models/accuracy`);
			const accuracyData = res.data?.accuracy || res.data || [];
			const list = Array.isArray(accuracyData) ? accuracyData : [];
			setAccuracy(list);

			const backtestMap = new Map<string, BacktestResponse>();
			const results = await Promise.allSettled(
				list.map((m) =>
					apiFetch<{
						success: boolean;
						data: BacktestResponse;
					}>(`${API_BASE}/api/signals/models/${m.modelId}/backtest`).then((r) => ({
						modelId: m.modelId,
						data: r.data,
					})),
				),
			);
			for (const r of results) {
				if (r.status === "fulfilled" && r.value.data) {
					backtestMap.set(r.value.modelId, r.value.data);
				}
			}
			setBacktests(backtestMap);
		} catch (e) {
			setError(e instanceof Error ? e : new Error("Failed to fetch accuracy"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const models: ModelWithBacktest[] = useMemo(() => {
		return accuracy.map((m) => ({
			...m,
			displayName: MODEL_NAME_MAP[m.modelId] || m.modelId,
			backtest: backtests.get(m.modelId),
		}));
	}, [accuracy, backtests]);

	const overallAccuracy = useMemo(() => {
		const valid = models.filter((m) => m.avgMape !== null && m.avgMape !== undefined);
		if (valid.length === 0) return null;
		return valid.reduce((sum, m) => sum + (m.avgMape ?? 0), 0) / valid.length;
	}, [models]);

	const bestModel = useMemo(() => {
		const valid = models.filter((m) => m.avgMape !== null && m.avgMape !== undefined);
		if (valid.length === 0) return null;
		return valid.reduce((best, m) =>
			(m.avgMape ?? Infinity) < (best.avgMape ?? Infinity) ? m : best,
		);
	}, [models]);

	const totalPredictions = useMemo(
		() => models.reduce((sum, m) => sum + m.predictionCount, 0),
		[models],
	);
	const totalVerified = useMemo(
		() => models.reduce((sum, m) => sum + m.verifiedCount, 0),
		[models],
	);

	return {
		models,
		overallAccuracy,
		bestModel,
		totalPredictions,
		totalVerified,
		loading,
		error,
		retry: fetchData,
	};
}
