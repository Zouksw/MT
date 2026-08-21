"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { AnomalyAlert } from "@/components/trading/AnomalyAlertBanner";
import type { ChartType } from "@/components/trading/ChartToolbar";
import type { PredictionOverlay } from "@/components/trading/ProfessionalChart";
import { API_BASE } from "@/lib/config";
import {
	useCommodities,
	useCommodityFundamentals,
	useCommoditySources,
	useMultiSourcePrices,
	usePriceHistory,
} from "@/lib/market-data";

const BEEF_API = API_BASE;

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
	const [previousDirection, setPreviousDirection] = useState<string | null>(null);
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

	// Auto-select first commodity (or beef commodity in beef mode for AI signals)
	useEffect(() => {
		if (beefMode && !selectedSlug) {
			// Select beef_cutout_us for AI signal context while showing cut prices
			setSelectedSlug("beef_cutout_us");
		} else if (!beefMode && !selectedSlug && commodities.length > 0) {
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

	// Convert beef prices to chart data format. The backend returns prices
	// ordered date DESC (newest first); charts need ascending time. Slice before
	// sorting so we do NOT mutate the SWR-cached array (an in-place .sort() would
	// reorder the shared cache object every revalidation, breaking referential-
	// equality checks SWR relies on and corrupting other memos reading it).
	const beefChartData = useMemo(
		() =>
			beefPrices
				.slice()
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

	// Beef cut info for display. The backend returns prices ordered date DESC
	// (newest first). Derive latestPrice explicitly by date rather than relying
	// on array position — previously latestPrice read allP[last], which only
	// happened to be newest because beefChartData's in-place .sort() mutated the
	// shared cache into ascending order first (an order-dependent footgun).
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
		// Pick the row with the max date — order-independent "latest".
		let latest = prices[0];
		for (const p of prices) {
			if (p.date > latest.date) latest = p;
		}
		return {
			cutCode: selectedCut,
			displayName: selectedCut.replace(/_/g, " "),
			latestPrice: latest.price,
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

	// Commodity switch hygiene (round-106): a failed fetch for the NEW
	// commodity previously left the OLD commodity's signal / anomalies /
	// prediction history / chart overlays on screen, attributed to the new
	// selection — wrong data on the core trading page. Clear all
	// commodity-scoped AI state whenever the selection changes; the
	// loaders below repopulate whatever succeeds.
	useEffect(() => {
		setSignal(null);
		setPreviousDirection(null);
		setBestModelId(undefined);
		setPredictionHistory([]);
		setAnomalies([]);
		setPredictionOverlays([]);
	}, []);

	// Fetch AI signal when commodity changes
	const loadSignal = useCallback(
		async (signal?: AbortSignal) => {
			if (!selected || prices.length === 0) return;

			const currentPrice = prices[prices.length - 1]?.close;
			if (!currentPrice) return;

			setSignalLoading(true);
			try {
				const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
				const headers: Record<string, string> = { "Content-Type": "application/json" };
				if (token) headers.Authorization = `Bearer ${token}`;

				const apiBase = API_BASE;
				const [signalRes, accRes] = await Promise.allSettled([
					fetch(
						`${apiBase}/api/signals/${selected.slug}?timeseriesPath=root.trading.${selected.slug}.price&currentPrice=${currentPrice}&horizon=10`,
						{ headers, signal },
					),
					fetch(`${apiBase}/api/signals/models/accuracy?commodityId=${selected.slug}&days=30`, {
						headers,
						signal,
					}),
				]);

				if (signalRes.status === "fulfilled" && signalRes.value.ok) {
					const data = await signalRes.value.json();
					if (data.success && data.data) {
						// Clear any stale error from a previous failed fetch now
						// that the signal loaded successfully.
						setError(null);
						// biome-ignore lint/suspicious/noExplicitAny: third-party library type
						setSignal((prev: any) => {
							if (prev?.direction && prev.direction !== data.data.direction) {
								setPreviousDirection(prev.direction);
							}
							return data.data;
						});
					}
				}

				if (accRes.status === "fulfilled" && accRes.value.ok) {
					const accData = await accRes.value.json();
					if (accData.success && accData.data?.accuracy) {
						const rows = accData.data.accuracy as Array<{
							modelId: string;
							avgMape: number | null;
							medianMape?: number | null;
						}>;
						// Robust stat (round-115): median with mean fallback — the
						// mean alone is poisoned by unit-mismatch outliers.
						const stat = (m: { avgMape: number | null; medianMape?: number | null }) =>
							m.medianMape ?? m.avgMape ?? null;
						const valid = rows.filter((m) => stat(m) !== null);
						if (valid.length > 0) {
							valid.sort((a, b) => (stat(a) ?? Infinity) - (stat(b) ?? Infinity));
							setBestModelId(valid[0].modelId);
						} else {
							setBestModelId(undefined);
						}
					}
				}
			} catch (err) {
				// Aborted requests throw AbortError — that's expected on fast commodity
				// switches and must NOT clear loading state of the in-flight request.
				if (err instanceof DOMException && err.name === "AbortError") return;
				// Signal fetch failed — surface it so the trading page's ErrorDisplay
				// can tell the user the AI signal is unavailable (previously this was
				// swallowed, rendering a blank signal column with no explanation).
				setError(
					err instanceof Error ? `AI signal unavailable: ${err.message}` : "AI signal unavailable",
				);
			} finally {
				setSignalLoading(false);
			}
		},
		[selected, prices],
	);

	useEffect(() => {
		const controller = new AbortController();
		loadSignal(controller.signal);
		return () => controller.abort();
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
				const apiBase = API_BASE;

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

				const apiBase = API_BASE;
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
				const apiBase = API_BASE;

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
				// Guard (round-97): the predictions map is typed as any (Redis
				// cache contract, not schema-validated on the wire). If a model
				// entry lacks timestamps/values, the unguarded .map would throw.
				// The surrounding try/catch swallows it, but this guard prevents
				// the overlay feature from silently breaking on a partial entry.
				if (!first?.timestamps || !first?.values) return;
				const overlays: PredictionOverlay[] = first.timestamps
					.map((ts: number, i: number) => {
						const values = modelIds
							.map((id) => modelPreds[id]?.values?.[i])
							.filter((v: number | undefined) => v !== undefined);
						const lowers = modelIds
							.map((id) => modelPreds[id]?.lowerBound?.[i] ?? modelPreds[id]?.values?.[i] * 0.95)
							.filter((v: number | undefined) => v !== undefined);
						const uppers = modelIds
							.map((id) => modelPreds[id]?.upperBound?.[i] ?? modelPreds[id]?.values?.[i] * 1.05)
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
		previousDirection,
		setPreviousDirection,
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
