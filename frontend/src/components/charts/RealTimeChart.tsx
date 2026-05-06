"use client";

import { CircleAlert, CircleX, Loader, Pause, Play, RefreshCw, X } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	chartAnimations,
	chartAxisStyles,
	chartColors,
	chartGridStyles,
	chartTooltipStyles,
	lineChartStyles,
	referenceLineStyles,
} from "@/lib/chart-config";

// Dynamic imports for Recharts components to reduce initial bundle size
const LineChart = dynamic(() => import("recharts").then((mod) => ({ default: mod.LineChart })), {
	loading: () => (
		<div className="flex items-center justify-center h-full">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
		</div>
	),
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const Line = dynamic(() => import("recharts").then((mod) => ({ default: mod.Line })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const XAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.XAxis })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const YAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.YAxis })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const CartesianGrid = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
	{ ssr: false },
) as React.ComponentType<Record<string, unknown>>;

const Tooltip = dynamic(() => import("recharts").then((mod) => ({ default: mod.Tooltip })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const Legend = dynamic(() => import("recharts").then((mod) => ({ default: mod.Legend })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const ResponsiveContainer = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
	{ ssr: false },
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const ReferenceLine = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ReferenceLine })),
	{ ssr: false },
) as React.ComponentType<Record<string, unknown>>;

interface DataPoint {
	timestamp: number;
	value: number;
}

