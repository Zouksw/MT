"use client";

import dynamic from "next/dynamic";
import type React from "react";
import {
	chartAnimations,
	chartAxisStyles,
	chartGridStyles,
	chartTooltipStyles,
} from "@/lib/chart-config";
import type { PredictionLog } from "@/types/accuracy";

const ResponsiveContainer = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
	{ ssr: false, loading: () => <div className="h-[300px] bg-muted animate-pulse rounded" /> },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const ComposedChart = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ComposedChart })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const Line = dynamic(() => import("recharts").then((mod) => ({ default: mod.Line })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const Area = dynamic(() => import("recharts").then((mod) => ({ default: mod.Area })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

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

interface BacktestDetailChartProps {
	prediction: PredictionLog;
}

function CustomTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ name: string; value: number | undefined; color: string }>;
	label?: string | number;
}) {
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
			<p className="text-xs font-medium text-muted-foreground mb-1">Step {label}</p>
			{payload.map((entry: { name: string; value: number | undefined; color: string }) => (
				<p key={entry.name} className="text-xs" style={{ color: entry.color }}>
					{entry.name}: {entry.value !== undefined ? entry.value.toFixed(2) : "N/A"}
				</p>
			))}
		</div>
	);
}

export function BacktestDetailChart({ prediction }: BacktestDetailChartProps) {
	const predicted = Array.isArray(prediction.predictedValues) ? prediction.predictedValues : [];
	const actual = Array.isArray(prediction.actualValues) ? prediction.actualValues : [];
	const lower = Array.isArray(prediction.lowerBounds) ? prediction.lowerBounds : null;
	const upper = Array.isArray(prediction.upperBounds) ? prediction.upperBounds : null;

	if (predicted.length === 0) {
		return (
			<div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
				No prediction data available
			</div>
		);
	}

	const data = predicted.map((val: number, i: number) => ({
		step: i + 1,
		predicted: val,
		actual: actual[i] ?? undefined,
		lower: lower?.[i] ?? undefined,
		upper: upper?.[i] ?? undefined,
	}));

	return (
		<ResponsiveContainer width="100%" height={300}>
			<ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
				<CartesianGrid
					strokeDasharray={chartGridStyles.strokeDasharray}
					stroke={chartGridStyles.stroke}
					vertical={false}
				/>
				<XAxis
					dataKey="step"
					tick={{ fontSize: 11, fill: chartAxisStyles.tick.fill }}
					axisLine={{ stroke: chartAxisStyles.line.stroke }}
					tickLine={false}
					label={{
						value: "Horizon Step",
						position: "insideBottom",
						offset: -10,
						fontSize: 11,
						fill: chartAxisStyles.tick.fill,
					}}
				/>
				<YAxis
					tick={{ fontSize: 11, fill: chartAxisStyles.tick.fill }}
					axisLine={{ stroke: chartAxisStyles.line.stroke }}
					tickLine={false}
				/>
				<Tooltip content={<CustomTooltip />} />
				<Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
				{lower && upper && (
					<Area
						type="monotone"
						dataKey="upper"
						stroke="none"
						fill="#B8860B"
						fillOpacity={0.08}
						dot={false}
						name="Upper Bound"
						legendType="none"
					/>
				)}
				{lower && upper && (
					<Area
						type="monotone"
						dataKey="lower"
						stroke="none"
						fill="#B8860B"
						fillOpacity={0.08}
						dot={false}
						name="Confidence Interval"
					/>
				)}
				<Line
					type="monotone"
					dataKey="predicted"
					stroke="#B8860B"
					strokeWidth={2}
					dot={{ r: 3, fill: "#B8860B" }}
					name="Predicted"
					isAnimationActive={true}
					animationDuration={chartAnimations.duration}
				/>
				{actual.length > 0 && (
					<Line
						type="monotone"
						dataKey="actual"
						stroke="#6B7280"
						strokeWidth={2}
						strokeDasharray="5 5"
						dot={{ r: 3, fill: "#6B7280" }}
						name="Actual"
						isAnimationActive={true}
						animationDuration={chartAnimations.duration}
					/>
				)}
			</ComposedChart>
		</ResponsiveContainer>
	);
}
