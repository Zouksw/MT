"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { API_BASE } from "@/lib/config";
import type { BacktestResponse, ModelAccuracy, ModelWithBacktest } from "@/types/accuracy";
import { MIN_VERIFIED_SAMPLE, MODEL_NAME_MAP } from "@/types/accuracy";

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
		// Gate on sample size, not just non-null MAPE. A model with 1 verified
		// prediction has a "MAPE" that is really just one error measurement —
		// folding it into the platform-wide average would let an under-sampled
		// primary model (chronos during the consensus transition) drag the
		// headline figure around. Must stay in lockstep with the per-row gate in
		// the comparison table (MIN_VERIFIED_SAMPLE).
		const valid = models.filter(
			(m) =>
				m.avgMape !== null && m.avgMape !== undefined && m.verifiedCount >= MIN_VERIFIED_SAMPLE,
		);
		if (valid.length === 0) return null;
		return valid.reduce((sum, m) => sum + (m.avgMape ?? 0), 0) / valid.length;
	}, [models]);

	const bestModel = useMemo(() => {
		// Same sample-size gate: "best model" must be backed by enough verified
		// predictions to be a meaningful claim, otherwise the crown is withheld.
		const valid = models.filter(
			(m) =>
				m.avgMape !== null && m.avgMape !== undefined && m.verifiedCount >= MIN_VERIFIED_SAMPLE,
		);
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
