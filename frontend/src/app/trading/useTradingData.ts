"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { AnomalyAlert } from "@/components/trading/AnomalyAlertBanner";
import type { ChartType } from "@/components/trading/ChartToolbar";
import type { PredictionOverlay } from "@/components/trading/ProfessionalChart";
import {
	useCommodities,
	useCommodityFundamentals,
	useCommoditySources,
	useMultiSourcePrices,
	usePriceHistory,
} from "@/lib/market-data";

const BEEF_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Timeframe = "daily" | "weekly" | "monthly";

export function useTradingData() {
	const [selectedSlug, setSelectedSlug] = useState<string>("");
	const [timeframe, setTimeframe] = useState<Timeframe>("daily");
	const [chartType, setChartType] = useState<ChartType>("candlestick");
	const [showMultiSource, setShowMultiSource] = useState(false);
	const [indicators, setIndicators] = useState({ sma20: true, sma50: true, bollinger: false });
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
	const [signal, setSignal] = useState<any>(null);
	const [signalLoading, setSignalLoading] = useState(false);
	const [bestModelId, setBestModelId] = useState<string | undefined>();
	const [error, setError] = useState<string | null>(null);
	const [predictionHistory, setPredictionHistory] = useState<
		Array<{
			id: string;
			modelId: string;
			commodityId: string;
			predictedValues: number[];
			actualValues: number[] | null;
			mape: number | null;
			confidence: number | null;
			predictedAt: string;
		}>
	>([]);
	const [previousSignalType, setPreviousSignalType] = useState<string | null>(null);
	const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
	const [predictionOverlays, setPredictionOverlays] = useState<PredictionOverlay[]>([]);

	// Beef mode state
	const [beefMode, setBeefMode] = useState(false);
	const [selectedCut, setSelectedCut] = useState<string>("");
	const [beefFactoryFilter, setBeefFactoryFilter] = useState<string>("");

	// Fetch beef cut price history when in beef mode
	const { data: beefPriceData } = useSWR(
		beefMode && selectedCut
			? `${BEEF_API}/api/beef/prices/history/${selectedCut}?days=90${beefFactoryFilter ? `&factoryCode=${beefFactoryFilter}` : ""}`
			: null,
		async (url: string) => {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status}`);
			return res.json();
		},
	);

	// Fetch beef factories for filter dropdown
	const { data: beefFactoryData } = useSWR(
		beefMode ? `${BEEF_API}/api/beef/factories` : null,
		async (url: string) => {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status}`);
			return res.json();
		},
	);

	const beefFactories = beefFactoryData?.data?.factories ?? [];
	const beefPrices = beefPriceData?.data?.prices ?? [];

	// Fetch commodity list
	const { commodities, loading: commoditiesLoading } = useCommodities();

	// Auto-select first commodity
	useEffect(() => {
		if (!beefMode && !selectedSlug && commodities.length > 0) {
			setSelectedSlug(commodities[0].slug);
		}
	}, [selectedSlug, commodities, beefMode]);

	const selected = useMemo(
		() => commodities.find((c) => c.slug === selectedSlug),
		[commodities, selectedSlug],
	);

	// Fetch price history
	const { prices, loading: pricesLoading } = usePriceHistory(selectedSlug, timeframe);

	// Fetch data source provenance
	const {
		priceSources,
		factorSources,
		loading: sourcesLoading,
	} = useCommoditySources(selectedSlug);

	// Fetch multi-source prices
	const { sources: multiSources, sourceCount } = useMultiSourcePrices(selectedSlug, timeframe);

	// Fetch market factors
	const { factors, loading: factorsLoading } = useCommodityFundamentals(selectedSlug);

	const loading = beefMode ? false : commoditiesLoading || pricesLoading;

	// Convert beef prices to chart data format
	const beefChartData = useMemo(
		() =>
			beefPrices
				.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
				.map((p: { date: string; price: number }) => ({
					time: p.date,
					open: p.price * 0.998,
					high: p.price * 1.003,
					low: p.price * 0.997,
					close: p.price,
					volume: 0,
				})),
		[beefPrices],
	);

	// Beef cut info for display
	const beefCutInfo = useMemo(() => {
		if (!selectedCut) return null;
		const prices = beefPrices;
		if (prices.length === 0) return null;
		const allP = prices.map((p: { price: number }) => p.price);
		const sources = [...new Set(prices.map((p: { source: string }) => p.source))];
		const factories = [
			...new Set(
				prices.map((p: { factory?: { code: string } }) => p.factory?.code).filter(Boolean),
			),
		];
		return {
			cutCode: selectedCut,
			displayName: selectedCut.replace(/_/g, " "),
			latestPrice: allP[allP.length - 1],
			minPrice: Math.min(...allP),
			maxPrice: Math.max(...allP),
			sources,
			factories,
		};
	}, [selectedCut, beefPrices]);

	// Beef multi-source data for MultiSourceChart
	const beefMultiSources = useMemo(() => {
		const grouped: Record<string, Array<{ date: string; close: number }>> = {};
		for (const p of beefPrices) {
			const key = `${p.source} (${p.factory?.country || "?"})`;
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push({ date: p.date, close: p.price });
		}
		return grouped;
	}, [beefPrices]);

	// Fetch AI signal when commodity changes
	const loadSignal = useCallback(async () => {
		if (!selected || prices.length === 0) return;

		const currentPrice = prices[prices.length - 1]?.close;
		if (!currentPrice) return;

		setSignalLoading(true);
		try {
			const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (token) headers.Authorization = `Bearer ${token}`;

			const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
			const [signalRes, accRes] = await Promise.allSettled([
				fetch(
					`${apiBase}/api/signals/${selected.slug}?timeseriesPath=root.trading.${selected.slug}.price&currentPrice=${currentPrice}&horizon=10`,
					{ headers },
				),
				fetch(`${apiBase}/api/signals/models/accuracy?commodityId=${selected.slug}&days=30`, {
					headers,
				}),
			]);

			if (signalRes.status === "fulfilled" && signalRes.value.ok) {
				const data = await signalRes.value.json();
				if (data.success && data.data) {
					// biome-ignore lint/suspicious/noExplicitAny: third-party library type
					setSignal((prev: any) => {
						if (prev?.type && prev.type !== data.data.type) {
							setPreviousSignalType(prev.type);
						}
						return data.data;
					});
				}
			}

			if (accRes.status === "fulfilled" && accRes.value.ok) {
				const accData = await accRes.value.json();
				if (accData.success && accData.data?.accuracy) {
					const valid = accData.data.accuracy.filter(
						(m: { avgMape: number | null }) => m.avgMape !== null,
					);
					if (valid.length > 0) {
						valid.sort((a: { avgMape: number }, b: { avgMape: number }) => a.avgMape - b.avgMape);
						setBestModelId(valid[0].modelId);
					} else {
						setBestModelId(undefined);
					}
				}
			}
		} catch {
			// Signal fetch failed — keep existing signal or null
		} finally {
			setSignalLoading(false);
		}
	}, [selected, prices]);

	useEffect(() => {
		loadSignal();
	}, [loadSignal]);

	// Fetch prediction history for selected commodity
	useEffect(() => {
		if (!selected) {
			setPredictionHistory([]);
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
				const headers: Record<string, string> = {};
				if (token) headers.Authorization = `Bearer ${token}`;
				const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

				const modelRes = await fetch(`${apiBase}/api/signals/models`, { headers });
				const modelData = await modelRes.json();
				if (!modelData.success || cancelled) return;

				const allPredictions: typeof predictionHistory = [];
				await Promise.allSettled(
					modelData.data.models.map(async (modelId: string) => {
						const res = await fetch(
							`${apiBase}/api/signals/models/${modelId}/predictions?commodityId=${selected.slug}&limit=5`,
							{ headers },
						);
						if (!res.ok) return;
						const data = await res.json();
						if (data.success && data.data?.predictions) {
							for (const p of data.data.predictions) {
								if (p.actualValues) allPredictions.push(p);
							}
						}
					}),
				);

				if (!cancelled) {
					allPredictions.sort(
						(a, b) => new Date(b.predictedAt).getTime() - new Date(a.predictedAt).getTime(),
					);
					setPredictionHistory(allPredictions.slice(0, 10));
				}
			} catch {
				// Prediction history fetch failed
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selected]);

	// Fetch anomalies when commodity changes
	useEffect(() => {
		if (!selected) {
			setAnomalies([]);
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
				const headers: Record<string, string> = { "Content-Type": "application/json" };
				if (token) headers.Authorization = `Bearer ${token}`;

				const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
				const res = await fetch(`${apiBase}/api/anomalies?commodityId=${selected.id}`, { headers });

				if (!cancelled && res.ok) {
					const data = await res.json();
					setAnomalies(data.data?.anomalies ?? data.data ?? []);
				}
			} catch {
				// Anomaly fetch failed — keep empty
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selected]);

	// Fetch prediction overlays for chart
	useEffect(() => {
		if (!selected) {
			setPredictionOverlays([]);
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
				const headers: Record<string, string> = {};
				if (token) headers.Authorization = `Bearer ${token}`;
				const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

				const res = await fetch(`${apiBase}/api/signals/${selected.slug}/predictions?horizon=10`, {
					headers,
				});
				if (!res.ok || cancelled) return;

				const data = await res.json();
				if (!data.success || !data.data?.predictions) return;

				const modelPreds = data.data.predictions;
				const modelIds = Object.keys(modelPreds);
				if (modelIds.length === 0) return;

				const first = modelPreds[modelIds[0]];
				const overlays: PredictionOverlay[] = first.timestamps
					.map((ts: number, i: number) => {
						const values = modelIds
							.map((id) => modelPreds[id].values[i])
							.filter((v: number | undefined) => v !== undefined);
						const lowers = modelIds
							.map((id) => modelPreds[id].lowerBound?.[i] ?? modelPreds[id].values[i] * 0.95)
							.filter((v: number | undefined) => v !== undefined);
						const uppers = modelIds
							.map((id) => modelPreds[id].upperBound?.[i] ?? modelPreds[id].values[i] * 1.05)
							.filter((v: number | undefined) => v !== undefined);

						if (values.length === 0) return null;

						const date = new Date(ts > 1e12 ? ts : ts * 1000);
						return {
							time: date.toISOString().split("T")[0],
							predicted: values.reduce((a: number, b: number) => a + b, 0) / values.length,
							upperBound: Math.max(...uppers),
							lowerBound: Math.min(...lowers),
						};
					})
					.filter(Boolean) as PredictionOverlay[];

				if (!cancelled) setPredictionOverlays(overlays);
			} catch {
				// Prediction overlay fetch failed — keep empty
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selected]);

	// Convert prices to chart data format
	const chartData = useMemo(
		() =>
			prices.map((p) => ({
				time: p.date,
				open: Number(p.open ?? p.close),
				high: Number(p.high ?? p.close),
				low: Number(p.low ?? p.close),
				close: Number(p.close),
				volume: Number(p.volume ?? 0),
			})),
		[prices],
	);

	const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].close : 0;

	return {
		// State
		selectedSlug,
		setSelectedSlug,
		timeframe,
		setTimeframe,
		chartType,
		setChartType,
		showMultiSource,
		setShowMultiSource,
		indicators,
		setIndicators,
		signal,
		signalLoading,
		bestModelId,
		error,
		setError,
		predictionHistory,
		previousSignalType,
		setPreviousSignalType,
		anomalies,
		beefMode,
		setBeefMode,
		selectedCut,
		setSelectedCut,
		beefFactoryFilter,
		setBeefFactoryFilter,
		// Computed
		beefFactories,
		beefPrices,
		beefChartData,
		beefCutInfo,
		beefMultiSources,
		selected,
		commodities,
		commoditiesLoading,
		prices,
		priceSources,
		factorSources,
		sourcesLoading,
		multiSources,
		sourceCount,
		factors,
		factorsLoading,
		loading,
		chartData,
		currentPrice,
		predictionOverlays,
	};
}
