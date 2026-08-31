"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/auth";
import { type CutForecastSummary, useBeefCutForecasts } from "@/hooks/useBeefCutForecasts";
import { useBeefMonthlyConsensus } from "@/hooks/useBeefMonthlyConsensus";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { API_BASE as API_ORIGIN } from "@/lib/config";
import type { Alert, Forecast } from "@/types/api";

const API_BASE = `${API_ORIGIN}/api`;

export interface DashboardStats {
	datasets: {
		total: number;
		/** Period-over-period delta, or null when not computed (honest "no trend"
		 * instead of the previous fake `0`). The UI hides the trend badge when null. */
		trend: number | null;
	};
	timeseries: {
		total: number;
		trend: number | null;
	};
	alerts: {
		total: number;
		bySeverity: {
			info: number;
			warning: number;
			error: number;
		};
		trend: number | null;
	};
	aiModels: {
		/** Models with isActive=true in the registry (was forced equal to total — a fake). */
		active: number;
		total: number;
	};
	beef: {
		cuts: number;
		factories: number;
		prices: number;
		/** Derived from /beef/prices/latest — the live beef price board. */
		avgPrice: number | null;
		minPrice: number | null;
		maxPrice: number | null;
		/** Fraction of cuts with a latest price (0–1). */
		coverage: number | null;
		/** ISO date of the most recent price record. */
		latestDate: string | null;
		/**
		 * Average price split by factory.country per PRODUCT-SPEC §5.1
		 * (进口均价 / 国产均价 hero cards). `null` when no rows on that side.
		 * Domestic = country "CN"; imported = everything else.
		 */
		importedAvg: number | null;
		domesticAvg: number | null;
		/**
		 * Period-over-period % change in imported / domestic average, latest day
		 * vs the previous distinct day with data (PRODUCT-SPEC §5.1 ↓1.2%/↑0.5%
		 * trend badges). Computed by the backend (round-57) and surfaced here;
		 * null when either period lacks data on that origin.
		 */
		importedTrendPct: number | null;
		domesticTrendPct: number | null;
		/** Top-priced cuts for the 行情总览 hot-cuts table (max 6).
		 * `forecast` is the per-cut 7-day consensus (merged from
		 * useBeefCutForecasts) so the table can show the AI prediction column
		 * per PRODUCT-SPEC §5.1. Null when the cut isn't forecastable
		 * (stale/insufficient data) — an honest absence, not a fabricated 0. */
		hotCuts: Array<{
			cutCode: string;
			price: number;
			country: string;
			source: string;
			forecast: CutForecastSummary | null;
		}>;
	};
	/**
	 * AI 7-day consensus for the headline cut (PRODUCT-SPEC §5.1 AI 7日预测 card).
	 * Null when no predictable commodity exists. Sourced from useMarketForecasts.
	 */
	aiSummary: {
		direction: "up" | "down" | "flat";
		changePct: number;
		confidence: number;
		modelsAgree: number;
		totalModels: number;
		cutName: string;
	} | null;
	/** Latest 资讯 for the dashboard news strip (PRODUCT-SPEC §5.1 最新市场动态). */
	recentNews: Array<{
		id: string;
		title: string;
		slug: string;
		category: string;
		source: string;
		publishedAt: string;
	}>;
	recentAlerts: Alert[];
	recentForecasts: Forecast[];
}

// SWR fetcher for unauthenticated beef stats (public data)
const publicFetcher = async (url: string) => {
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
};

// Authenticated fetcher — cookie-capable. The Bearer header rides along when
// the in-memory token exists (same-tab SPA), but the HttpOnly cookie session
// must be enough on its own: after a page refresh the memory token is gone
// and this hook used to hard-throw "Not authenticated" despite a valid
// session (audit C8).
const authFetcher = async (url: string) => {
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	return response.json();
};

