"use client";

import { useMemo } from "react";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { getAuthToken } from "@/utils/auth";
import type { Alert, Forecast } from "@/types/api";

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
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const useDashboardStats = () => {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  // If not authenticated, return immediately — don't hang in loading state
  if (!getAuthToken()) {
    return { stats: null, loading: false, error: new Error("Not authenticated"), manualRetry: () => {} };
  }

  // Use useRetryableFetch for each API endpoint with automatic retry
  const { data: datasetsData, error: datasetsError, isLoading: datasetsLoading } = useRetryableFetch(
    () => (getAuthToken() ? `${API_BASE}/datasets?page=1&limit=1` : null),
    fetcher,
    {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    }
  );

  const { data: timeseriesData, error: timeseriesError, isLoading: timeseriesLoading } = useRetryableFetch(
    () => (getAuthToken() ? `${API_BASE}/timeseries?page=1&limit=1` : null),
    fetcher,
    {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    }
  );

  const { data: forecastsData, error: forecastsError, isLoading: forecastsLoading } = useRetryableFetch(
    () => (getAuthToken() ? `${API_BASE}/models?page=1&limit=1` : null),
    fetcher,
    {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    }
  );

  const { data: alertsData, isLoading: alertsLoading } = useRetryableFetch(
    () => (getAuthToken() ? `${API_BASE}/alerts?page=1&limit=100` : null),
    fetcher,
    {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    }
  );

  const { data: recentAlertsData } = useRetryableFetch(
    () => (getAuthToken() ? `${API_BASE}/alerts?limit=5` : null),
    fetcher,
    {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    }
  );

  const { data: recentForecastsData } = useRetryableFetch(
    () => (getAuthToken() ? `${API_BASE}/models?limit=5` : null),
    fetcher,
    {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    }
  );

  // Combine loading states - using useRetryableFetch's isLoading
  const loading = datasetsLoading || timeseriesLoading || forecastsLoading || alertsLoading;

  // Derive error from individual errors - no setState needed
  const errors = [datasetsError, timeseriesError, forecastsError].filter(Boolean);
  const error = errors.length > 0 ? (errors[0] as Error) : null;

  // Calculate trends (mock data for now) - use useMemo to avoid impure function calls during render
  const mockTrends = useMemo(() => ({
    datasets: 5, // Mock trend value
    timeseries: 3, // Mock trend value
    forecasts: -8, // Mock trend value
    alerts: -12, // Mock trend value
  }), []); // Empty dependency array - calculate once

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

  const stats: DashboardStats | null = datasetsData && timeseriesData && alertsData ? {
    datasets: {
      total: datasetsData.total || datasetsData.data?.length || 0,
      trend: mockTrends.datasets,
    },
    timeseries: {
      total: timeseriesData.total || timeseriesData.data?.length || 0,
      trend: mockTrends.timeseries,
    },
    forecasts: {
      total: forecastsData.total || forecastsData.data?.length || 0,
      trend: mockTrends.forecasts,
    },
    alerts: {
      total: alertsData.total || alertsData.data?.length || 0,
      bySeverity: alertsBySeverity,
      trend: mockTrends.alerts,
    },
    aiModels: {
      active: 5, // Mock data
      total: 7,
    },
    recentAlerts: Array.isArray(recentAlertsData?.data) ? recentAlertsData.data : (recentAlertsData?.data?.alerts || recentAlertsData?.items || []),
    recentForecasts: Array.isArray(recentForecastsData?.data) ? recentForecastsData.data : (recentForecastsData?.data?.models || recentForecastsData?.items || []),
  } : null;

  // Create a manual retry function that retries all requests
  const manualRetry = () => {
    // The useRetryableFetch hooks will handle their own retries
    // This is a placeholder for a coordinated retry if needed
    window.location.reload();
  };

  return { stats, loading, error, manualRetry };
};
