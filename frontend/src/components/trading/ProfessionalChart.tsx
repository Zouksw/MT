"use client";

import type {
	ChartOptions,
	DeepPartial,
	IChartApi,
	ISeriesApi,
	CandlestickData as LWCandlestickData,
	HistogramData as LWHistogramData,
	LineData as LWLineData,
	MouseEventParams,
	Time,
	UTCTimestamp,
} from "lightweight-charts";
import {
	CandlestickSeries,
	ColorType,
	CrosshairMode,
	createChart,
	HistogramSeries,
	LineSeries,
	LineStyle,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Props Types ────────────────────────────────────────────────────────────

export interface CandlestickDataPoint {
	time: string; // ISO date string "YYYY-MM-DD"
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

export interface VolumeDataPoint {
	time: string;
	value: number;
	color?: string;
}

export interface PredictionOverlay {
	time: string;
	predicted: number;
	upperBound: number;
	lowerBound: number;
}

interface ProfessionalChartProps {
	/** OHLCV candlestick data */
	data: CandlestickDataPoint[];
	/** Optional volume histogram data */
	volume?: VolumeDataPoint[];
	/** AI prediction overlay with confidence bands */
	predictions?: PredictionOverlay[];
	/** Horizontal support price line */
	supportLevel?: number;
	/** Horizontal resistance price line */
	resistanceLevel?: number;
	/** Show loading skeleton */
	loading?: boolean;
	/** Chart height in pixels */
	height?: number;
	/** Dark mode toggle */
	darkMode?: boolean;
	/** Show SMA(20) indicator */
	showSma20?: boolean;
	/** Show SMA(50) indicator */
	showSma50?: boolean;
	/** Chart type: candlestick (default) or line */
	chartType?: "candlestick" | "line";
}

// ── Helper: Compute SMA ────────────────────────────────────────────────────

function computeSMA(data: CandlestickDataPoint[], period: number): LWLineData[] {
	const result: LWLineData[] = [];
	for (let i = period - 1; i < data.length; i++) {
		let sum = 0;
		for (let j = i - period + 1; j <= i; j++) {
			sum += data[j].close;
		}
		result.push({
			time: dateToTimestamp(data[i].time),
			value: sum / period,
		});
	}
	return result;
}

function dateToTimestamp(dateStr: string): UTCTimestamp {
	return (new Date(dateStr).getTime() / 1000) as UTCTimestamp;
}

// ── Chart Theme Colors ─────────────────────────────────────────────────────

const CHART_COLORS = {
	up: "#22c55e",
	down: "#ef4444",
	upBorder: "#16a34a",
	downBorder: "#dc2626",
	upWick: "#16a34a",
	downWick: "#dc2626",
	sma20: "#f59e0b",
	sma50: "#B8860B",
	support: "#10b981",
	resistance: "#ef4444",
	prediction: "#f59e0b",
	predictionBand: "rgba(245, 158, 11, 0.15)",
	volumeUp: "rgba(34, 197, 94, 0.4)",
	volumeDown: "rgba(239, 68, 68, 0.4)",
	gridLight: "#f1f5f9",
	gridDark: "#1e293b",
	textLight: "#64748b",
	textDark: "#94a3b8",
	bgLight: "#ffffff",
	bgDark: "#0f172a",
};

// ── Loading Skeleton ───────────────────────────────────────────────────────

function ChartSkeleton({ height }: { height: number }) {
	return (
		<div className="w-full rounded-lg animate-skeleton-pulse" style={{ height }}>
			<div className="flex flex-col gap-3 p-4 h-full">
				<div className="flex gap-2">
					<div className="h-3 w-16 bg-gray-200 rounded" />
					<div className="h-3 w-20 bg-gray-200 rounded" />
					<div className="h-3 w-14 bg-gray-200 rounded" />
				</div>
				<div className="flex-1 bg-gray-100 rounded flex items-center justify-center">
					<span className="text-gray-400 text-sm">Loading chart...</span>
				</div>
				<div className="flex justify-between">
					<div className="h-2 w-32 bg-gray-200 rounded" />
					<div className="h-2 w-24 bg-gray-200 rounded" />
				</div>
			</div>
		</div>
	);
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ProfessionalChart({
	data,
	volume,
	predictions,
	supportLevel,
	resistanceLevel,
	loading = false,
	height = 480,
	showSma20 = true,
	showSma50 = true,
	chartType = "candlestick",
}: ProfessionalChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<Map<string, ISeriesApi<"Candlestick" | "Line" | "Histogram">>>(
		new Map(),
	);

	// OHLCV legend state
	const [legend, setLegend] = useState<{
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
		date: string;
	} | null>(null);

	const isDark =
		typeof document !== "undefined" && document.documentElement.classList.contains("dark");

	// ── Create chart instance ──────────────────────────────────────────────

	const buildChart = useCallback(() => {
		if (!containerRef.current) return;

		// Dispose previous chart
		if (chartRef.current) {
			chartRef.current.remove();
			chartRef.current = null;
			seriesRef.current.clear();
		}

		const chartOptions: DeepPartial<ChartOptions> = {
			layout: {
				background: {
					type: ColorType.Solid,
					color: isDark ? CHART_COLORS.bgDark : CHART_COLORS.bgLight,
				},
				textColor: isDark ? CHART_COLORS.textDark : CHART_COLORS.textLight,
				fontFamily: "var(--font-geist-sans), Geist, Arial, sans-serif",
				fontSize: 12,
			},
			grid: {
				vertLines: { color: isDark ? CHART_COLORS.gridDark : CHART_COLORS.gridLight },
				horzLines: { color: isDark ? CHART_COLORS.gridDark : CHART_COLORS.gridLight },
			},
			crosshair: {
				mode: CrosshairMode.Normal,
				vertLine: { labelBackgroundColor: isDark ? "#334155" : "#B8860B" },
				horzLine: { labelBackgroundColor: isDark ? "#334155" : "#B8860B" },
			},
			rightPriceScale: {
				borderColor: isDark ? "#1e293b" : "#e2e8f0",
				scaleMargins: { top: 0.1, bottom: 0.2 },
			},
			timeScale: {
				borderColor: isDark ? "#1e293b" : "#e2e8f0",
				timeVisible: false,
				rightOffset: 5,
				barSpacing: 8,
			},
			handleScroll: { vertTouchDrag: false },
		};

		const chart = createChart(containerRef.current, chartOptions);
		chartRef.current = chart;

		// Auto-resize
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width } = entry.contentRect;
				chart.applyOptions({ width });
			}
		});
		resizeObserver.observe(containerRef.current);

		return () => {
			resizeObserver.disconnect();
			chart.remove();
		};
	}, [isDark]);

	// ── Set data on chart ──────────────────────────────────────────────────

	const setChartData = useCallback(() => {
		const chart = chartRef.current;
		if (!chart || data.length === 0) return;

		// Remove all existing series
		for (const [, series] of seriesRef.current) {
			chart.removeSeries(series);
		}
		seriesRef.current.clear();

		// Convert candlestick data
		const candleData: LWCandlestickData[] = data.map((d) => ({
			time: dateToTimestamp(d.time),
			open: d.open,
			high: d.high,
			low: d.low,
			close: d.close,
		}));

		// Main price series
		if (chartType === "candlestick") {
			const candleSeries = chart.addSeries(CandlestickSeries, {
				upColor: CHART_COLORS.up,
				downColor: CHART_COLORS.down,
				borderUpColor: CHART_COLORS.upBorder,
				borderDownColor: CHART_COLORS.downBorder,
				wickUpColor: CHART_COLORS.upWick,
				wickDownColor: CHART_COLORS.downWick,
			});
			candleSeries.setData(candleData);
			seriesRef.current.set("candlestick", candleSeries);

			// Set initial legend to last candle
			const lastCandle = data[data.length - 1];
			if (lastCandle) {
				setLegend({
					open: lastCandle.open,
					high: lastCandle.high,
					low: lastCandle.low,
					close: lastCandle.close,
					volume: lastCandle.volume ?? 0,
					date: lastCandle.time,
				});
			}
		} else {
			const lineSeries = chart.addSeries(LineSeries, {
				color: CHART_COLORS.sma50,
				lineWidth: 2,
			});
			lineSeries.setData(
				data.map((d) => ({
					time: dateToTimestamp(d.time),
					value: d.close,
				})),
			);
			seriesRef.current.set("line", lineSeries);
		}

		// ── Volume histogram ────────────────────────────────────────────────

		if (volume && volume.length > 0) {
			const volumeSeries = chart.addSeries(HistogramSeries, {
				priceFormat: { type: "volume" },
				priceScaleId: "volume",
			});
			chart.priceScale("volume").applyOptions({
				scaleMargins: { top: 0.8, bottom: 0 },
			});

			const volumeData: LWHistogramData[] = volume.map((v) => ({
				time: dateToTimestamp(v.time),
				value: v.value,
				color: v.color,
			}));
			volumeSeries.setData(volumeData);
			seriesRef.current.set("volume", volumeSeries);
		} else if (data.some((d) => d.volume != null)) {
			// Derive volume from candlestick data if not explicitly provided
			const volumeSeries = chart.addSeries(HistogramSeries, {
				priceFormat: { type: "volume" },
				priceScaleId: "volume",
			});
			chart.priceScale("volume").applyOptions({
				scaleMargins: { top: 0.8, bottom: 0 },
			});

			const volumeData: LWHistogramData[] = data
				.filter((d) => d.volume != null)
				.map((d) => ({
					time: dateToTimestamp(d.time),
					value: d.volume as number,
					color: d.close >= d.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
				}));
			volumeSeries.setData(volumeData);
			seriesRef.current.set("volume", volumeSeries);
		}

		// ── SMA indicators ──────────────────────────────────────────────────

		if (showSma20 && data.length >= 20) {
			const sma20Series = chart.addSeries(LineSeries, {
				color: CHART_COLORS.sma20,
				lineWidth: 1,
				priceLineVisible: false,
				lastValueVisible: false,
				crosshairMarkerVisible: false,
			});
			sma20Series.setData(computeSMA(data, 20));
			seriesRef.current.set("sma20", sma20Series);
		}

		if (showSma50 && data.length >= 50) {
			const sma50Series = chart.addSeries(LineSeries, {
				color: CHART_COLORS.sma50,
				lineWidth: 1,
				priceLineVisible: false,
				lastValueVisible: false,
				crosshairMarkerVisible: false,
			});
			sma50Series.setData(computeSMA(data, 50));
			seriesRef.current.set("sma50", sma50Series);
		}

		// ── Support / Resistance lines ──────────────────────────────────────

		const mainSeries = seriesRef.current.get(chartType === "candlestick" ? "candlestick" : "line");

		if (mainSeries && supportLevel != null) {
			mainSeries.createPriceLine({
				price: supportLevel,
				color: CHART_COLORS.support,
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				axisLabelVisible: true,
				title: "Support",
			});
		}

		if (mainSeries && resistanceLevel != null) {
			mainSeries.createPriceLine({
				price: resistanceLevel,
				color: CHART_COLORS.resistance,
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				axisLabelVisible: true,
				title: "Resistance",
			});
		}

		// ── AI Prediction overlay ───────────────────────────────────────────

		if (predictions && predictions.length > 0) {
			// Upper band
			const upperSeries = chart.addSeries(LineSeries, {
				color: "rgba(0,0,0,0)",
				lineWidth: 1,
				priceLineVisible: false,
				lastValueVisible: false,
				crosshairMarkerVisible: false,
			});
			upperSeries.setData(
				predictions.map((p) => ({
					time: dateToTimestamp(p.time),
					value: p.upperBound,
				})),
			);
			seriesRef.current.set("predictionUpper", upperSeries);

			// Lower band
			const lowerSeries = chart.addSeries(LineSeries, {
				color: "rgba(0,0,0,0)",
				lineWidth: 1,
				priceLineVisible: false,
				lastValueVisible: false,
				crosshairMarkerVisible: false,
			});
			lowerSeries.setData(
				predictions.map((p) => ({
					time: dateToTimestamp(p.time),
					value: p.lowerBound,
				})),
			);
			seriesRef.current.set("predictionLower", lowerSeries);

			// Predicted line
			const predSeries = chart.addSeries(LineSeries, {
				color: CHART_COLORS.prediction,
				lineWidth: 2,
				lineStyle: LineStyle.Dashed,
				priceLineVisible: false,
				lastValueVisible: true,
			});
			predSeries.setData(
				predictions.map((p) => ({
					time: dateToTimestamp(p.time),
					value: p.predicted,
				})),
			);
			seriesRef.current.set("prediction", predSeries);
		}

		// ── Crosshair move → update legend ──────────────────────────────────

		if (chartType === "candlestick") {
			chart.subscribeCrosshairMove((param: MouseEventParams) => {
				if (!param.time || !param.seriesData) return;

				const candleSeriesApi = seriesRef.current.get("candlestick");
				if (!candleSeriesApi) return;

				const candlePoint = param.seriesData.get(candleSeriesApi) as LWCandlestickData | undefined;

				if (candlePoint && "open" in candlePoint) {
					const volSeriesApi = seriesRef.current.get("volume");
					const volPoint = volSeriesApi
						? (param.seriesData.get(volSeriesApi) as LWHistogramData | undefined)
						: undefined;

					const timeStr = param.time as Time;
					setLegend({
						open: candlePoint.open,
						high: candlePoint.high,
						low: candlePoint.low,
						close: candlePoint.close,
						volume: volPoint?.value ?? 0,
						date:
							typeof timeStr === "string"
								? timeStr
								: new Date((timeStr as number) * 1000).toISOString().slice(0, 10),
					});
				}
			});
		}

		// Fit content
		chart.timeScale().fitContent();
	}, [data, volume, predictions, supportLevel, resistanceLevel, chartType, showSma20, showSma50]);

	// ── Lifecycle: create chart ────────────────────────────────────────────

	useEffect(() => {
		const cleanup = buildChart();
		return () => {
			cleanup?.();
			chartRef.current = null;
		};
	}, [buildChart]);

	// ── Lifecycle: update data ─────────────────────────────────────────────

	useEffect(() => {
		if (chartRef.current) {
			// Defer to avoid synchronous setState within effect
			const handle = requestAnimationFrame(() => setChartData());
			return () => cancelAnimationFrame(handle);
		}
	}, [setChartData]);

	// ── Render ─────────────────────────────────────────────────────────────

	if (loading) {
		return <ChartSkeleton height={height} />;
	}

	if (data.length === 0) {
		return (
			<div
				className="flex items-center justify-center text-gray-400 text-sm rounded-lg"
				style={{ height, background: isDark ? CHART_COLORS.bgDark : CHART_COLORS.bgLight }}
			>
				No chart data available
			</div>
		);
	}

	return (
		<div className="relative w-full">
			{/* OHLCV Legend */}
			{legend && chartType === "candlestick" && (
				<div className="absolute top-2 left-3 z-10 flex gap-3 text-xs font-mono">
					<span className="text-gray-500">{legend.date}</span>
					<span>
						O{" "}
						<span className={legend.close >= legend.open ? "text-green-500" : "text-red-500"}>
							{legend.open.toFixed(2)}
						</span>
					</span>
					<span>
						H <span className="text-foreground">{legend.high.toFixed(2)}</span>
					</span>
					<span>
						L <span className="text-foreground">{legend.low.toFixed(2)}</span>
					</span>
					<span>
						C{" "}
						<span className={legend.close >= legend.open ? "text-green-500" : "text-red-500"}>
							{legend.close.toFixed(2)}
						</span>
					</span>
					{legend.volume > 0 && (
						<span className="text-gray-500">V {legend.volume.toLocaleString()}</span>
					)}
				</div>
			)}

			{/* Indicator legend */}
			<div className="absolute top-2 right-3 z-10 flex gap-3 text-xs">
				{showSma20 && (
					<span className="flex items-center gap-1">
						<span
							className="inline-block w-3 h-0.5 rounded"
							style={{ backgroundColor: CHART_COLORS.sma20 }}
						/>
						<span className="text-gray-500">SMA20</span>
					</span>
				)}
				{showSma50 && (
					<span className="flex items-center gap-1">
						<span
							className="inline-block w-3 h-0.5 rounded"
							style={{ backgroundColor: CHART_COLORS.sma50 }}
						/>
						<span className="text-gray-500">SMA50</span>
					</span>
				)}
				{predictions && predictions.length > 0 && (
					<span className="flex items-center gap-1">
						<span
							className="inline-block w-3 h-0.5 rounded"
							style={{ backgroundColor: CHART_COLORS.prediction, borderStyle: "dashed" }}
						/>
						<span className="text-gray-500">AI Prediction</span>
					</span>
				)}
			</div>

			{/* Chart container */}
			<div ref={containerRef} className="w-full rounded-lg" style={{ height }} />
		</div>
	);
}
