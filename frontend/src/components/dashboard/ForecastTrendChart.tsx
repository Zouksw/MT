"use client";

import { TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import type React from "react";
import { useState } from "react";

// Dynamic imports for Recharts components
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

interface ForecastTrendChartProps {
	data?: Array<{ date: string; count: number }>;
	loading?: boolean;
}

// Mock data for forecast trends
const mockData = [
	{ date: "Mon", count: 12 },
	{ date: "Tue", count: 19 },
	{ date: "Wed", count: 15 },
	{ date: "Thu", count: 25 },
	{ date: "Fri", count: 22 },
	{ date: "Sat", count: 18 },
	{ date: "Sun", count: 28 },
];

const mockData30d = [
	{ date: "Week 1", count: 45 },
	{ date: "Week 2", count: 62 },
	{ date: "Week 3", count: 58 },
	{ date: "Week 4", count: 71 },
];

const mockData90d = [
	{ date: "Jan", count: 120 },
	{ date: "Feb", count: 145 },
	{ date: "Mar", count: 132 },
];

type TimeRange = "7D" | "30D" | "90D";

export const ForecastTrendChart: React.FC<ForecastTrendChartProps> = ({
	data,
	loading = false,
}) => {
	const [range, setRange] = useState<TimeRange>("7D");

	const displayData =
		data || (range === "7D" ? mockData : range === "30D" ? mockData30d : mockData90d);

	const ranges: { key: TimeRange; label: string }[] = [
		{ key: "7D", label: "7D" },
		{ key: "30D", label: "30D" },
		{ key: "90D", label: "90D" },
	];

	return (
		<div className="rounded-lg bg-card shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] h-full!">
			{loading ? (
				<div className="flex items-center justify-center p-10">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				</div>
			) : (
				<div className="p-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
								<TrendingUp className="size-4 text-primary" />
							</div>
							<h5 className="text-base font-semibold mb-0!">Forecast Trend</h5>
						</div>
						{/* Time Range Selector */}
						<div className="flex gap-1 rounded-lg bg-muted p-0.5">
							{ranges.map((r) => (
								<button type="button"
									key={r.key}
									onClick={() => setRange(r.key)}
									className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
										range === r.key
											? "bg-white dark:bg-gray-700 text-primary shadow-sm"
											: "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
									}`}
								>
									{r.label}
								</button>
							))}
						</div>
					</div>
					<ResponsiveContainer width="100%" height={250}>
						<LineChart data={displayData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
							<defs>
								<linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#B8860B" stopOpacity={0.15} />
									<stop offset="95%" stopColor="#B8860B" stopOpacity={0} />
								</linearGradient>
							</defs>
							<CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
							<XAxis
								dataKey="date"
								tick={{ fontSize: 12, fill: "#6B7280" }}
								axisLine={{ stroke: "#E5E7EB" }}
								tickLine={false}
							/>
							<YAxis tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
							<Tooltip
								contentStyle={{
									backgroundColor: "rgba(255, 255, 255, 0.98)",
									border: "1px solid #E5E7EB",
									borderRadius: "8px",
									boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
									padding: "10px 14px",
									fontSize: 13,
								}}
								labelStyle={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}
								formatter={(value: number) => [`${value}`, "Forecasts"]}
							/>
							<Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
							<Line
								type="monotone"
								dataKey="count"
								name="Forecasts"
								stroke="#B8860B"
								strokeWidth={2.5}
								dot={false}
								activeDot={{
									r: 5,
									strokeWidth: 2,
									stroke: "#B8860B",
									fill: "#FFFFFF",
								}}
								fill="url(#forecastGradient)"
								isAnimationActive={true}
								animationDuration={800}
								animationEasing="ease-out"
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			)}
		</div>
	);
};

export default ForecastTrendChart;
