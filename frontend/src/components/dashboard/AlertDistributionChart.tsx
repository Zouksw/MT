"use client";

import { TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import React from "react";

// Dynamic imports for Recharts
const BarChart = dynamic(() => import("recharts").then((mod) => ({ default: mod.BarChart })), {
	loading: () => (
		<div className="flex items-center justify-center h-full">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
		</div>
	),
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const Bar = dynamic(() => import("recharts").then((mod) => ({ default: mod.Bar })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const XAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.XAxis })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const YAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.YAxis })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const Tooltip = dynamic(() => import("recharts").then((mod) => ({ default: mod.Tooltip })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

const ResponsiveContainer = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const Cell = dynamic(() => import("recharts").then((mod) => ({ default: mod.Cell })), {
	ssr: false,
}) as React.ComponentType<Record<string, unknown>>;

interface AlertDistributionChartProps {
	data?: {
		error: number;
		warning: number;
		info: number;
	};
	loading?: boolean;
}

// Backend AlertSeverity enum: INFO | WARNING | ERROR (schema.prisma). The
// old critical/high/medium/low keys never matched any real severity, so the
// chart always fell back to its demo data or rendered empty (audit C8).
const SEVERITY_CONFIG = [
	{ name: "Error", key: "error", color: "#DC2626", mutedColor: "#FCA5A5" },
	{ name: "Warning", key: "warning", color: "#F59E0B", mutedColor: "#FCD34D" },
	{ name: "Info", key: "info", color: "#10B981", mutedColor: "#6EE7B7" },
];

export const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({
	data,
	loading = false,
}) => {
	const chartData = React.useMemo(() => {
		// No data yet (stats still loading / a fetch failed) → render the
		// honest "No alerts" empty state. This used to fabricate 2/5/12
		// demo alerts whenever `data` was undefined — fake numbers presented
		// as real on the dashboard (round-106).
		if (!data) return [];

		return SEVERITY_CONFIG.map((s) => ({
			name: s.name,
			value: ((data as Record<string, unknown>)[s.key] as number) || 0,
			color: s.color,
			mutedColor: s.mutedColor,
		})).filter((item) => item.value > 0);
	}, [data]);

	const total = React.useMemo(
		() => chartData.reduce((sum, item) => sum + item.value, 0),
		[chartData],
	);

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
							<div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
								<TriangleAlert className="size-4 text-error" />
							</div>
							<h5 className="text-base font-semibold mb-0!">Alert Distribution</h5>
						</div>
						{total > 0 && (
							<div className="flex items-baseline gap-1.5">
								<span className="text-2xl font-semibold font-mono data-text text-gray-900 dark:text-white">
									{total}
								</span>
								<span className="text-xs text-muted-foreground">total</span>
							</div>
						)}
					</div>
					{total > 0 ? (
						<ResponsiveContainer width="100%" height={250}>
							<BarChart
								data={chartData}
								layout="vertical"
								margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
							>
								<XAxis type="number" hide />
								<YAxis
									dataKey="name"
									type="category"
									width={60}
									tick={{ fontSize: 12, fill: "#6B7280" }}
									axisLine={false}
									tickLine={false}
								/>
								<Tooltip
									contentStyle={{
										backgroundColor: "rgba(255, 255, 255, 0.98)",
										border: "1px solid #E5E7EB",
										borderRadius: "8px",
										boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
										padding: "10px 14px",
										fontSize: 13,
									}}
									formatter={(value: number, name: string) => [`${value} alerts`, name]}
									cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
								/>
								<Bar
									dataKey="value"
									radius={[0, 4, 4, 0]}
									barSize={20}
									isAnimationActive={true}
									animationDuration={600}
									animationEasing="ease-out"
								>
									{chartData.map((entry, index) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
										<Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div
							className="flex items-center justify-center text-muted-foreground"
							style={{ height: 250 }}
						>
							<div className="text-center">
								<div className="text-4xl mb-2">&#10003;</div>
								<p className="text-sm">No alerts</p>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default AlertDistributionChart;
