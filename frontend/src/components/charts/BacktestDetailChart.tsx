"use client";

import {
	chartAnimations,
	chartAxisStyles,
	chartGridStyles,
	chartTooltipStyles,
} from "@/lib/chart-config";
import { formatDecimal } from "@/lib/format";
import { dynamicRecharts } from "@/lib/recharts-lazy";
import type { PredictionLog } from "@/types/accuracy";

// Lazy recharts primitives via the shared module (ssr:false — recharts needs
// the DOM); replaces 9 per-component dynamic() casts.
const {
	ResponsiveContainer,
	ComposedChart,
	Line,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
} = dynamicRecharts();

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
					{entry.name}: {entry.value !== undefined ? formatDecimal(entry.value, 2) : "N/A"}
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
						fill="#8B6914"
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
						fill="#8B6914"
						fillOpacity={0.08}
						dot={false}
						name="Confidence Interval"
					/>
				)}
				<Line
					type="monotone"
					dataKey="predicted"
					stroke="#8B6914"
					strokeWidth={2}
					dot={{ r: 3, fill: "#8B6914" }}
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
