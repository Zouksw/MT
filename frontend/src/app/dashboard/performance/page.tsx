"use client";

import { BarChart3, Clock, Database, TriangleAlert, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ContentCard } from "@/components/layout/ContentCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useIsMobile } from "@/lib/responsive-utils";
import { getAuthToken } from "@/utils/auth";

const LineChart = dynamic(() => import("recharts").then((mod) => ({ default: mod.LineChart })), {
	loading: () => (
		<div className="flex items-center justify-center h-full">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
		</div>
	),
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
}) as React.ComponentType<any>;
const Line = dynamic(() => import("recharts").then((mod) => ({ default: mod.Line })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
}) as React.ComponentType<any>;
const XAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.XAxis })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
}) as React.ComponentType<any>;
const YAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.YAxis })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
}) as React.ComponentType<any>;
const CartesianGrid = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
) as React.ComponentType<any>;
const Tooltip = dynamic(() => import("recharts").then((mod) => ({ default: mod.Tooltip })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
}) as React.ComponentType<any>;
const ResponsiveContainer = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
) as React.ComponentType<any>;
const Legend = dynamic(() => import("recharts").then((mod) => ({ default: mod.Legend })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
}) as React.ComponentType<any>;

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
	uptime: { seconds: number; formatted: string };
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
	cpu: { userMicroseconds: number; systemMicroseconds: number; userMs: number; systemMs: number };
	requests: { total: number; avgResponseTime: number };
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
	overall: { avg: number; p50: number; p95: number; p99: number };
	endpoints: Record<string, { avg: number; p50: number; p95: number; p99: number; count: number }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const POLL_INTERVAL_MS = 30_000;
const MAX_HISTORY_POINTS = 60;

function authHeaders(): HeadersInit {
	const token = getAuthToken();
	const headers: HeadersInit = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

async function fetchServerMetrics(): Promise<ServerMetricsData> {
	const response = await fetch(`${API_BASE}/metrics`, { headers: authHeaders() });
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	return (await response.json()).data;
}
async function fetchWebVitalsSummary(period: string): Promise<WebVitalsSummary> {
	const response = await fetch(`${API_BASE}/metrics/web-vitals?period=${period}`, {
		headers: authHeaders(),
	});
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	return (await response.json()).data;
}
async function fetchWebVitalsHistory(
	metric: string,
	period: string,
	interval: string,
): Promise<HistoryPoint[]> {
	const params = new URLSearchParams({ metric, period, interval });
	const response = await fetch(`${API_BASE}/metrics/web-vitals/history?${params}`, {
		headers: authHeaders(),
	});
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	return (await response.json()).data;
}
async function fetchApiLatency(): Promise<ApiLatencyData> {
	const response = await fetch(`${API_BASE}/metrics/api-latency`, { headers: authHeaders() });
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	return (await response.json()).data;
}

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
	if (value <= thresholds[0]) return <Tag color="success">Good</Tag>;
	if (value <= thresholds[1]) return <Tag color="warning">Needs Improvement</Tag>;
	return <Tag color="error">Poor</Tag>;
}

