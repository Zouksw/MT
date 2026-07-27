"use client";

import { formatPrice } from "@/lib/format";
import { dynamicRecharts } from "@/lib/recharts-lazy";

/**
 * CutPriceHistoryChart — a multi-source price-over-time line chart for a
 * single beef cut (PRODUCT-SPEC §5.2 — the cut detail page should show a
 * real time-series chart, not just a table).
 *
 * Each source (e.g. "USDA-AMS (US)", "MLA (AU)") becomes one line, letting
 * the user compare origins for the same cut at a glance — the "产地对比"
 * analysis the spec calls for. The table view remains below for exact values.
 *
 * Data shape: an array of per-source price series. We pivot it into rows
 * keyed by date with one column per source for recharts.
 */

interface PricePoint {
	date: string;
	price: number;
	factory?: { code: string; name: string; country: string };
	grade?: string;
}

export interface CutPriceHistoryChartProps {
	/** Prices grouped by source label: { "USDA (US)": [...points], "MLA (AU)": [...] } */
	bySource: Record<string, PricePoint[]>;
	height?: number;
}

// Dynamically import recharts components so the chart doesn't bloat the
// initial bundle (matches the ForecastTrendChart pattern).
const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } =
	dynamicRecharts();

// A distinct color per source line.
const SERIES_COLORS = ["#8B6914", "#2563EB", "#16A34A", "#DC2626", "#9333EA", "#0891B2"];

export function CutPriceHistoryChart({ bySource, height = 320 }: CutPriceHistoryChartProps) {
	const sources = Object.keys(bySource);

	// No data — honest empty state, not a blank chart.
	const totalPoints = sources.reduce((sum, s) => sum + bySource[s].length, 0);
	if (totalPoints === 0) {
		return (
			<div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
				No price history to chart yet.
			</div>
		);
	}

	// Pivot: collect all dates, then build one row per date with a column per source.
	// Each source may not have a price on every date → undefined (recharts gaps the line).
	const dateSet = new Set<string>();
	const byDateBySource: Record<string, Record<string, number>> = {};
	for (const src of sources) {
		for (const p of bySource[src]) {
			const d = typeof p.date === "string" ? p.date.slice(0, 10) : String(p.date);
			dateSet.add(d);
			if (!byDateBySource[d]) byDateBySource[d] = {};
			byDateBySource[d][src] = p.price;
		}
	}
	const sortedDates = [...dateSet].sort();
	const chartData = sortedDates.map((d) => ({
		date: d,
		...sources.reduce(
			(acc, src) => {
				const v = byDateBySource[d]?.[src];
				if (v !== undefined) acc[src] = v;
				return acc;
			},
			{} as Record<string, number>,
		),
	}));

	return (
		<ResponsiveContainer width="100%" height={height}>
			<LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
				<CartesianGrid strokeDasharray="3 3" className="opacity-30" />
				<XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
				<YAxis
					tick={{ fontSize: 11 }}
					domain={["auto", "auto"]}
					tickFormatter={(v: number) => formatPrice(v, false)}
					width={60}
				/>
				<Tooltip
					formatter={(value) => [`${formatPrice(Number(value), false)} USD/kg`, ""]}
					labelStyle={{ fontSize: 12 }}
				/>
				<Legend wrapperStyle={{ fontSize: 12 }} />
				{sources.map((src, i) => (
					<Line
						key={src}
						type="monotone"
						dataKey={src}
						stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
						strokeWidth={2}
						dot={{ r: 2 }}
						connectNulls
					/>
				))}
			</LineChart>
		</ResponsiveContainer>
	);
}

export default CutPriceHistoryChart;
