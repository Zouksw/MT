"use client";

import { useMemo } from "react";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import type { Alert, Forecast } from "@/types/api";
import { getAuthToken } from "@/utils/auth";

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
	recentAlerts: Alert[];
	recentForecasts: Forecast[];
}

// SWR fetcher function
const fetcher = async (url: string) => {
	const token = getAuthToken();
	if (!token) {
		throw new Error("Not authenticated");
	}

	const response = await fetch(url, {
		credentials: "include",
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return response.json();
};

export const useDashboardStats = () => {
	const API_BASE = process.env.NEXT_PUBLIC_API_URL
		? `${process.env.NEXT_PUBLIC_API_URL}/api`
		: "http://localhost:8000/api";
	const isAuth = !!getAuthToken();

	const retryOpts = { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 };

	const {
		data: datasetsData,
		error: datasetsError,
		isLoading: datasetsLoading,
	} = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/datasets?page=1&limit=1` : null),
		fetcher,
		retryOpts,
	);

	const {
		data: timeseriesData,
		error: timeseriesError,
		isLoading: timeseriesLoading,
	} = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/timeseries?page=1&limit=1` : null),
		fetcher,
		retryOpts,
	);

	const {
		data: forecastsData,
		error: forecastsError,
		isLoading: forecastsLoading,
	} = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/models?page=1&limit=1` : null),
		fetcher,
		retryOpts,
	);

	const { data: alertsData, isLoading: alertsLoading } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/alerts?page=1&limit=100` : null),
		fetcher,
		retryOpts,
	);

	const { data: recentAlertsData } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/alerts?limit=5` : null),
		fetcher,
		retryOpts,
	);

	const { data: recentForecastsData } = useRetryableFetch(
		() => (isAuth ? `${API_BASE}/models?limit=5` : null),
		fetcher,
		retryOpts,
	);

	// Combine loading states - using useRetryableFetch's isLoading
	const loading = !isAuth
		? false
		: datasetsLoading || timeseriesLoading || forecastsLoading || alertsLoading;

	// Derive error from individual errors - no setState needed
	const errors = [datasetsError, timeseriesError, forecastsError].filter(Boolean);
	const error = !isAuth
		? new Error("Not authenticated")
		: errors.length > 0
			? (errors[0] as Error)
			: null;

	// No historical data to compute real trends yet — show zero until data accumulates
	const trends = useMemo(
		() => ({
			datasets: 0,
			timeseries: 0,
			forecasts: 0,
			alerts: 0,
		}),
		[],
	);

	// Count alerts by severity
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

	const stats: DashboardStats | null =
		datasetsData && timeseriesData && alertsData
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
					recentAlerts: Array.isArray(recentAlertsData?.data)
						? recentAlertsData.data
						: recentAlertsData?.data?.alerts || recentAlertsData?.items || [],
					recentForecasts: Array.isArray(recentForecastsData?.data)
						? recentForecastsData.data
						: recentForecastsData?.data?.models || recentForecastsData?.items || [],
				}
			: null;

	// Create a manual retry function that retries all requests
	const manualRetry = () => {
		// The useRetryableFetch hooks will handle their own retries
		// This is a placeholder for a coordinated retry if needed
		window.location.reload();
	};

	return { stats, loading, error, manualRetry };
};