export const useDashboardStats = () => {
	// Session truth comes from AuthContext (cookie-verified), not from the
	// refresh-volatile memory token.
	const { status } = useAuth();
	const isAuth = status === "authenticated";
	const retryOpts = { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 };

	// Beef stats — public endpoints, always fetched. Uses the same
	// useRetryableFetch wrapper as the authed calls below so the whole hook
	// follows one fetcher pattern (was: a raw useSWR + publicFetcher mix that
	// gave these three calls no retry/backoff while siblings had it).
	const { data: cutsData } = useRetryableFetch(`${API_BASE}/beef/cuts`, publicFetcher, retryOpts);
	const { data: factoriesData } = useRetryableFetch(
		`${API_BASE}/beef/factories`,
		publicFetcher,
		retryOpts,
	);
	const { data: pricesData } = useRetryableFetch(
		`${API_BASE}/beef/prices/latest`,
		publicFetcher,
		retryOpts,
	);

	// Authenticated stats
	const {
		data: datasetsData,
		error: datasetsError,
		isLoading: datasetsLoading,
	} = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/datasets?page=1&limit=1` : null),
		authFetcher,
		retryOpts,
	);

	const {
		data: timeseriesData,
		error: timeseriesError,
		isLoading: timeseriesLoading,
	} = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/timeseries?page=1&limit=1` : null),
		authFetcher,
		retryOpts,
	);

	const {
		data: alertsData,
		error: alertsError,
		isLoading: alertsLoading,
	} = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/alerts?page=1&limit=100` : null),
		authFetcher,
		retryOpts,
	);

	// Engine model list — round-132 D6 deleted the /api/models registry, and
	// the three /api/models calls left here 404'd on every dashboard load
	// (the unguarded forecastsData.total read then crashed the whole page
	// into the error boundary). The live source of truth is
	// GET /api/inference/models — the same source /ai/predict uses; the
	// backend proxies inference-service and falls back to static ids with
	// status:"unknown" (no `available` flag) when the engine is unreachable.
	const { data: modelsData } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/inference/models` : null),
		authFetcher,
		retryOpts,
	);

	// round-119: the recent-alerts strip used to fire a SECOND request
	// (`/api/alerts?limit=5`) for data the limit=100 call above already
	// returns — same endpoint, same newest-first ordering, first page. Slice
	// from the one response instead (alertsList is parsed below).

	// Latest 资讯 for the dashboard news strip (PRODUCT-SPEC §5.1 最新市场动态).
	// Reuses the /api/news module — top 5 published, newest first.
	const { data: newsData } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/news?page=1&limit=5` : null),
		authFetcher,
		retryOpts,
	);

	const loading = !isAuth ? false : datasetsLoading || timeseriesLoading || alertsLoading;

	// round-119: alertsError joins the pool — an alerts-endpoint failure used
	// to leave `stats` null with `error` null too (alerts gate stats but its
	// error was never consumed), so the dashboard silently rendered all-zero
	// cards with no banner.
	const errors = [datasetsError, timeseriesError, alertsError].filter(Boolean);
	// Signed-out visitors are a NORMAL state for /dashboard (the page renders
	// a sign-in CTA) — reporting it as an error drew a red banner + toast on
	// top of that CTA. Only authenticated-session fetch failures are errors
	// (round-106).
	const error = !isAuth ? null : errors.length > 0 ? (errors[0] as Error) : null;

	// Period-over-period trends are not computed by the backend today. Rather
	// than fabricate `0` (which the UI rendered as a flat "0%" badge — a fake),
	// we surface `null` and the StatCard hides its trend badge entirely. When
	// a real trend source is wired (e.g. /stats/trends endpoint), replace
	// these with the computed deltas.
	const trends = useMemo(
		() => ({
			datasets: null,
			timeseries: null,
			alerts: null,
		}),
		[],
	);

	// Backend AlertSeverity enum is INFO | WARNING | ERROR (schema.prisma).
	// The old critical/high/medium/low keys never matched, so the
	// distribution chart rendered permanently empty (audit C8).
	const alertsBySeverity = {
		error: 0,
		warning: 0,
		info: 0,
	};

	const alertsList: Alert[] = Array.isArray(alertsData?.data)
		? alertsData.data
		: Array.isArray(alertsData?.data?.alerts)
			? alertsData.data.alerts
			: [];

	alertsList.forEach((alert: Alert) => {
		const severity = alert.severity?.toLowerCase();
		if (severity in alertsBySeverity) {
			alertsBySeverity[severity as keyof typeof alertsBySeverity]++;
		}
	});

	// Extract beef stats from public endpoints
	const beefCuts = cutsData?.data?.cuts ?? cutsData?.cuts ?? [];
	const beefFactories = factoriesData?.data?.factories ?? factoriesData?.factories ?? [];
	const beefPrices = pricesData?.data?.prices ?? pricesData?.prices ?? [];
	// Backend-computed origin-split trend (round-57): imported/domestic avg %
	// change vs the previous distinct day. Null when backend can't compute it
	// (no prior day) — keeps the hero trend badges honest.
	const beefTrend = pricesData?.data?.trend ?? null;

	// Derived live beef-price board from /beef/prices/latest.
	// Each record has { price, date, cutCode, factory?: { country } }. We
	// aggregate to avg/min/max, compute coverage = priced cuts / total cuts,
	// and split by origin (进口 vs 国产) per PRODUCT-SPEC §5.1. All null when no
	// data so the UI shows an honest empty state instead of fabricated numbers.
	// Memoized (round-88): the aggregation loop + Map build ran on every render
	// (SWR revalidation, local state changes in consumers). beefPrices is a
	// stable reference from SWR, so the memo skips recompute until data changes.
	const beefPriceStats = useMemo(() => {
		const pricedCuts = new Set<string>();
		let priceSum = 0;
		let priceCount = 0;
		let minPrice = Number.POSITIVE_INFINITY;
		let maxPrice = 0;
		let latestDate: string | null = null;
		// Origin split: domestic = factory.country === "CN", imported = everything
		// else (BR/AU/AR/UY/US). The split powers the 进口均价 / 国产均价 hero cards.
		let importedSum = 0;
		let importedCount = 0;
		let domesticSum = 0;
		let domesticCount = 0;
		const hotCutAccum = new Map<string, { price: number; country: string; source: string }>();
		for (const p of beefPrices as Array<{
			price?: number;
			date?: string;
			cutCode?: string;
			source?: string;
			factory?: { country?: string };
		}>) {
			const price = typeof p?.price === "number" ? p.price : Number(p?.price);
			if (!Number.isFinite(price) || price <= 0) continue;
			priceSum += price;
			priceCount += 1;
			if (price < minPrice) minPrice = price;
			if (price > maxPrice) maxPrice = price;
			if (p?.cutCode) pricedCuts.add(p.cutCode);
			const d = p?.date;
			if (d && (!latestDate || d > latestDate)) latestDate = d;

			const country = p?.factory?.country ?? "";
			if (country === "CN") {
				domesticSum += price;
				domesticCount += 1;
			} else if (country) {
				importedSum += price;
				importedCount += 1;
			}
			// Hot-cuts: keep the latest price per cutCode (first occurrence wins,
			// which is the latest because the endpoint returns newest-first).
			if (p?.cutCode && !hotCutAccum.has(p.cutCode)) {
				hotCutAccum.set(p.cutCode, {
					price,
					country: country || "—",
					source: p?.source || "",
				});
			}
		}
		return {
			avgPrice: priceCount > 0 ? priceSum / priceCount : null,
			minPrice: priceCount > 0 ? minPrice : null,
			maxPrice: priceCount > 0 ? maxPrice : null,
			coverage: beefCuts.length > 0 ? pricedCuts.size / beefCuts.length : null,
			latestDate,
			importedAvg: importedCount > 0 ? importedSum / importedCount : null,
			domesticAvg: domesticCount > 0 ? domesticSum / domesticCount : null,
			// From the backend trend (round-57); null when not computable.
			importedTrendPct: beefTrend?.importedTrendPct ?? null,
			domesticTrendPct: beefTrend?.domesticTrendPct ?? null,
			hotCuts: Array.from(hotCutAccum.entries())
				.slice(0, 6)
				.map(([cutCode, v]) => ({ cutCode, ...v, forecast: null })),
		};
	}, [beefPrices, beefCuts, beefTrend]);

	// AI models — live engine truth from /api/inference/models. `total` is the
	// engine's callable-model count; `active` counts models the engine reports
	// `available: true`. The static fallback payload omits `available`, so an
	// unreachable engine yields active=0 — availability we could not verify is
	// never claimed (round-106 honesty rule, mirrored from the backend route).
	const engineModels: Array<{ available?: boolean }> = modelsData?.models ?? [];
	const aiTotal = engineModels.length;
	const aiActive = engineModels.filter((m) => m.available === true).length;

	// AI hero card (round-138 批5): the beef MONTHLY consensus — IMF
	// PBEEFUSDM benchmark, H=1 MONTH — from the same useBeefMonthlyConsensus
	// source /beef/forecast reads, so the dashboard card and the forecast
	// center agree by construction. Replaces the first-forecastable-cut
	// 7-day summary (cut forecasts still feed the hot-cuts table below).
	// Null when the benchmark has no forecastable price / no token → honest
	// empty state on the card.
	const { forecasts: cutForecasts } = useBeefCutForecasts(7);
	const { consensus: beefConsensus } = useBeefMonthlyConsensus(1);
	const aiSummary = useMemo(() => {
		if (!beefConsensus) return null;
		return {
			direction: beefConsensus.direction,
			changePct: beefConsensus.predictedChange,
			confidence: beefConsensus.confidence,
			modelsAgree: beefConsensus.modelsAgree,
			totalModels: beefConsensus.availableModels,
			cutName: "牛肉基准 · 下月",
		};
	}, [beefConsensus]);

	// Merge the per-cut 7-day forecast into the hot-cuts table rows
	// (PRODUCT-SPEC §5.1 — the 行情总览 hot-cuts table must show the AI
	// prediction alongside the price, matching the /beef page's 7d Forecast
	// column). cutForecasts is keyed by cutCode; rows without a forecast keep
	// forecast:null (honest absence, rendered as "—" by CutForecastCell).
	const hotCutsWithForecast = useMemo(
		() =>
			beefPriceStats.hotCuts.map((c) => ({
				...c,
				forecast: cutForecasts?.[c.cutCode] ?? null,
			})),
		[beefPriceStats.hotCuts, cutForecasts],
	);

	// Latest 资讯 for the dashboard news strip (PRODUCT-SPEC §5.1 最新市场动态).
	const recentNews = useMemo(() => {
		const arr: Array<Record<string, unknown>> =
			(newsData?.data as Array<Record<string, unknown>>) ??
			(newsData?.data?.items as Array<Record<string, unknown>>) ??
			[];
		return arr.slice(0, 5).map((n) => ({
			id: String(n.id ?? ""),
			title: String(n.title ?? ""),
			slug: String(n.slug ?? ""),
			category: String(n.category ?? ""),
			source: String(n.source ?? ""),
			publishedAt: String(n.publishedAt ?? ""),
		}));
	}, [newsData]);

	const stats: DashboardStats | null = isAuth
		? datasetsData && timeseriesData && alertsData
			? {
					datasets: {
						total: datasetsData.total || datasetsData.data?.length || 0,
						trend: trends.datasets,
					},
					timeseries: {
						total: timeseriesData.total || timeseriesData.data?.length || 0,
						trend: trends.timeseries,
					},
					alerts: {
						total: alertsData.total || alertsData.data?.length || 0,
						bySeverity: alertsBySeverity,
						trend: trends.alerts,
					},
					aiModels: {
						active: aiActive,
						total: aiTotal,
					},
					beef: {
						cuts: beefCuts.length,
						factories: beefFactories.length,
						prices: beefPrices.length,
						...beefPriceStats,
						hotCuts: hotCutsWithForecast,
					},
					aiSummary,
					recentNews,
					recentAlerts: alertsList.slice(0, 5),
					// The per-user forecast-record store was deleted with the
					// round-132 registry (Prisma Forecast removed round-140); the
					// RecentActivity forecasts tab shows its honest empty state.
					recentForecasts: [],
				}
			: null
		: {
				datasets: { total: 0, trend: null },
				timeseries: { total: 0, trend: null },
				alerts: { total: 0, bySeverity: { error: 0, warning: 0, info: 0 }, trend: null },
				aiModels: { active: aiActive, total: aiTotal },
				beef: {
					cuts: beefCuts.length,
					factories: beefFactories.length,
					prices: beefPrices.length,
					...beefPriceStats,
					hotCuts: hotCutsWithForecast,
				},
				aiSummary,
				recentNews,
				recentAlerts: [],
				recentForecasts: [],
			};

	const manualRetry = () => {
		window.location.reload();
	};

	return { stats, loading, error, manualRetry };
};
