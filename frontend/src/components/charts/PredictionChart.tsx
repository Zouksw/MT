"use client";

import { Download, FileEdit, ImageIcon, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
	areaChartStyles,
	chartAnimations,
	chartAxisStyles,
	chartColors,
	chartGridStyles,
	chartTooltipStyles,
	lineChartStyles,
} from "@/lib/chart-config";

// Spinner for loading states
const Spinner = () => (
	<div className="flex items-center justify-center h-full">
		<div className="w-8 h-8 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
	</div>
);

// Dynamic imports for Recharts components to reduce initial bundle size
const Line = dynamic(() => import("recharts").then((mod) => ({ default: mod.Line })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const XAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.XAxis })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const YAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.YAxis })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const CartesianGrid = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const Tooltip = dynamic(() => import("recharts").then((mod) => ({ default: mod.Tooltip })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const Legend = dynamic(() => import("recharts").then((mod) => ({ default: mod.Legend })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const ResponsiveContainer = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
	{ ssr: false, loading: () => <Spinner /> },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const ComposedChart = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ComposedChart })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const Area = dynamic(() => import("recharts").then((mod) => ({ default: mod.Area })), {
	ssr: false,
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const ReferenceLine = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ReferenceLine })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

interface DataPoint {
	timestamp: number;
	value: number;
	isPrediction?: boolean;
	lowerBound?: number;
	upperBound?: number;
}

interface PredictionChartProps {
	timeseries: string;
	historicalData: Array<{ timestamp: number; value: number }>;
	predictionData: {
		timestamps: number[];
		values: number[];
		confidence?: number[];
	};
	algorithm: string;
	height?: number;
	onExport?: (format: "png" | "csv") => void;
}

export const PredictionChart: React.FC<PredictionChartProps> = ({
	timeseries,
	historicalData,
	predictionData,
	algorithm,
	height = 450,
	onExport,
}) => {
	const [expanded, setExpanded] = useState(false);
	const [exporting, setExporting] = useState(false);
	const chartRef = useRef<HTMLDivElement>(null);
	const toast = useToast();

	// Combine historical and prediction data
	const chartData = React.useMemo(() => {
		const historical: DataPoint[] = historicalData.map((d) => ({
			timestamp: d.timestamp,
			value: d.value,
			isPrediction: false,
		}));

		// Determine last historical timestamp for forecast alignment

		const predictions = predictionData.timestamps.map((ts, i) => {
			const point: DataPoint = {
				timestamp: ts,
				value: predictionData.values[i],
				isPrediction: true,
			};

			// Add confidence intervals if available
			if (predictionData.confidence && predictionData.confidence[i] !== undefined) {
				const confidence = predictionData.confidence[i];
				point.lowerBound = predictionData.values[i] - confidence;
				point.upperBound = predictionData.values[i] + confidence;
			}

			return point;
		});

		return [...historical, ...predictions];
	}, [historicalData, predictionData]);

	// Format timestamp for display
	const formatTimestamp = (ts: number) => {
		const date = new Date(ts);
		return date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Format value for display
	const formatValue = (val: number) => {
		return typeof val === "number" ? val.toFixed(2) : val;
	};

	// Export chart as PNG
	const exportAsPNG = async () => {
		if (!chartRef.current) return;

		setExporting(true);
		try {
			// Dynamic import html2canvas
			const html2canvas = (await import("html2canvas")).default;

			const canvas = await html2canvas(chartRef.current, {
				backgroundColor: "#ffffff",
				scale: 2,
			});

			const link = document.createElement("a");
			link.download = `prediction-${timeseries.replace(/\./g, "-")}-${Date.now()}.png`;
			link.href = canvas.toDataURL("image/png");
			link.click();

			toast.showSuccess("Chart exported as PNG");
			onExport?.("png");
		} catch {
			toast.showError("Failed to export chart");
		} finally {
			setExporting(false);
		}
	};

	// Export data as CSV
	const exportAsCSV = () => {
		try {
			const headers = ["Timestamp", "Value", "Type", "Lower Bound", "Upper Bound"];
			const rows = chartData.map((d) => [
				new Date(d.timestamp).toISOString(),
				d.value.toFixed(4),
				d.isPrediction ? "Prediction" : "Historical",
				d.lowerBound?.toFixed(4) || "",
				d.upperBound?.toFixed(4) || "",
			]);

			const csv = [headers, ...rows]
				.map((row) => row.map((cell) => `"${cell}"`).join(","))
				.join("\n");

			const blob = new Blob([csv], { type: "text/csv" });
			const link = document.createElement("a");
			link.download = `prediction-${timeseries.replace(/\./g, "-")}-${Date.now()}.csv`;
			const url = URL.createObjectURL(blob);
			link.href = url;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			toast.showSuccess("Data exported as CSV");
			onExport?.("csv");
		} catch {
			toast.showError("Failed to export data");
		}
	};

	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
	const CustomTooltip = ({
		active,
		payload,
	}: {
		active?: boolean;
		payload?: Array<{ payload: Record<string, unknown> }>;
	}) => {
		if (active && payload?.length) {
			const data = payload[0].payload;
			return (
				<div
					style={{
						backgroundColor: chartTooltipStyles.backgroundColor,
						border: chartTooltipStyles.border,
						borderRadius: chartTooltipStyles.borderRadius,
						padding: chartTooltipStyles.padding,
						boxShadow: chartTooltipStyles.boxShadow,
						minWidth: 180,
					}}
				>
					<p style={{ margin: 0, fontSize: 12, color: chartColors.gray600, marginBottom: 8 }}>
						{formatTimestamp(data.timestamp)}
					</p>
					<p
						style={{
							margin: "4px 0 0 0",
							fontSize: 14,
							fontWeight: 600,
							color: chartColors.gray900,
						}}
					>
						Value: {formatValue(data.value)}
					</p>
					{data.isPrediction && (
						<p style={{ margin: "4px 0 0 0", fontSize: 11, color: chartColors.gray600 }}>
							<span
								style={{
									padding: "2px 6px",
									background: chartColors.primaryLight,
									borderRadius: 4,
									color: chartColors.primaryDark,
								}}
							>
								Prediction
							</span>
						</p>
					)}
					{data.lowerBound !== undefined && (
						<p style={{ margin: "4px 0 0 0", fontSize: 11, color: chartColors.gray600 }}>
							95% CI: [{formatValue(data.lowerBound)}, {formatValue(data.upperBound)}]
						</p>
					)}
				</div>
			);
		}
		return null;
	};

	// Calculate statistics
	const historicalStats = React.useMemo(() => {
		if (historicalData.length === 0) return null;
		const values = historicalData.map((d) => d.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		return { min, max, mean, count: values.length };
	}, [historicalData]);

	const predictionStats = React.useMemo(() => {
		if (predictionData.values.length === 0) return null;
		const values = predictionData.values;
		const min = Math.min(...values);
		const max = Math.max(...values);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		return { min, max, mean, count: values.length };
	}, [predictionData.values]);

	if (chartData.length === 0) {
		return (
			<Card>
				<div className="p-10 text-center">
					<Spinner />
					<p className="mt-3 text-sm text-gray-500">Loading prediction data...</p>
				</div>
			</Card>
		);
	}

	const hasConfidence = predictionData.confidence && predictionData.confidence.length > 0;

	return (
		<div ref={chartRef}>
			<Card>
				<div className={expanded ? "p-6" : "p-5"}>
					{/* Header */}
					<div className="flex justify-between items-center mb-5">
						<div className="flex flex-col gap-0">
							<span className="font-semibold text-base text-gray-900 dark:text-white">
								Prediction Chart: {timeseries}
							</span>
							<span className="text-xs text-muted-foreground">
								Algorithm: {algorithm.toUpperCase()} &bull; {chartData.length} data points
							</span>
						</div>

						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={exportAsPNG}
								isLoading={exporting}
								aria-label="Export chart as PNG image"
							>
								<ImageIcon className="size-3.5 mr-1" />
								PNG
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={exportAsCSV}
								aria-label="Export chart data as CSV spreadsheet"
							>
								<FileEdit className="size-3.5 mr-1" />
								CSV
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setExpanded(!expanded)}
								aria-label={
									expanded ? "Collapse chart to normal size" : "Expand chart to full size"
								}
							>
								{expanded ? (
									<Upload className="size-3.5 mr-1" />
								) : (
									<Download className="size-3.5 mr-1" />
								)}
								{expanded ? "Collapse" : "Expand"}
							</Button>
						</div>
					</div>

					{/* Statistics */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
						{historicalStats && (
							<>
								<div
									className="p-3 rounded text-center"
									style={{ background: chartColors.purple, opacity: 0.15 }}
								>
									<div className="text-xs font-medium text-muted-foreground mb-1">
										Historical Mean
									</div>
									<div className="text-lg font-semibold text-gray-900 dark:text-white">
										{formatValue(historicalStats.mean)}
									</div>
								</div>
								<div
									className="p-3 rounded text-center"
									style={{ background: chartColors.success, opacity: 0.15 }}
								>
									<div className="text-xs font-medium text-muted-foreground mb-1">
										Historical Range
									</div>
									<div className="text-sm font-semibold text-gray-900 dark:text-white">
										{formatValue(historicalStats.min)} - {formatValue(historicalStats.max)}
									</div>
								</div>
							</>
						)}
						{predictionStats && (
							<>
								<div
									className="p-3 rounded text-center"
									style={{ background: chartColors.warning, opacity: 0.15 }}
								>
									<div className="text-xs font-medium text-muted-foreground mb-1">
										Prediction Mean
									</div>
									<div className="text-lg font-semibold text-gray-900 dark:text-white">
										{formatValue(predictionStats.mean)}
									</div>
								</div>
								<div
									className="p-3 rounded text-center"
									style={{ background: chartColors.pink, opacity: 0.15 }}
								>
									<div className="text-xs font-medium text-muted-foreground mb-1">
										Prediction Range
									</div>
									<div className="text-sm font-semibold text-gray-900 dark:text-white">
										{formatValue(predictionStats.min)} - {formatValue(predictionStats.max)}
									</div>
								</div>
							</>
						)}
					</div>

					{/* Chart */}
					<ResponsiveContainer width="100%" height={expanded ? height * 1.5 : height}>
						<ComposedChart
							data={chartData}
							margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
							role="img"
							aria-label={`Prediction chart for ${timeseries} using ${algorithm} algorithm. Showing historical data and ${predictionData.timestamps.length} forecasted data points with confidence intervals.`}
						>
							<CartesianGrid
								strokeDasharray={chartGridStyles.strokeDasharray}
								stroke={chartGridStyles.stroke}
								strokeWidth={chartGridStyles.strokeWidth}
							/>
							<XAxis
								dataKey="timestamp"
								tickFormatter={formatTimestamp}
								stroke={chartAxisStyles.stroke}
								tick={chartAxisStyles.tick}
							/>
							<YAxis
								tickFormatter={formatValue}
								stroke={chartAxisStyles.stroke}
								tick={chartAxisStyles.tick}
							/>
							<Tooltip content={<CustomTooltip />} />
							<Legend />

							{/* Confidence interval area (for predictions only) */}
							{hasConfidence && (
								<Area
									type="monotone"
									dataKey="upperBound"
									stroke="none"
									fill={areaChartStyles.fill}
									fillOpacity={areaChartStyles.fillOpacity}
									isAnimationActive={false}
								/>
							)}

							{/* Historical data line */}
							<Line
								type="monotone"
								dataKey="value"
								stroke={lineChartStyles.stroke}
								strokeWidth={lineChartStyles.strokeWidth}
								dot={false}
								activeDot={lineChartStyles.activeDot}
								connectNulls={false}
								isAnimationActive={true}
								animationDuration={chartAnimations.duration}
							/>

							{/* Reference line at prediction start */}
							{historicalData.length > 0 && (
								<ReferenceLine
									x={historicalData[historicalData.length - 1].timestamp}
									stroke={chartColors.gray400}
									strokeDasharray="5 5"
									label={{
										value: "Prediction Start",
										fill: chartColors.gray500,
										fontSize: 11,
										position: "top",
									}}
								/>
							)}
						</ComposedChart>
					</ResponsiveContainer>

					{/* Legend info */}
					<div className="mt-4 flex justify-center gap-6 text-xs">
						<div className="flex items-center gap-2">
							<div style={{ width: 20, height: 3, background: lineChartStyles.stroke }} />
							<span style={{ color: chartColors.gray600 }}>Historical Data</span>
						</div>
						{hasConfidence && (
							<div className="flex items-center gap-2">
								<div
									style={{
										width: 20,
										height: 3,
										background: areaChartStyles.fill,
										opacity: areaChartStyles.fillOpacity,
									}}
								/>
								<span style={{ color: chartColors.gray600 }}>95% Confidence Interval</span>
							</div>
						)}
					</div>
				</div>
			</Card>
		</div>
	);
};

export default PredictionChart;