const tooltipStyle: React.CSSProperties = {
	backgroundColor: "rgba(255, 255, 255, 0.98)",
	border: "1px solid #E5E7EB",
	borderRadius: "8px",
	boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
	padding: "10px 14px",
	fontSize: 13,
};

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
			<div className="p-4 rounded-lg bg-muted/50 border border-gray-200/60 dark:border-gray-700/60">
				<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
			</div>
		);
	}
	const displayValue =
		data.avg > 0 ? `${data.avg.toFixed(unit === "" ? 3 : 0)}${unit ? ` ${unit}` : ""}` : "--";
	return (
		<div className="p-4 rounded-lg bg-white dark:bg-gray-900/30 border border-gray-200/60 dark:border-gray-700/60">
			<div className="flex items-center justify-between mb-2">
				<span className="text-sm font-semibold text-foreground">{name}</span>
				{data.avg > 0 ? ratingTag(data.avg, thresholds) : null}
			</div>
			<p className="text-xs text-muted-foreground mb-2">{label}</p>
			<div className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
				{displayValue}
			</div>
			<div className="text-xs text-muted-foreground space-y-0.5">
				<div>
					P50: {data.p50.toFixed(unit === "" ? 3 : 0)}
					{unit ? ` ${unit}` : ""}
				</div>
				<div>
					P95: {data.p95.toFixed(unit === "" ? 3 : 0)}
					{unit ? ` ${unit}` : ""}
				</div>
				<div>Samples: {data.count}</div>
			</div>
		</div>
	);
}

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
			<span className="text-xs text-muted-foreground font-medium">{label}</span>
			<span
				className={`text-sm font-semibold font-mono ${warn ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}
			>
				{value}
			</span>
		</div>
	);
}

export default function PerformancePage() {
	const isMobile = useIsMobile();
	const [metrics, setMetrics] = useState<ServerMetricsData | null>(null);
	const [webVitals, setWebVitals] = useState<WebVitalsSummary | null>(null);
	const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
	const [apiLatency, setApiLatency] = useState<ApiLatencyData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [autoRefresh, setAutoRefresh] = useState(true);
	const [wvPeriod, setWvPeriod] = useState("24h");
	const [historyMetric, setHistoryMetric] = useState("LCP");
	const [historyPeriod, setHistoryPeriod] = useState("24h");
	const [memoryHistory, setMemoryHistory] = useState<MemoryPoint[]>([]);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
							heapUsedMB: parseFloat((serverData.value.memory.heapUsed / 1024 / 1024).toFixed(2)),
							rssMB: parseFloat((serverData.value.memory.rss / 1024 / 1024).toFixed(2)),
						},
					];
					return next.length > MAX_HISTORY_POINTS
						? next.slice(next.length - MAX_HISTORY_POINTS)
						: next;
				});
			}
			if (wvData.status === "fulfilled") setWebVitals(wvData.value);
			if (latencyData.status === "fulfilled") setApiLatency(latencyData.value);
			if (histData.status === "fulfilled") setHistoryData(histData.value);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err : new Error("Failed to fetch metrics"));
		} finally {
			setLoading(false);
		}
	}, [wvPeriod, historyMetric, historyPeriod]);

	useEffect(() => {
		loadData();
	}, [loadData]);
	useEffect(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		if (autoRefresh) intervalRef.current = setInterval(loadData, POLL_INTERVAL_MS);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [autoRefresh, loadData]);

	const uptimeDisplay = metrics?.uptime.formatted ?? "--";
	const memoryDisplay = metrics?.memory.heapUsedFormatted ?? "--";
	const memoryPercent = metrics?.memory.heapUsagePercent ?? 0;
	const requestCount = metrics?.requests.total ?? 0;
	const avgResponseTime = metrics?.requests.avgResponseTime ?? 0;
	const lcpAvg = webVitals?.lcp.avg ?? 0;
	const clsAvg = webVitals?.cls.avg ?? 0;
	const apiP95 = apiLatency?.overall.p95 ?? 0;
	const errorRate = 0;

	const statCards = [
		{
			title: "LCP",
			value: lcpAvg > 0 ? `${(lcpAvg / 1000).toFixed(2)}s` : "--",
			icon: <BarChart3 className="size-4" />,
			variant: lcpAvg > 0 ? lcpColor(lcpAvg) : ("default" as const),
		},
		{
			title: "CLS",
			value: clsAvg > 0 ? clsAvg.toFixed(3) : "--",
			icon: <TriangleAlert className="size-4" />,
			variant: clsAvg > 0 ? clsColor(clsAvg) : ("default" as const),
		},
		{
			title: "API Latency (p95)",
			value: apiP95 > 0 ? `${apiP95} ms` : "--",
			icon: <Zap className="size-4" />,
			variant: apiP95 > 0 ? latencyColor(apiP95) : ("default" as const),
		},
		{
			title: "Error Rate",
			value: `${errorRate}%`,
			icon: <TriangleAlert className="size-4" />,
			variant:
				errorRate > 5
					? ("error" as const)
					: errorRate > 1
						? ("warning" as const)
						: ("success" as const),
		},
	];

	const serverStatCards = [
		{
			title: "Uptime",
			value: uptimeDisplay,
			icon: <Clock className="size-4" />,
			variant: "primary" as const,
			sparklineData: undefined as number[] | undefined,
		},
		{
			title: "Memory (Heap)",
			value: memoryDisplay,
			icon: <Database className="size-4" />,
			variant: (memoryPercent > 80 ? "error" : memoryPercent > 60 ? "warning" : "success") as
				| "success"
				| "warning"
				| "error",
			sparklineData: memoryHistory.slice(-12).map((p) => p.heapUsedMB),
		},
		{
			title: "Request Count",
			value: requestCount,
			icon: <Zap className="size-4" />,
			variant: "default" as const,
			sparklineData: undefined as number[] | undefined,
		},
		{
			title: "Avg Response Time",
			value: `${avgResponseTime} ms`,
			icon: <Zap className="size-4" />,
			variant: (avgResponseTime > 500 ? "error" : avgResponseTime > 200 ? "warning" : "success") as
				| "success"
				| "warning"
				| "error",
			sparklineData: undefined as number[] | undefined,
		},
	];

	const endpointColumns = [
		{
			key: "endpoint",
			title: "Endpoint",
			// biome-ignore lint/suspicious/noExplicitAny: generic component callback
			render: (row: any) => <span className="font-mono text-sm">{row.endpoint}</span>,
		},
		{
			key: "avg",
			title: "Avg (ms)",
			// biome-ignore lint/suspicious/noExplicitAny: generic component callback
			render: (row: any) => (
				<span style={{ color: latencyColor(row.avg) === "error" ? "#EF4444" : "inherit" }}>
					{row.avg.toFixed(1)}
				</span>
			),
		},
		// biome-ignore lint/suspicious/noExplicitAny: generic component callback
		{ key: "p50", title: "P50 (ms)", render: (row: any) => row.p50.toFixed(1) },
		{
			key: "p95",
			title: "P95 (ms)",
			// biome-ignore lint/suspicious/noExplicitAny: generic component callback
			render: (row: any) => (
				<span style={{ color: latencyColor(row.p95) === "error" ? "#EF4444" : "inherit" }}>
					{row.p95.toFixed(1)}
				</span>
			),
		},
		{
			key: "p99",
			title: "P99 (ms)",
			// biome-ignore lint/suspicious/noExplicitAny: generic component callback
			render: (row: any) => (
				<span style={{ color: latencyColor(row.p99) === "error" ? "#EF4444" : "inherit" }}>
					{row.p99.toFixed(1)}
				</span>
			),
		},
		// biome-ignore lint/suspicious/noExplicitAny: generic component callback
		{ key: "count", title: "Requests", render: (row: any) => row.count },
	];

	const endpointTableData = apiLatency
		? Object.entries(apiLatency.endpoints).map(([ep, data]) => ({ id: ep, endpoint: ep, ...data }))
		: [];

	const chartData = historyData.map((point) => ({
		time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		avg: parseFloat(point.avg.toFixed(2)),
		p95: parseFloat(point.p95.toFixed(2)),
		count: point.count,
	}));

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

	const gap = isMobile ? 8 : 16;
	const breadcrumbs = [
		{ label: "Home", href: "/" },
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Performance" },
	];

	return (
		<PageContainer>
			<PageHeader
				title="Performance Monitoring"
				description="Real-time server metrics and Web Vitals dashboard"
				breadcrumbs={breadcrumbs}
				actions={
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">Auto-refresh</span>
							<button
								type="button"
								role="switch"
								aria-checked={autoRefresh}
								onClick={() => setAutoRefresh(!autoRefresh)}
								className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoRefresh ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"}`}
							>
								<span
									className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoRefresh ? "translate-x-4" : "translate-x-0.5"}`}
								/>
							</button>
						</div>
						<Button variant="ghost" size="sm" onClick={loadData}>
							Refresh
						</Button>
					</div>
				}
			/>

			{error && <ErrorDisplay error={error} retry={loadData} context="Performance Metrics" />}

			<div className={`grid grid-cols-2 md:grid-cols-4 gap-${gap} mb-3`}>
				{statCards.map((stat, i) => (
					<StatCard key={`wv-${i}`} {...stat} loading={loading} />
				))}
			</div>

			<div className={`grid grid-cols-2 md:grid-cols-4 gap-${gap} mb-6`}>
				{serverStatCards.map((stat, i) => (
					<StatCard
						key={`srv-${i}`}
						{...stat}
						loading={loading}
						sparklineData={stat.sparklineData}
					/>
				))}
			</div>

			<div className={`grid grid-cols-1 lg:grid-cols-12 gap-${gap} mb-6`}>
				<div className="lg:col-span-7">
					<ContentCard
						title="Web Vitals History"
						subtitle="Core Web Vitals over time"
						actions={
							<div className="flex items-center gap-2">
								<Select value={historyMetric} onChange={setHistoryMetric} options={metricOptions} />
								<Select value={historyPeriod} onChange={setHistoryPeriod} options={periodOptions} />
							</div>
						}
					>
						<div style={{ height: 300, width: "100%" }}>
							{chartData.length > 1 ? (
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
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
											stroke="#B8860B"
											strokeWidth={2.5}
											dot={false}
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
											isAnimationActive={true}
											animationDuration={500}
										/>
									</LineChart>
								</ResponsiveContainer>
							) : (
								<div className="flex items-center justify-center h-full text-gray-400">
									<div className="text-center">
										<BarChart3 className="size-10 mx-auto mb-3 text-gray-300" />
										<p className="text-sm">No Web Vitals data yet</p>
									</div>
								</div>
							)}
						</div>
					</ContentCard>
				</div>

				<div className="lg:col-span-5">
					<ContentCard title="Memory Usage Over Time" subtitle="Heap and RSS memory (MB)">
						<div style={{ height: 300, width: "100%" }}>
							{memoryHistory.length > 1 ? (
								<ResponsiveContainer width="100%" height="100%">
									<LineChart
										data={memoryHistory}
										margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
									>
										<CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
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
										<Line
											type="monotone"
											dataKey="heapUsedMB"
											name="Heap Used"
											stroke="#B8860B"
											strokeWidth={2.5}
											dot={false}
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
											isAnimationActive={true}
											animationDuration={500}
										/>
									</LineChart>
								</ResponsiveContainer>
							) : (
								<div className="flex items-center justify-center h-full">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
								</div>
							)}
						</div>
					</ContentCard>
				</div>
			</div>

			<div className="mb-6">
				<ContentCard
					title="Web Vitals Breakdown"
					subtitle="Core Web Vitals summary for the selected period"
					actions={<Select value={wvPeriod} onChange={setWvPeriod} options={periodOptions} />}
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
			</div>

			<div className="mb-6">
				<ContentCard title="API Endpoint Latency" subtitle="Per-endpoint response time statistics">
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
						</div>
					) : (
						<Table columns={endpointColumns} dataSource={endpointTableData} />
					)}
				</ContentCard>
			</div>

			<div className={`grid grid-cols-1 lg:grid-cols-2 gap-${gap}`}>
				<ContentCard title="Process Details" subtitle="CPU and resource utilization">
					<div className="grid grid-cols-2 gap-4">
						<DetailItem label="CPU User Time" value={`${metrics?.cpu.userMs ?? "--"} ms`} />
						<DetailItem label="CPU System Time" value={`${metrics?.cpu.systemMs ?? "--"} ms`} />
						<DetailItem label="Heap Total" value={metrics?.memory.heapTotalFormatted ?? "--"} />
						<DetailItem label="Heap Used" value={metrics?.memory.heapUsedFormatted ?? "--"} />
						<DetailItem label="RSS" value={metrics?.memory.rssFormatted ?? "--"} />
						<DetailItem label="Heap Usage" value={`${memoryPercent}%`} warn={memoryPercent > 80} />
					</div>
				</ContentCard>
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
							value={metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : "--"}
						/>
						<DetailItem label="Uptime" value={uptimeDisplay} />
					</div>
				</ContentCard>
			</div>
		</PageContainer>
	);
}
