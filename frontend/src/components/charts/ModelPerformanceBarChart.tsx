"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getMapeFillColor } from "@/lib/ai-utils";
import {
	chartAnimations,
	chartAxisStyles,
	chartGridStyles,
	chartTooltipStyles,
} from "@/lib/chart-config";
import { formatPercentValue } from "@/lib/format";
import { dynamicRecharts } from "@/lib/recharts-lazy";
import type { ModelWithBacktest } from "@/types/accuracy";

// Lazy recharts primitives via the shared module (ssr:false — recharts needs
// the DOM); replaces 9 per-component dynamic() casts.
const {
	ResponsiveContainer,
	BarChart,
	Bar,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ReferenceLine,
} = dynamicRecharts();

interface ModelPerformanceBarChartProps {
	models: ModelWithBacktest[];
}

function CustomTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{ payload: { name: string; mape: number | null; predictions: number } }>;
}) {
	if (!active || !payload?.length) return null;
	const data = payload[0].payload;
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
			<p className="text-xs font-medium text-foreground mb-1">{data.name}</p>
			<p className="text-xs text-muted-foreground">
				MAPE: {data.mape !== null ? formatPercentValue(data.mape, 1) : "N/A"}
			</p>
			<p className="text-xs text-muted-foreground">Predictions: {data.predictions}</p>
		</div>
	);
}

export function ModelPerformanceBarChart({ models }: ModelPerformanceBarChartProps) {
	const { chartData, avgMape } = useMemo(() => {
		const valid = models
			.filter((m) => m.avgMape !== null && m.avgMape !== undefined)
			.sort((a, b) => (a.avgMape ?? Infinity) - (b.avgMape ?? Infinity));

		const data = valid.map((m) => ({
			name: m.displayName,
			mape: m.avgMape,
			predictions: m.predictionCount,
			modelId: m.modelId,
			fill: getMapeFillColor(m.avgMape),
		}));

		const avg =
			valid.length > 0 ? valid.reduce((sum, m) => sum + (m.avgMape ?? 0), 0) / valid.length : null;

		return { chartData: data, avgMape: avg };
	}, [models]);

	if (chartData.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">Model Performance</CardTitle>
				</CardHeader>
				<CardBody>
					<div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
						No accuracy data available yet
					</div>
				</CardBody>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">Model Performance</CardTitle>
			</CardHeader>
			<CardBody>
				<ResponsiveContainer width="100%" height={350}>
					<BarChart
						data={chartData}
						layout="vertical"
						margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
					>
						<CartesianGrid
							strokeDasharray={chartGridStyles.strokeDasharray}
							stroke={chartGridStyles.stroke}
							horizontal={false}
						/>
						<XAxis
							type="number"
							tick={{ fontSize: 11, fill: chartAxisStyles.tick.fill }}
							axisLine={{ stroke: chartAxisStyles.line.stroke }}
							tickLine={false}
							tickFormatter={(v: number) => `${v}%`}
						/>
						<YAxis
							type="category"
							dataKey="name"
							tick={{ fontSize: 11, fill: chartAxisStyles.tick.fill }}
							axisLine={{ stroke: chartAxisStyles.line.stroke }}
							tickLine={false}
							width={70}
						/>
						<Tooltip content={<CustomTooltip />} />
						{avgMape !== null && (
							<ReferenceLine
								x={avgMape}
								stroke="#EF4444"
								strokeDasharray="5 5"
								strokeWidth={1.5}
								label={{
									value: `Avg: ${formatPercentValue(avgMape, 1)}`,
									position: "top",
									fill: "#EF4444",
									fontSize: 11,
								}}
							/>
						)}
						<Bar
							dataKey="mape"
							radius={[0, 4, 4, 0]}
							isAnimationActive={true}
							animationDuration={chartAnimations.duration}
						>
							{chartData.map((entry) => (
								<Cell key={entry.modelId} fill={entry.fill} />
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</CardBody>
		</Card>
	);
}
