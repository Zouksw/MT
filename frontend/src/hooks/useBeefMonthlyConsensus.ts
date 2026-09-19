"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

export interface BeefMonthlyConsensus {
	direction: "up" | "down" | "flat";
	/** Consensus % change vs the latest close (end of horizon). */
	predictedChange: number;
	currentPrice: number;
	predictedPrice: number;
	/** 0-1 weighted-agreement confidence from the consensus machinery. */
	confidence: number;
	modelsAgree: number;
	totalModels: number;
	availableModels: number;
	/** Min/max across voting models — the model-disagreement spread. */
	rangeLower: number;
	rangeUpper: number;
	/**
	 * Backtest-calibrated 90% band around predictedPrice (round-164 批0b) —
	 * present only when the backend's calibration gates pass (beef monthly
	 * benchmark, H=1/3); null keeps the disagreement-only labeling.
	 */
	calibratedInterval: {
		lower: number;
		upper: number;
		level: number;
		sampleSize: number;
		source: string;
	} | null;
	/** Steps (MONTHS on a monthly series, ADR-0001). */
	horizon: number;
	horizonUnit: "day" | "month";
	timestamp: string;
}

/**
 * Beef monthly consensus (round-138 批5) — the ONE source both the
 * /beef/forecast consensus card and the dashboard hero AI card read: same
 * endpoint (`/api/signals/beef_carcass_us?horizon=1`), same server-side
 * cache, so the two surfaces agree by construction. horizon=1 on the monthly
 * IMF PBEEFUSDM benchmark = NEXT MONTH. Null (not a fake) when the series
 * has no forecastable price or the call fails.
 */
export function useBeefMonthlyConsensus(horizon = 1) {
	const [consensus, setConsensus] = useState<BeefMonthlyConsensus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiFetch<{
				data: Record<string, unknown> & {
					range?: { lower?: number; upper?: number };
					calibratedInterval?: {
						lower?: number;
						upper?: number;
						level?: number;
						sampleSize?: number;
						source?: string;
					};
				};
			}>(`/api/signals/beef_carcass_us?horizon=${horizon}`);
			const d = res.data;
			if (!d || d.insufficientData || d.direction == null) {
				setConsensus(null);
				return;
			}
			setConsensus({
				direction: d.direction as BeefMonthlyConsensus["direction"],
				predictedChange: Number(d.predictedChange ?? 0),
				currentPrice: Number(d.currentPrice ?? 0),
				predictedPrice: Number(d.predictedPrice ?? 0),
				confidence: Number(d.confidence ?? 0),
				modelsAgree: Number(d.modelsAgree ?? 0),
				totalModels: Number(d.totalModels ?? 0),
				availableModels: Number(d.availableModels ?? 0),
				rangeLower: Number(d.range?.lower ?? 0),
				rangeUpper: Number(d.range?.upper ?? 0),
				calibratedInterval:
					d.calibratedInterval && Number.isFinite(Number(d.calibratedInterval.lower))
						? {
								lower: Number(d.calibratedInterval.lower),
								upper: Number(d.calibratedInterval.upper),
								level: Number(d.calibratedInterval.level ?? 0.9),
								sampleSize: Number(d.calibratedInterval.sampleSize ?? 0),
								source: String(d.calibratedInterval.source ?? ""),
							}
						: null,
				horizon: Number(d.horizon ?? horizon),
				horizonUnit: (d.horizonUnit ?? "month") as BeefMonthlyConsensus["horizonUnit"],
				timestamp: String(d.timestamp ?? ""),
			});
		} catch (e) {
			setError(e instanceof Error ? e : new Error("Failed to fetch beef consensus"));
		} finally {
			setLoading(false);
		}
	}, [horizon]);

	useEffect(() => {
		load();
	}, [load]);

	return { consensus, loading, error, retry: load };
}
