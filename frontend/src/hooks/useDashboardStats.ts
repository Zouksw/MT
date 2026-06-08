"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import type { Alert, Forecast } from "@/types/api";
import { getAuthToken } from "@/utils/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
	? `${process.env.NEXT_PUBLIC_API_URL}/api`
	: "http://localhost:8000/api";

export interface DashboardStats {
	datasets: {
		total: number;
		trend: number;
	};
	timeseries: {
		total: number;
		trend: number;
	};
	forecasts: {
		total: number;
		trend: number;
	};
	alerts: {
		total: number;
		bySeverity: {
			critical: number;
			high: number;
			medium: number;
			low: number;
		};
		trend: number;
	};
	aiModels: {
		active: number;
		total: number;
	};
	beef: {
		cuts: number;
		factories: number;
		prices: number;
	};
	recentAlerts: Alert[];
	recentForecasts: Forecast[];
}

// SWR fetcher for unauthenticated beef stats (public data)
const publicFetcher = async (url: string) => {
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
};

// Authenticated fetcher
const authFetcher = async (url: string) => {
	const token = getAuthToken();
	if (!token) throw new Error("Not authenticated");

	const response = await fetch(url, {
		credentials: "include",
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	return response.json();
};

export const useDashboardStats = () => {
	const isAuth = !!getAuthToken();
	const retryOpts = { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 };

	// Beef stats — public endpoints, always fetched
	const { data: cutsData } = useSWR(`${API_BASE}/beef/cuts`, publicFetcher, {
		revalidateOnFocus: false,
	});
	const { data: factoriesData } = useSWR(`${API_BASE}/beef/factories`, publicFetcher, {
		revalidateOnFocus: false,
	});
	const { data: pricesData } = useSWR(`${API_BASE}/beef/prices/latest`, publicFetcher, {
		revalidateOnFocus: false,
	});

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
		data: forecastsData,
		error: forecastsError,
		isLoading: forecastsLoading,
	} = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/models?page=1&limit=1` : null),
		authFetcher,
		retryOpts,
	);

	const { data: alertsData, isLoading: alertsLoading } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/alerts?page=1&limit=100` : null),
		authFetcher,
		retryOpts,
	);

	const { data: recentAlertsData } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/alerts?limit=5` : null),
		authFetcher,
		retryOpts,
	);

	const { data: recentForecastsData } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/models?limit=5` : null),
		authFetcher,
		retryOpts,
	);

	const loading = !isAuth
		? false
		: datasetsLoading || timeseriesLoading || forecastsLoading || alertsLoading;

	const errors = [datasetsError, timeseriesError, forecastsError].filter(Boolean);
	const error = !isAuth
		? new Error("Not authenticated")
		: errors.length > 0
			? (errors[0] as Error)
			: null;

	const trends = useMemo(
		() => ({
			datasets: 0,
			timeseries: 0,
			forecasts: 0,
			alerts: 0,
		}),
		[],
	);

	const alertsBySeverity = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0,
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
					forecasts: {
						total: forecastsData.total || forecastsData.data?.length || 0,
						trend: trends.forecasts,
					},
					alerts: {
						total: alertsData.total || alertsData.data?.length || 0,
						bySeverity: alertsBySeverity,
						trend: trends.alerts,
					},
					aiModels: {
						active: 8,
						total: 8,
					},
					beef: {
						cuts: beefCuts.length,
						factories: beefFactories.length,
						prices: beefPrices.length,
					},
					recentAlerts: Array.isArray(recentAlertsData?.data)
						? recentAlertsData.data
						: recentAlertsData?.data?.alerts || recentAlertsData?.items || [],
					recentForecasts: Array.isArray(recentForecastsData?.data)
						? recentForecastsData.data
						: recentForecastsData?.data?.models || recentForecastsData?.items || [],
				}
			: null
		: {
				datasets: { total: 0, trend: 0 },
				timeseries: { total: 0, trend: 0 },
				forecasts: { total: 0, trend: 0 },
				alerts: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, trend: 0 },
				aiModels: { active: 8, total: 8 },
				beef: {
					cuts: beefCuts.length,
					factories: beefFactories.length,
					prices: beefPrices.length,
				},
				recentAlerts: [],
				recentForecasts: [],
			};

	const manualRetry = () => {
		window.location.reload();
	};

	return { stats, loading, error, manualRetry };
};
