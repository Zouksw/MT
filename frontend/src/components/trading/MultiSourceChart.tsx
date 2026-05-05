"use client";

import type {
	ChartOptions,
	DeepPartial,
	IChartApi,
	LineData,
	UTCTimestamp,
} from "lightweight-charts";
import { ColorType, CrosshairMode, createChart, LineSeries } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

interface MultiSourceChartProps {
	sources: Record<string, Array<{ date: string; close: number }>>;
	height?: number;
}

const SOURCE_COLORS: Record<string, string> = {
	world_bank: "#8B5CF6",
	cme: "#F59E0B",
	usda_ams: "#10B981",
	fao: "#3B82F6",
	fred: "#EF4444",
	usda_psd: "#14B8A6",
	china_mara: "#F97316",
	china_customs: "#EC4899",
	dce: "#6366F1",
	baltic: "#06B6D4",
	abares: "#84CC16",
	seed: "#64748B",
	manual: "#78716C",
};

const SOURCE_LABELS: Record<string, string> = {
	world_bank: "World Bank",
	cme: "CME Group",
	usda_ams: "USDA AMS",
	fao: "FAO",
	fred: "FRED",
	usda_psd: "USDA PSD",
	china_mara: "China MARA",
	china_customs: "China Customs",
	dce: "DCE/CZCE",
	baltic: "Baltic Exchange",
	abares: "ABARES",
	seed: "Historical",
	manual: "Manual",
};

function dateToTimestamp(dateStr: string): UTCTimestamp {
	return (new Date(dateStr).getTime() / 1000) as UTCTimestamp;
}

export default function MultiSourceChart({ sources, height = 400 }: MultiSourceChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!containerRef.current) return;

		const isDark = document.documentElement.classList.contains("dark");

		const chartOptions: DeepPartial<ChartOptions> = {
			layout: {
				background: {
					type: ColorType.Solid,
					color: isDark ? "var(--bg-surface, #171717)" : "#ffffff",
				},
				textColor: isDark ? "#94a3b8" : "#64748b",
			},
			grid: {
				vertLines: { color: isDark ? "#1e293b" : "#f1f5f9" },
				horzLines: { color: isDark ? "#1e293b" : "#f1f5f9" },
			},
			crosshair: { mode: CrosshairMode.Normal },
			rightPriceScale: { borderColor: isDark ? "#1e293b" : "#e2e8f0" },
			timeScale: { borderColor: isDark ? "#1e293b" : "#e2e8f0", timeVisible: false },
			width: containerRef.current.clientWidth,
			height,
		};

		const chart = createChart(containerRef.current, chartOptions);
		chartRef.current = chart;

		const sourceNames = Object.keys(sources);
		const colorList = [
			"#8B5CF6",
			"#F59E0B",
			"#10B981",
			"#3B82F6",
			"#EF4444",
			"#14B8A6",
			"#F97316",
			"#EC4899",
		];

		sourceNames.forEach((sourceKey, idx) => {
			if (hiddenSources.has(sourceKey)) return;

			const lineData: LineData[] = sources[sourceKey]
				.map((p) => ({ time: dateToTimestamp(p.date), value: p.close }))
				.sort((a, b) => (a.time as number) - (b.time as number));

			if (lineData.length === 0) return;

			const color = SOURCE_COLORS[sourceKey] || colorList[idx % colorList.length];
			const series = chart.addSeries(LineSeries, {
				color,
				lineWidth: 2,
				title: SOURCE_LABELS[sourceKey] || sourceKey,
				crosshairMarkerVisible: true,
				lastValueVisible: false,
				priceLineVisible: false,
			});
			series.setData(lineData);
		});

		chart.timeScale().fitContent();

		const handleResize = () => {
			if (containerRef.current) {
				chart.applyOptions({ width: containerRef.current.clientWidth });
			}
		};
		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			chart.remove();
			chartRef.current = null;
		};
	}, [sources, height, hiddenSources]);

	const sourceNames = Object.keys(sources);
	if (sourceNames.length === 0) {
		return (
			<div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
				No multi-source data available for this commodity.
			</div>
		);
	}

	return (
		<div>
			{/* Source legend with toggle */}
			<div className="flex flex-wrap gap-2 mb-3">
				{sourceNames.map((key) => {
					const color = SOURCE_COLORS[key] || "#64748B";
					const isHidden = hiddenSources.has(key);
					return (
						<button type="button"
							key={key}
							onClick={() => {
								const next = new Set(hiddenSources);
								if (next.has(key)) next.delete(key);
								else next.add(key);
								setHiddenSources(next);
							}}
							className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity"
							style={{
								backgroundColor: `${color}20`,
								color,
								opacity: isHidden ? 0.35 : 1,
								textDecoration: isHidden ? "line-through" : "none",
							}}
						>
							<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
							{SOURCE_LABELS[key] || key}
							<span className="text-[10px] opacity-70">({sources[key].length})</span>
						</button>
					);
				})}
			</div>
			<div ref={containerRef} />
		</div>
	);
}
