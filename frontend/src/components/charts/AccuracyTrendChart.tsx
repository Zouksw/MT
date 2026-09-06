"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import {
	chartAnimations,
	chartAxisStyles,
	chartGridStyles,
	chartTooltipStyles,
} from "@/lib/chart-config";
import { formatPercentValue } from "@/lib/format";
import { dynamicRecharts } from "@/lib/recharts-lazy";
import type { ModelWithBacktest } from "@/types/accuracy";
import { MODEL_COLORS } from "@/types/accuracy";

// Lazy recharts primitives via the shared module (ssr:false — recharts needs
// the DOM); replaces 8 per-component dynamic() casts.
const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } =
	dynamicRecharts();

type WindowSize = 7 | 30 | 90;

const WINDOW_OPTIONS: { label: string; value: WindowSize }[] = [
	{ label: "7 Days", value: 7 },
	{ label: "30 Days", value: 30 },
	{ label: "90 Days", value: 90 },
];

/** Axis floor for log scale (MAPE of exactly 0 would be -∞ in log space). */
const LOG_FLOOR = 0.1;

interface AccuracyTrendChartProps {
	models: ModelWithBacktest[];
}

function CustomTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ name: string; value: number | null; color: string }>;
	label?: string;
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
			<p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
			{payload.map((entry: { name: string; value: number | null; color: string }) => (
				<p key={entry.name} className="text-xs" style={{ color: entry.color }}>
					{entry.name}: {entry.value !== null ? formatPercentValue(entry.value, 1) : "N/A"}
				</p>
			))}
		</div>
	);
}

export function AccuracyTrendChart({ models }: AccuracyTrendChartProps) {
	const [activeWindow, setActiveWindow] = useState<WindowSize>(30);

	// Small-denominator MAPE spikes (KNOWN-ISSUES R5) give this chart a heavy
	// tail — on a linear axis the sub-2% cluster that matters flattens onto the
	// floor. When the spread spans more than one order of magnitude, switch the
	// y-axis to log scale instead of capping: nothing is hidden, every dot
	// stays visible, and the tight low-error cluster becomes readable. Zero
	// MAPE maps to the 0.1 axis floor (log needs > 0); tooltips still carry
	// the exact figure.
	//
	// One row per model, keyed by modelId: a per-model Line then reads its
	// value from the shared row, so the dot lands under its own x label.
	// (Per-child `data` arrays align by index in recharts — every dot used to
	// stack on the first category.)
	const { chartData, useLogScale } = useMemo(() => {
		const modelsWithBacktest = models.filter((m) => m.backtest?.windows?.length);
		if (modelsWithBacktest.length === 0) return { chartData: [], useLogScale: false };

		const rows = modelsWithBacktest.map((m) => {
			const window = m.backtest?.windows.find((w) => w.days === activeWindow);
			return { name: m.displayName, modelId: m.modelId, mape: window?.mape ?? null };
		});

		const positives = rows.map((d) => d.mape).filter((v): v is number => v != null && v > 0);
		const spread = positives.length >= 2 ? Math.max(...positives) / Math.min(...positives) : 1;
		const log = spread > 20;
		const chartData = rows.map((d) => ({
			name: d.name,
			[d.modelId]: d.mape != null && log && d.mape <= 0 ? LOG_FLOOR : d.mape,
		}));
		return { chartData, useLogScale: log };
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
							type="button"
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
							scale={useLogScale ? "log" : "auto"}
							domain={useLogScale ? [LOG_FLOOR, "auto"] : undefined}
							allowDataOverflow={false}
						/>
						<Tooltip content={<CustomTooltip />} />
						<Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
						{activeModels.map((m) => (
							<Line
								key={m.modelId}
								type="monotone"
								dataKey={m.modelId}
								name={m.displayName}
								stroke={MODEL_COLORS[m.modelId] || "#6B7280"}
								strokeWidth={2}
								dot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }}
								activeDot={{ r: 6, strokeWidth: 2 }}
								connectNulls={false}
								isAnimationActive={true}
								animationDuration={chartAnimations.duration}
							/>
						))}
					</LineChart>
				</ResponsiveContainer>
				{useLogScale && (
					<p className="text-[11px] text-muted-foreground mt-1">
						Logarithmic y-axis — MAPE spread spans multiple orders of magnitude (small-denominator
						spikes). Hover any point for the exact figure.
					</p>
				)}
			</CardBody>
		</Card>
	);
}