interface RealTimeChartProps {
	timeseries?: string;
	autoScroll?: boolean;
	maxPoints?: number;
	refreshInterval?: number;
	showStatistics?: boolean;
	height?: number;
	onDisconnect?: () => void;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
	timeseries = "root.test2",
	autoScroll: _autoScroll = true,
	maxPoints = 100,
	refreshInterval = 2000,
	showStatistics = true,
	height = 400,
	onDisconnect,
}) => {
	const [data, setData] = useState<DataPoint[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef<boolean>(true);

	// Calculate statistics
	const statistics = React.useMemo(() => {
		if (data.length === 0) return null;
		const values = data.map((d) => d.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const sum = values.reduce((a, b) => a + b, 0);
		const mean = sum / values.length;
		const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
		const std = Math.sqrt(variance);
		const last = values[values.length - 1];

		return { min, max, mean, std, last, count: values.length };
	}, [data]);

	// Format timestamp for display
	const formatTimestamp = (ts: number) => {
		const date = new Date(ts);
		return date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			fractionalSecondDigits: 3,
		});
	};

	// Format value for display
	const formatValue = (val: number) => {
		return typeof val === "number" ? val.toFixed(4) : val;
	};

	// Fetch data point with proper cleanup check
	const fetchDataPoint = useCallback(async () => {
		// Prevent fetching if component is unmounted or paused
		if (!isMountedRef.current || isPaused) return;

		try {
			const response = await fetch(
				`/api/iotdb/query/latest?timeseries=${encodeURIComponent(timeseries)}&limit=1`,
			);

			if (!response.ok) {
				throw new Error("Failed to fetch data");
			}

			const result = await response.json();

			if (!isMountedRef.current) return; // Check again after async operation

			if (result.data && result.data.length > 0) {
				const newDataPoint = {
					timestamp: result.data[0].timestamp || Date.now(),
					value: parseFloat(result.data[0].value),
				};

				setData((prevData) => {
					const newData = [...prevData, newDataPoint];
					// Keep only maxPoints
					if (newData.length > maxPoints) {
						return newData.slice(-maxPoints);
					}
					return newData;
				});

				setError(null);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown error";
			if (isMountedRef.current) {
				setError(message);
			}
		}
	}, [timeseries, isPaused, maxPoints]);

	// Start real-time updates
	const startUpdates = useCallback(() => {
		// Clear any existing interval
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
		}

		setIsConnected(true);
		setLoading(false);

		// Set component as mounted
		isMountedRef.current = true;

		// Fetch initial data
		fetchDataPoint();

		// Set up interval for polling
		intervalRef.current = setInterval(() => {
			fetchDataPoint();
		}, refreshInterval);
	}, [fetchDataPoint, refreshInterval]);

	// Stop real-time updates
	const stopUpdates = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setIsConnected(false);
	}, []);

	// Toggle pause/resume
	const togglePause = useCallback(() => {
		setIsPaused((prev) => !prev);
	}, []);

	// Clear data
	const clearData = useCallback(() => {
		setData([]);
		setError(null);
	}, []);

	// Cleanup on unmount - CRITICAL for preventing memory leaks
	useEffect(() => {
		// Mark component as mounted
		isMountedRef.current = true;

		return () => {
			// Mark component as unmounted FIRST to prevent state updates
			isMountedRef.current = false;

			// Clear interval
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, []);

	// Auto-start updates when connected state changes
	useEffect(() => {
		if (isConnected && !isPaused) {
			// Updates are already started via startUpdates button
		}
	}, [isConnected, isPaused]);

	// Custom tooltip
	const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { timestamp: number; value: number } }> }) => {
		if (active && payload?.length) {
			return (
				<div
					style={{
						backgroundColor: chartTooltipStyles.backgroundColor,
						border: chartTooltipStyles.border,
						borderRadius: chartTooltipStyles.borderRadius,
						padding: chartTooltipStyles.padding,
						boxShadow: chartTooltipStyles.boxShadow,
					}}
				>
					<p
						style={{
							margin: 0,
							fontSize: chartTooltipStyles.fontSize,
							color: chartTooltipStyles.color,
						}}
					>
						{formatTimestamp(payload[0].payload.timestamp)}
					</p>
					<p
						style={{
							margin: "4px 0 0 0",
							fontSize: 14,
							fontWeight: 600,
							color: chartColors.gray900,
						}}
					>
						Value: {formatValue(payload[0].value)}
					</p>
				</div>
			);
		}
		return null;
	};

	return (
		<div className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08] p-5">
			{/* Header */}
			<div className="flex justify-between items-center mb-5">
				<div className="flex flex-col gap-0">
					<div className="flex items-center gap-2">
						<span className="font-semibold text-[15px] text-gray-900 dark:text-white">
							Real-Time Data
						</span>
						{isConnected && (
							<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
								<Loader className="size-3 animate-spin" />
								LIVE
							</span>
						)}
						{isPaused && isConnected && (
							<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
								PAUSED
							</span>
						)}
					</div>
					<span className="text-xs text-muted-foreground">{timeseries}</span>
				</div>

				<div className="flex gap-2">
					{!isConnected ? (
						<button type="button"
							onClick={startUpdates}
							disabled={loading}
							className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
							aria-label="Start real-time data monitoring"
						>
							<Play className="size-4" fill="currentColor" />
							Start
						</button>
					) : (
						<>
							<button type="button"
								onClick={togglePause}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors"
								aria-label={isPaused ? "Resume real-time updates" : "Pause real-time updates"}
							>
								{isPaused ? (
									<Play className="size-4" fill="currentColor" />
								) : (
									<Pause className="size-4" fill="currentColor" />
								)}
								{isPaused ? "Resume" : "Pause"}
							</button>
							<button type="button"
								onClick={clearData}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors"
								aria-label="Clear all chart data"
							>
								<RefreshCw className="size-4" />
								Clear
							</button>
							<button type="button"
								onClick={() => {
									stopUpdates();
									onDisconnect?.();
								}}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-300 dark:border-red-700 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
								aria-label="Stop real-time monitoring"
							>
								<CircleX className="size-4" />
								Stop
							</button>
						</>
					)}
				</div>
			</div>

			{/* Error Alert */}
			{error && (
				<div className="flex items-start gap-3 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
					<CircleAlert className="size-5 text-red-500 shrink-0 mt-0.5" />
					<div className="flex-1">
						<p className="text-sm font-medium text-red-800 dark:text-red-300">Connection Error</p>
						<p className="text-sm text-red-600 dark:text-red-400">{error}</p>
					</div>
					<button type="button"
						onClick={() => setError(null)}
						className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
					>
						<X className="size-4" />
					</button>
				</div>
			)}

			{/* Statistics */}
			{showStatistics && statistics && (
				<div className="grid grid-cols-4 gap-3 mb-5">
					<div className="p-3 bg-card border border rounded text-center">
						<div className="text-[11px] text-gray-500 mb-1 font-medium">Current</div>
						<div className="text-lg font-semibold" style={{ color: chartColors.warning }}>
							{formatValue(statistics.last)}
						</div>
					</div>
					<div className="p-3 bg-card border border rounded text-center">
						<div className="text-[11px] text-gray-500 mb-1 font-medium">Min</div>
						<div className="text-lg font-semibold" style={{ color: chartColors.success }}>
							{formatValue(statistics.min)}
						</div>
					</div>
					<div className="p-3 bg-card border border rounded text-center">
						<div className="text-[11px] text-gray-500 mb-1 font-medium">Max</div>
						<div className="text-lg font-semibold" style={{ color: chartColors.primary }}>
							{formatValue(statistics.max)}
						</div>
					</div>
					<div className="p-3 bg-card border border rounded text-center">
						<div className="text-[11px] text-gray-500 mb-1 font-medium">Mean</div>
						<div className="text-lg font-semibold" style={{ color: chartColors.purple }}>
							{formatValue(statistics.mean)}
						</div>
					</div>
				</div>
			)}

			{/* Chart */}
			{data.length === 0 ? (
				<div className="flex items-center justify-center bg-muted rounded" style={{ height }}>
					<div className="text-center text-gray-400">
						<Loader className="size-12 mx-auto mb-4 animate-spin" strokeWidth={1.5} />
						<div className="text-sm">
							{isConnected ? "Waiting for data..." : "Click Start to begin real-time monitoring"}
						</div>
					</div>
				</div>
			) : (
				<ResponsiveContainer width="100%" height={height}>
					<LineChart
						data={data}
						margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
						role="img"
						aria-label={`Line chart showing real-time data for ${timeseries}. Current value: ${data[data.length - 1]?.value || "N/A"}. ${data.length} data points displayed.`}
					>
						<CartesianGrid
							strokeDasharray={chartGridStyles.strokeDasharray}
							stroke={chartGridStyles.stroke}
							strokeWidth={chartGridStyles.strokeWidth}
						/>
						<XAxis
							dataKey="timestamp"
							tickFormatter={formatTimestamp}
							stroke={chartAxisStyles.stroke}
							tick={chartAxisStyles.tick}
						/>
						<YAxis
							tickFormatter={formatValue}
							stroke={chartAxisStyles.stroke}
							tick={chartAxisStyles.tick}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Legend />
						<Line
							type="monotone"
							dataKey="value"
							stroke={lineChartStyles.stroke}
							strokeWidth={lineChartStyles.strokeWidth}
							dot={false}
							activeDot={lineChartStyles.activeDot}
							animationDuration={chartAnimations.duration}
						/>
						{statistics && (
							<>
								<ReferenceLine
									y={statistics.mean}
									stroke={referenceLineStyles.stroke}
									strokeDasharray={referenceLineStyles.strokeDasharray}
									strokeWidth={referenceLineStyles.strokeWidth}
									label={{
										value: "Mean",
										fill: chartColors.purple,
										fontSize: referenceLineStyles.label.fontSize,
										fontWeight: referenceLineStyles.label.fontWeight,
									}}
								/>
								<ReferenceLine
									y={statistics.mean + statistics.std}
									stroke={chartColors.warning}
									strokeDasharray={referenceLineStyles.strokeDasharray}
									strokeWidth={referenceLineStyles.strokeWidth}
									label={{
										value: "+1σ",
										fill: chartColors.warning,
										fontSize: referenceLineStyles.label.fontSize,
										fontWeight: referenceLineStyles.label.fontWeight,
									}}
								/>
								<ReferenceLine
									y={statistics.mean - statistics.std}
									stroke={chartColors.warning}
									strokeDasharray={referenceLineStyles.strokeDasharray}
									strokeWidth={referenceLineStyles.strokeWidth}
									label={{
										value: "-1σ",
										fill: chartColors.warning,
										fontSize: referenceLineStyles.label.fontSize,
										fontWeight: referenceLineStyles.label.fontWeight,
									}}
								/>
							</>
						)}
					</LineChart>
				</ResponsiveContainer>
			)}

			{/* Footer Info */}
			{data.length > 0 && (
				<div className="mt-4 text-xs text-gray-400 text-center">
					Showing {data.length} data point{data.length !== 1 ? "s" : ""} &bull; Refresh every{" "}
					{refreshInterval / 1000}s
				</div>
			)}
		</div>
	);
};

export default RealTimeChart;
