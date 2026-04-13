"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Row,
  Col,
  Button,
  Switch,
  Typography,
  Spin,
  Select,
  Table,
  Tag,
} from "antd";
import {
  ClockCircleOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  ReloadOutlined,
  DashboardOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import dynamic from "next/dynamic";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ContentCard } from "@/components/layout/ContentCard";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { useIsMobile } from "@/lib/responsive-utils";
import { getAuthToken } from "@/utils/auth";

const { Text } = Typography;

// Dynamic imports for Recharts (heavy library, ~200KB)
const LineChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.LineChart })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    ),
    ssr: false,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

const Line = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Line })),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

const XAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.XAxis })),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

const YAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.YAxis })),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

const Tooltip = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Tooltip })),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

const Legend = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Legend })),
  { ssr: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as React.ComponentType<any>;

// --- Types ---

interface MemoryPoint {
  time: string;
  heapUsedMB: number;
  rssMB: number;
}

interface DistributionPoint {
  range: string;
  count: number;
}

interface ServerMetricsData {
  timestamp: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  memory: {
    rss: number;
    rssFormatted: string;
    heapTotal: number;
    heapTotalFormatted: string;
    heapUsed: number;
    heapUsedFormatted: string;
    external: number;
    heapUsagePercent: number;
  };
  cpu: {
    userMicroseconds: number;
    systemMicroseconds: number;
    userMs: number;
    systemMs: number;
  };
  requests: {
    total: number;
    avgResponseTime: number;
  };
  responseTimeDistribution: DistributionPoint[];
}

interface WebVitalStat {
  avg: number;
  p50: number;
  p95: number;
  count: number;
}

interface WebVitalsSummary {
  lcp: WebVitalStat;
  fid: WebVitalStat;
  cls: WebVitalStat;
  ttfb: WebVitalStat;
  inp: WebVitalStat;
}

interface HistoryPoint {
  timestamp: number;
  avg: number;
  p95: number;
  count: number;
}

interface ApiLatencyData {
  overall: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  endpoints: Record<
    string,
    {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
      count: number;
    }
  >;
}

// --- Constants ---

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const POLL_INTERVAL_MS = 30_000;
const MAX_HISTORY_POINTS = 60;

// --- Fetch helpers ---

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchServerMetrics(): Promise<ServerMetricsData> {
  const response = await fetch(`${API_BASE}/metrics`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json();
  return json.data;
}

async function fetchWebVitalsSummary(period: string): Promise<WebVitalsSummary> {
  const response = await fetch(`${API_BASE}/metrics/web-vitals?period=${period}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json();
  return json.data;
}

async function fetchWebVitalsHistory(
  metric: string,
  period: string,
  interval: string
): Promise<HistoryPoint[]> {
  const params = new URLSearchParams({ metric, period, interval });
  const response = await fetch(`${API_BASE}/metrics/web-vitals/history?${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json();
  return json.data;
}

async function fetchApiLatency(): Promise<ApiLatencyData> {
  const response = await fetch(`${API_BASE}/metrics/api-latency`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json();
  return json.data;
}

// --- Color helpers ---

function lcpColor(value: number): "success" | "warning" | "error" {
  if (value <= 2500) return "success";
  if (value <= 4000) return "warning";
  return "error";
}

function clsColor(value: number): "success" | "warning" | "error" {
  if (value <= 0.1) return "success";
  if (value <= 0.25) return "warning";
  return "error";
}

function latencyColor(value: number): "success" | "warning" | "error" {
  if (value <= 200) return "success";
  if (value <= 500) return "warning";
  return "error";
}

function ratingTag(value: number, thresholds: [number, number]) {
  if (value <= thresholds[0]) {
    return (
      <Tag color="green" icon={<CheckCircleOutlined />}>
        Good
      </Tag>
    );
  }
  if (value <= thresholds[1]) {
    return (
      <Tag color="orange" icon={<WarningOutlined />}>
        Needs Improvement
      </Tag>
    );
  }
  return (
    <Tag color="red" icon={<WarningOutlined />}>
      Poor
    </Tag>
  );
}

// --- Main Component ---

export default function PerformancePage() {
  const isMobile = useIsMobile();

  // Data state
  const [metrics, setMetrics] = useState<ServerMetricsData | null>(null);
  const [webVitals, setWebVitals] = useState<WebVitalsSummary | null>(null);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [apiLatency, setApiLatency] = useState<ApiLatencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Period selectors
  const [wvPeriod, setWvPeriod] = useState<string>("24h");
  const [historyMetric, setHistoryMetric] = useState<string>("LCP");
  const [historyPeriod, setHistoryPeriod] = useState<string>("24h");

  // Memory history for the line chart
  const [memoryHistory, setMemoryHistory] = useState<MemoryPoint[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      const [serverData, wvData, latencyData, histData] = await Promise.allSettled([
        fetchServerMetrics(),
        fetchWebVitalsSummary(wvPeriod),
        fetchApiLatency(),
        fetchWebVitalsHistory(historyMetric, historyPeriod, "1h"),
      ]);

      if (serverData.status === "fulfilled") {
        setMetrics(serverData.value);

        const timeLabel = new Date(serverData.value.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        setMemoryHistory((prev) => {
          const next = [
            ...prev,
            {
              time: timeLabel,
              heapUsedMB: parseFloat(
                (serverData.value.memory.heapUsed / 1024 / 1024).toFixed(2)
              ),
              rssMB: parseFloat(
                (serverData.value.memory.rss / 1024 / 1024).toFixed(2)
              ),
            },
          ];
          return next.length > MAX_HISTORY_POINTS
            ? next.slice(next.length - MAX_HISTORY_POINTS)
            : next;
        });
      }

      if (wvData.status === "fulfilled") {
        setWebVitals(wvData.value);
      }
      if (latencyData.status === "fulfilled") {
        setApiLatency(latencyData.value);
      }
      if (histData.status === "fulfilled") {
        setHistoryData(histData.value);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch metrics"));
    } finally {
      setLoading(false);
    }
  }, [wvPeriod, historyMetric, historyPeriod]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh) {
      intervalRef.current = setInterval(loadData, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, loadData]);

  // --- Derived values ---

  const uptimeDisplay = metrics?.uptime.formatted ?? "--";
  const memoryDisplay = metrics?.memory.heapUsedFormatted ?? "--";
  const memoryPercent = metrics?.memory.heapUsagePercent ?? 0;
  const requestCount = metrics?.requests.total ?? 0;
  const avgResponseTime = metrics?.requests.avgResponseTime ?? 0;

  const lcpAvg = webVitals?.lcp.avg ?? 0;
  const clsAvg = webVitals?.cls.avg ?? 0;
  const apiP95 = apiLatency?.overall.p95 ?? 0;
  const errorRate = 0; // Derived from summary when available

  // --- Stat cards (top row) ---

  const statCards = [
    {
      title: "LCP (Largest Contentful Paint)",
      value: lcpAvg > 0 ? `${(lcpAvg / 1000).toFixed(2)}s` : "--",
      icon: <DashboardOutlined />,
      variant: lcpAvg > 0 ? lcpColor(lcpAvg) : ("default" as const),
      sparklineData: undefined,
    },
    {
      title: "CLS (Cumulative Layout Shift)",
      value: clsAvg > 0 ? clsAvg.toFixed(3) : "--",
      icon: <WarningOutlined />,
      variant: clsAvg > 0 ? clsColor(clsAvg) : ("default" as const),
      sparklineData: undefined,
    },
    {
      title: "API Latency (p95)",
      value: apiP95 > 0 ? `${apiP95} ms` : "--",
      icon: <ApiOutlined />,
      variant: apiP95 > 0 ? latencyColor(apiP95) : ("default" as const),
      sparklineData: undefined,
    },
    {
      title: "Error Rate",
      value: `${errorRate}%`,
      icon: <WarningOutlined />,
      variant: errorRate > 5 ? ("error" as const) : errorRate > 1 ? ("warning" as const) : ("success" as const),
      sparklineData: undefined,
    },
  ];

  // --- Server stat cards (second row) ---

  const serverStatCards = [
    {
      title: "Uptime",
      value: uptimeDisplay,
      icon: <ClockCircleOutlined />,
      variant: "primary" as const,
      sparklineData: undefined,
    },
    {
      title: "Memory (Heap)",
      value: memoryDisplay,
      icon: <DatabaseOutlined />,
      variant: (memoryPercent > 80 ? "error" : memoryPercent > 60 ? "warning" : "success") as
        | "success"
        | "warning"
        | "error",
      sparklineData: memoryHistory.slice(-12).map((p) => p.heapUsedMB),
    },
    {
      title: "Request Count",
      value: requestCount,
      icon: <ApiOutlined />,
      variant: "default" as const,
      sparklineData: undefined,
    },
    {
      title: "Avg Response Time",
      value: `${avgResponseTime} ms`,
      icon: <ThunderboltOutlined />,
      variant: (avgResponseTime > 500 ? "error" : avgResponseTime > 200 ? "warning" : "success") as
        | "success"
        | "warning"
        | "error",
      sparklineData: undefined,
    },
  ];

  // --- Breadcrumbs ---

  const breadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Dashboard", href: "/dashboard" },
    { title: "Performance" },
  ];

  // --- Actions ---

  const headerActions = (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Text className="!text-sm !text-gray-500 dark:!text-gray-400">Auto-refresh</Text>
        <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
      </div>
      <Button
        icon={<ReloadOutlined spin={loading} />}
        onClick={loadData}
        size="small"
      >
        Refresh
      </Button>
    </div>
  );

  // --- Tooltip styles ---

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    padding: "10px 14px",
    fontSize: 13,
  };

  // --- API Latency Table columns ---

  const endpointColumns = [
    {
      title: "Endpoint",
      dataIndex: "endpoint",
      key: "endpoint",
      render: (text: string) => (
        <span className="font-mono text-sm">{text}</span>
      ),
    },
    {
      title: "Avg (ms)",
      dataIndex: "avg",
      key: "avg",
      render: (val: number) => (
        <span style={{ color: latencyColor(val) === "error" ? "#EF4444" : "inherit" }}>
          {val.toFixed(1)}
        </span>
      ),
      sorter: (a: EndpointRow, b: EndpointRow) => a.avg - b.avg,
    },
    {
      title: "P50 (ms)",
      dataIndex: "p50",
      key: "p50",
      render: (val: number) => val.toFixed(1),
      sorter: (a: EndpointRow, b: EndpointRow) => a.p50 - b.p50,
    },
    {
      title: "P95 (ms)",
      dataIndex: "p95",
      key: "p95",
      render: (val: number) => (
        <span style={{ color: latencyColor(val) === "error" ? "#EF4444" : "inherit" }}>
          {val.toFixed(1)}
        </span>
      ),
      sorter: (a: EndpointRow, b: EndpointRow) => a.p95 - b.p95,
    },
    {
      title: "P99 (ms)",
      dataIndex: "p99",
      key: "p99",
      render: (val: number) => (
        <span style={{ color: latencyColor(val) === "error" ? "#EF4444" : "inherit" }}>
          {val.toFixed(1)}
        </span>
      ),
      sorter: (a: EndpointRow, b: EndpointRow) => a.p99 - b.p99,
    },
    {
      title: "Requests",
      dataIndex: "count",
      key: "count",
      sorter: (a: EndpointRow, b: EndpointRow) => a.count - b.count,
    },
  ];

  // Transform API latency endpoints into table rows
  interface EndpointRow {
    key: string;
    endpoint: string;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    count: number;
  }

  const endpointTableData: EndpointRow[] = apiLatency
    ? Object.entries(apiLatency.endpoints).map(([ep, data]) => ({
        key: ep,
        endpoint: ep,
        avg: data.avg,
        p50: data.p50,
        p95: data.p95,
        p99: data.p99,
        count: data.count,
      }))
    : [];

  // --- Web Vitals History chart data ---

  const chartData = historyData.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    avg: parseFloat(point.avg.toFixed(2)),
    p95: parseFloat(point.p95.toFixed(2)),
    count: point.count,
  }));

  // --- Period selector options ---

  const periodOptions = [
    { value: "1h", label: "1 hour" },
    { value: "6h", label: "6 hours" },
    { value: "24h", label: "24 hours" },
    { value: "7d", label: "7 days" },
  ];

  const metricOptions = [
    { value: "LCP", label: "LCP" },
    { value: "FID", label: "FID" },
    { value: "CLS", label: "CLS" },
    { value: "TTFB", label: "TTFB" },
    { value: "INP", label: "INP" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Performance Monitoring"
        description="Real-time server metrics and Web Vitals dashboard"
        breadcrumbs={breadcrumbs}
        actions={headerActions}
      />

      {/* Error Display */}
      {error && <ErrorDisplay error={error} retry={loadData} context="Performance Metrics" />}

      {/* Web Vitals Summary Cards */}
      <Row
        gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
        style={{ marginBottom: isMobile ? 8 : 12 }}
      >
        {statCards.map((stat, index) => (
          <Col xs={12} sm={12} md={6} key={`wv-${index}`}>
            <StatCard {...stat} loading={loading} />
          </Col>
        ))}
      </Row>

      {/* Server Metrics Summary Cards */}
      <Row
        gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
        style={{ marginBottom: isMobile ? 16 : 24 }}
      >
        {serverStatCards.map((stat, index) => (
          <Col xs={12} sm={12} md={6} key={`srv-${index}`}>
            <StatCard {...stat} loading={loading} />
          </Col>
        ))}
      </Row>

      {/* Web Vitals History Chart */}
      <Row
        gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
        style={{ marginBottom: isMobile ? 16 : 24 }}
      >
        <Col xs={24} lg={14}>
          <ContentCard
            title="Web Vitals History"
            subtitle="Core Web Vitals over time"
            actions={
              <div className="flex items-center gap-2">
                <Select
                  size="small"
                  value={historyMetric}
                  onChange={setHistoryMetric}
                  options={metricOptions}
                  style={{ width: 90 }}
                />
                <Select
                  size="small"
                  value={historyPeriod}
                  onChange={setHistoryPeriod}
                  options={periodOptions}
                  style={{ width: 110 }}
                />
              </div>
            }
          >
            <div style={{ height: 300, width: "100%" }}>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0a72ef" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0a72ef" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      name="Average"
                      stroke="#0a72ef"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "#0a72ef",
                        fill: "#FFFFFF",
                      }}
                      isAnimationActive={true}
                      animationDuration={500}
                    />
                    <Line
                      type="monotone"
                      dataKey="p95"
                      name="P95"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "#F59E0B",
                        fill: "#FFFFFF",
                      }}
                      isAnimationActive={true}
                      animationDuration={500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <DashboardOutlined style={{ fontSize: 40, marginBottom: 12, color: "#D1D5DB" }} />
                    <p className="text-sm">No Web Vitals data yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                      Data appears as users visit pages
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ContentCard>
        </Col>

        {/* Memory Usage Over Time */}
        <Col xs={24} lg={10}>
          <ContentCard title="Memory Usage Over Time" subtitle="Heap and RSS memory (MB)">
            <div style={{ height: 300, width: "100%" }}>
              {memoryHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={memoryHistory}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="heapGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0a72ef" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0a72ef" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "MB",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11, fill: "#6B7280" },
                      }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}
                      formatter={(value: number, name: string) => {
                        const label = name === "heapUsedMB" ? "Heap Used" : "RSS";
                        return [`${value} MB`, label];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="heapUsedMB"
                      name="Heap Used"
                      stroke="#0a72ef"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "#0a72ef",
                        fill: "#FFFFFF",
                      }}
                      isAnimationActive={true}
                      animationDuration={500}
                    />
                    <Line
                      type="monotone"
                      dataKey="rssMB"
                      name="RSS"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 2,
                        stroke: "#94A3B8",
                        fill: "#FFFFFF",
                      }}
                      isAnimationActive={true}
                      animationDuration={500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <Spin size="large" />
                    <p className="text-sm mt-4">Collecting data points...</p>
                  </div>
                </div>
              )}
            </div>
          </ContentCard>
        </Col>
      </Row>

      {/* Web Vitals Summary Table */}
      <Row
        gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
        style={{ marginBottom: isMobile ? 16 : 24 }}
      >
        <Col xs={24}>
          <ContentCard
            title="Web Vitals Breakdown"
            subtitle="Core Web Vitals summary for the selected period"
            actions={
              <Select
                size="small"
                value={wvPeriod}
                onChange={setWvPeriod}
                options={periodOptions}
                style={{ width: 120 }}
              />
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <WebVitalCard
                name="LCP"
                label="Largest Contentful Paint"
                data={webVitals?.lcp}
                unit="ms"
                thresholds={[2500, 4000]}
                loading={loading}
              />
              <WebVitalCard
                name="FID"
                label="First Input Delay"
                data={webVitals?.fid}
                unit="ms"
                thresholds={[100, 300]}
                loading={loading}
              />
              <WebVitalCard
                name="CLS"
                label="Cumulative Layout Shift"
                data={webVitals?.cls}
                unit=""
                thresholds={[0.1, 0.25]}
                loading={loading}
              />
              <WebVitalCard
                name="TTFB"
                label="Time to First Byte"
                data={webVitals?.ttfb}
                unit="ms"
                thresholds={[800, 1800]}
                loading={loading}
              />
              <WebVitalCard
                name="INP"
                label="Interaction to Next Paint"
                data={webVitals?.inp}
                unit="ms"
                thresholds={[200, 500]}
                loading={loading}
              />
            </div>
          </ContentCard>
        </Col>
      </Row>

      {/* API Latency Table */}
      <Row
        gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
        style={{ marginBottom: isMobile ? 16 : 24 }}
      >
        <Col xs={24}>
          <ContentCard
            title="API Endpoint Latency"
            subtitle="Per-endpoint response time statistics"
          >
            <Table
              dataSource={endpointTableData}
              columns={endpointColumns}
              size="small"
              pagination={false}
              loading={loading}
              locale={{ emptyText: "No endpoint data yet" }}
              scroll={{ x: 600 }}
            />
          </ContentCard>
        </Col>
      </Row>

      {/* System Info Row */}
      <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
        {/* CPU & Process Details */}
        <Col xs={24} lg={12}>
          <ContentCard title="Process Details" subtitle="CPU and resource utilization">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="CPU User Time" value={`${metrics?.cpu.userMs ?? "--"} ms`} />
              <DetailItem label="CPU System Time" value={`${metrics?.cpu.systemMs ?? "--"} ms`} />
              <DetailItem label="Heap Total" value={metrics?.memory.heapTotalFormatted ?? "--"} />
              <DetailItem label="Heap Used" value={metrics?.memory.heapUsedFormatted ?? "--"} />
              <DetailItem label="RSS" value={metrics?.memory.rssFormatted ?? "--"} />
              <DetailItem
                label="Heap Usage"
                value={`${memoryPercent}%`}
                warn={memoryPercent > 80}
              />
            </div>
          </ContentCard>
        </Col>

        {/* Quick Info */}
        <Col xs={24} lg={12}>
          <ContentCard title="Quick Info" subtitle="System overview">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Total Requests" value={String(requestCount)} />
              <DetailItem label="Avg Response" value={`${avgResponseTime} ms`} />
              <DetailItem label="Data Points" value={String(memoryHistory.length)} />
              <DetailItem
                label="Auto-Refresh"
                value={autoRefresh ? `Every ${POLL_INTERVAL_MS / 1000}s` : "Off"}
              />
              <DetailItem
                label="Last Updated"
                value={
                  metrics?.timestamp
                    ? new Date(metrics.timestamp).toLocaleTimeString()
                    : "--"
                }
              />
              <DetailItem label="Uptime" value={uptimeDisplay} />
            </div>
          </ContentCard>
        </Col>
      </Row>
    </PageContainer>
  );
}

// --- Web Vitals detail card ---

function WebVitalCard({
  name,
  label,
  data,
  unit,
  thresholds,
  loading,
}: {
  name: string;
  label: string;
  data?: WebVitalStat;
  unit: string;
  thresholds: [number, number];
  loading?: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50" style={{ boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px" }}>
        <Spin size="small" />
      </div>
    );
  }

  const displayValue = data.avg > 0 ? `${data.avg.toFixed(unit === "" ? 3 : 0)}${unit ? " " + unit : ""}` : "--";
  const tag = data.avg > 0 ? ratingTag(data.avg, thresholds) : null;

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-gray-900/30" style={{ boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{name}</span>
        {tag}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <div className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 data-text">
        {displayValue}
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
        <div>P50: {data.p50.toFixed(unit === "" ? 3 : 0)}{unit ? " " + unit : ""}</div>
        <div>P95: {data.p95.toFixed(unit === "" ? 3 : 0)}{unit ? " " + unit : ""}</div>
        <div>Samples: {data.count}</div>
      </div>
    </div>
  );
}

// --- Small detail display component ---

function DetailItem({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      <span
        className={`text-sm font-semibold font-mono ${
          warn
            ? "text-red-600 dark:text-red-400"
            : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
