"use client";

import dynamic from "next/dynamic";
import type React from "react";
import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
	chartAnimations,
	chartAxisStyles,
	chartGridStyles,
	chartTooltipStyles,
} from "@/lib/chart-config";
import type { ModelWithBacktest } from "@/types/accuracy";
import { MODEL_COLORS } from "@/types/accuracy";

const ResponsiveContainer = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
	{ ssr: false, loading: () => <div className="h-[350px] bg-muted animate-pulse rounded" /> },
) as React.ComponentType<any>;

const LineChart = dynamic(() => import("recharts").then((mod) => ({ default: mod.LineChart })), {
	ssr: false,
}) as React.ComponentType<any>;

const Line = dynamic(() => import("recharts").then((mod) => ({ default: mod.Line })), {
	ssr: false,
}) as React.ComponentType<any>;

const XAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.XAxis })), {
	ssr: false,
}) as React.ComponentType<any>;

const YAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.YAxis })), {
	ssr: false,
}) as React.ComponentType<any>;

const CartesianGrid = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
	{ ssr: false },
) as React.ComponentType<any>;

const Tooltip = dynamic(() => import("recharts").then((mod) => ({ default: mod.Tooltip })), {
	ssr: false,
}) as React.ComponentType<any>;

const Legend = dynamic(() => import("recharts").then((mod) => ({ default: mod.Legend })), {
	ssr: false,
}) as React.ComponentType<any>;

type WindowSize = 7 | 30 | 90;

const WINDOW_OPTIONS: { label: string; value: WindowSize }[] = [
	{ label: "7 Days", value: 7 },
	{ label: "30 Days", value: 30 },
	{ label: "90 Days", value: 90 },
];

interface AccuracyTrendChartProps {
	models: ModelWithBacktest[];
}

function CustomTooltip({ active, payload, label }: any) {
	if (!active || !payload?.length) return null;
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
			<p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
			{payload.map((entry: any) => (
				<p key={entry.name} className="text-xs" style={{ color: entry.color }}>
					{entry.name}: {entry.value !== null ? `${entry.value.toFixed(1)}%` : "N/A"}
				</p>
			))}
		</div>
	);
}

export function AccuracyTrendChart({ models }: AccuracyTrendChartProps) {
	const [activeWindow, setActiveWindow] = useState<WindowSize>(30);

	const chartData = useMemo(() => {
		const modelsWithBacktest = models.filter((m) => m.backtest?.windows?.length);
		if (modelsWithBacktest.length === 0) return [];

		return modelsWithBacktest.map((m) => {
			const window = m.backtest?.windows.find((w) => w.days === activeWindow);
			return {
				name: m.displayName,
				mape: window?.mape ?? null,
				predictions: window?.predictionCount ?? 0,
				verified: window?.verifiedCount ?? 0,
			};
		});
	}, [models, activeWindow]);

	const activeModels = useMemo(() => models.filter((m) => m.backtest?.windows?.length), [models]);

	if (activeModels.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">Accuracy Trend</CardTitle>
				</CardHeader>
				<CardBody>
					<div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
						No backtest data available yet
					</div>
				</CardBody>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">Accuracy Trend</CardTitle>
				<div className="flex gap-1">
					{WINDOW_OPTIONS.map((opt) => (
						<button
							key={opt.value}
							onClick={() => setActiveWindow(opt.value)}
							className={`px-3 py-1 text-xs rounded-full transition-colors ${
								activeWindow === opt.value
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:bg-accent"
							}`}
						>
							{opt.label}
						</button>
					))}
				</div>
			</CardHeader>
			<CardBody>
				<ResponsiveContainer width="100%" height={350}>
					<LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
						<CartesianGrid
							strokeDasharray={chartGridStyles.strokeDasharray}
							stroke={chartGridStyles.stroke}
							vertical={false}
						/>
						<XAxis
							dataKey="name"
							tick={{ fontSize: 11, fill: chartAxisStyles.tick.fill }}
							axisLine={{ stroke: chartAxisStyles.line.stroke }}
							tickLine={false}
						/>
						<YAxis
							tick={{ fontSize: 11, fill: chartAxisStyles.tick.fill }}
							axisLine={{ stroke: chartAxisStyles.line.stroke }}
							tickLine={false}
							tickFormatter={(v: number) => `${v}%`}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
						<Line
							type="monotone"
							dataKey="mape"
							name="MAPE"
							stroke={chartGridStyles.stroke}
							strokeWidth={0}
							dot={false}
							legendType="none"
						/>
						{activeModels.map((m) => {
							const window = m.backtest?.windows.find((w) => w.days === activeWindow);
							return (
								<Line
									key={m.modelId}
									type="monotone"
									dataKey="mape"
									name={m.displayName}
									stroke={MODEL_COLORS[m.modelId] || "#6B7280"}
									strokeWidth={2}
									dot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }}
									activeDot={{ r: 6, strokeWidth: 2 }}
									data={[{ name: m.displayName, mape: window?.mape ?? null }]}
									connectNulls={false}
									isAnimationActive={true}
									animationDuration={chartAnimations.duration}
								/>
							);
						})}
					</LineChart>
				</ResponsiveContainer>
			</CardBody>
		</Card>
	);
}
