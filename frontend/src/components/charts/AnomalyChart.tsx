"use client";

import { Download, FileEdit, ImageIcon, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import {
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
const ComposedChart = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ComposedChart })),
	{
		loading: () => <Spinner />,
		ssr: false,
	},
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

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
	{ ssr: false },
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

const Scatter = dynamic(() => import("recharts").then((mod) => ({ default: mod.Scatter })), {
	ssr: false,
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

const Cell = dynamic(() => import("recharts").then((mod) => ({ default: mod.Cell })), {
	ssr: false,
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
}) as React.ComponentType<any>;

interface AnomalyPoint {
	timestamp: number;
	value: number;
	score: number;
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface TimeSeriesData {
	timestamp: number;
	value: number;
	isAnomaly?: boolean;
	anomalySeverity?: string;
	anomalyScore?: number;
}

interface AnomalyChartProps {
	timeseries: string;
	anomalies: AnomalyPoint[];
	historicalData?: Array<{ timestamp: number; value: number }>;
	threshold?: number;
	method?: string;
	height?: number;
	onExport?: (format: "png" | "csv") => void;
}

const severityColors = {
	LOW: chartColors.success,
	MEDIUM: chartColors.warning,
	HIGH: chartColors.error,
	CRITICAL: chartColors.purple,
};

const severityFillColors = {
	LOW: `${chartColors.success}B3`, // 70% opacity
	MEDIUM: `${chartColors.warning}B3`,
	HIGH: `${chartColors.error}B3`,
	CRITICAL: `${chartColors.purple}B3`,
};

const severityTagColor = {
	LOW: "success" as const,
	MEDIUM: "warning" as const,
	HIGH: "error" as const,
	CRITICAL: "info" as const,
};

export const AnomalyChart: React.FC<AnomalyChartProps> = ({
	timeseries,
	anomalies,
	historicalData = [],
	threshold: _threshold,
	method = "statistical",
	height = 450,
	onExport,
}) => {
	const [expanded, setExpanded] = useState(false);
	const [exporting, setExporting] = useState(false);
	const chartRef = useRef<HTMLDivElement>(null);

	// Combine historical data with anomaly markers
	const chartData = React.useMemo(() => {
		const anomalyMap = new Map(anomalies.map((a) => [a.timestamp, a]));

		const data: TimeSeriesData[] = historicalData.map((d) => ({
			timestamp: d.timestamp,
			value: d.value,
			isAnomaly: anomalyMap.has(d.timestamp),
			anomalySeverity: anomalyMap.get(d.timestamp)?.severity,
			anomalyScore: anomalyMap.get(d.timestamp)?.score,
		}));

		// Also include any anomalies not in historical data
		anomalies.forEach((a) => {
			if (!data.find((d) => d.timestamp === a.timestamp)) {
				data.push({
					timestamp: a.timestamp,
					value: a.value,
					isAnomaly: true,
					anomalySeverity: a.severity,
					anomalyScore: a.score,
				});
			}
		});

		return data.sort((a, b) => a.timestamp - b.timestamp);
	}, [historicalData, anomalies]);

	// Separate data for scatter plot (anomalies)
	const anomalyScatterData = chartData.filter((d) => d.isAnomaly);

	// Calculate statistics
	const stats = React.useMemo(() => {
		if (chartData.length === 0) return null;

		const values = chartData.map((d) => d.value);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const std = Math.sqrt(values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length);
		const min = Math.min(...values);
		const max = Math.max(...values);

		return { mean, std, min, max, count: values.length };
	}, [chartData]);

	const anomalyStats = React.useMemo(() => {
		const bySeverity: Record<string, number> = {};
		anomalies.forEach((a) => {
			bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
		});
		return {
			total: anomalies.length,
			bySeverity,
		};
	}, [anomalies]);

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
			const html2canvas = (await import("html2canvas")).default;

			const canvas = await html2canvas(chartRef.current, {
				backgroundColor: "#ffffff",
				scale: 2,
			});

			const link = document.createElement("a");
			link.download = `anomaly-${timeseries.replace(/\./g, "-")}-${Date.now()}.png`;
			link.href = canvas.toDataURL("image/png");
			link.click();

			onExport?.("png");
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("Failed to export chart:", error);
		} finally {
			setExporting(false);
		}
	};

	// Export data as CSV
	const exportAsCSV = () => {
		try {
			const headers = ["Timestamp", "Value", "Is Anomaly", "Severity", "Score"];
			const rows = chartData.map((d) => [
				new Date(d.timestamp).toISOString(),
				d.value.toFixed(4),
				d.isAnomaly ? "Yes" : "No",
				d.anomalySeverity || "",
				d.anomalyScore?.toFixed(4) || "",
			]);

			const csv = [headers, ...rows]
				.map((row) => row.map((cell) => `"${cell}"`).join(","))
				.join("\n");

			const blob = new Blob([csv], { type: "text/csv" });
			const link = document.createElement("a");
			link.download = `anomaly-${timeseries.replace(/\./g, "-")}-${Date.now()}.csv`;
			const url = URL.createObjectURL(blob);
			link.href = url;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			onExport?.("csv");
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("Failed to export data:", error);
		}
	};

	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
	const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: any }> }) => {
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
						minWidth: 200,
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
					{data.isAnomaly && (
						<>
							<p style={{ margin: "8px 0 4px 0", fontSize: 12, fontWeight: 600 }}>
								<Tag
									color={
										severityTagColor[data.anomalySeverity as keyof typeof severityTagColor] ||
										"default"
									}
								>
									{data.anomalySeverity} SEVERITY
								</Tag>
							</p>
							<p style={{ margin: "4px 0 0 0", fontSize: 11, color: chartColors.gray600 }}>
								Anomaly Score: {data.anomalyScore?.toFixed(4)}
							</p>
						</>
					)}
				</div>
			);
		}
		return null;
	};

	if (chartData.length === 0) {
		return (
			<Card>
				<div className="p-10 text-center">
					<Spinner />
					<p className="mt-3 text-sm text-gray-500">Loading anomaly data...</p>
				</div>
			</Card>
		);
	}

	return (
		<div ref={chartRef}>
			<Card>
				<div className={expanded ? "p-6" : "p-5"}>
					{/* Header */}
					<div className="flex justify-between items-center mb-5">
						<div className="flex flex-col gap-0">
							<span className="font-semibold text-base text-gray-900 dark:text-white">
								Anomaly Detection: {timeseries}
							</span>
							<span className="text-xs text-muted-foreground">
								Method: {method.toUpperCase()} &bull; {chartData.length} data points &bull;{" "}
								{anomalyStats.total} anomalies
							</span>
						</div>

						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={exportAsPNG}
								isLoading={exporting}
								aria-label="Export anomaly chart as PNG image"
							>
								<ImageIcon className="size-3.5 mr-1" />
								PNG
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={exportAsCSV}
								aria-label="Export anomaly data as CSV spreadsheet"
							>
								<FileEdit className="size-3.5 mr-1" />
								CSV
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setExpanded(!expanded)}
								aria-label={
									expanded
										? "Collapse anomaly chart to normal size"
										: "Expand anomaly chart to full size"
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

					{/* Anomaly Summary Alert */}
					{anomalyStats.total > 0 && (
						<Alert
							variant="warning"
							title={`${anomalyStats.total} Anomalies Detected`}
							className="mb-5"
						>
							<div className="flex flex-wrap gap-2">
								{anomalyStats.bySeverity.CRITICAL > 0 && (
									<Tag color="info">Critical: {anomalyStats.bySeverity.CRITICAL}</Tag>
								)}
								{anomalyStats.bySeverity.HIGH > 0 && (
									<Tag color="error">High: {anomalyStats.bySeverity.HIGH}</Tag>
								)}
								{anomalyStats.bySeverity.MEDIUM > 0 && (
									<Tag color="warning">Medium: {anomalyStats.bySeverity.MEDIUM}</Tag>
								)}
								{anomalyStats.bySeverity.LOW > 0 && (
									<Tag color="success">Low: {anomalyStats.bySeverity.LOW}</Tag>
								)}
							</div>
						</Alert>
					)}

					{/* Statistics */}
					{stats && (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
							<div
								className="p-3 rounded text-center"
								style={{ background: chartColors.purple, opacity: 0.15 }}
							>
								<div className="text-xs font-medium text-muted-foreground mb-1">Mean</div>
								<div className="text-lg font-semibold text-gray-900 dark:text-white">
									{formatValue(stats.mean)}
								</div>
							</div>
							<div
								className="p-3 rounded text-center"
								style={{ background: chartColors.success, opacity: 0.15 }}
							>
								<div className="text-xs font-medium text-muted-foreground mb-1">Std Dev</div>
								<div className="text-lg font-semibold text-gray-900 dark:text-white">
									{formatValue(stats.std)}
								</div>
							</div>
							<div
								className="p-3 rounded text-center"
								style={{ background: chartColors.warning, opacity: 0.15 }}
							>
								<div className="text-xs font-medium text-muted-foreground mb-1">Range</div>
								<div className="text-sm font-semibold text-gray-900 dark:text-white">
									{formatValue(stats.min)} - {formatValue(stats.max)}
								</div>
							</div>
							<div
								className="p-3 rounded text-center"
								style={{ background: chartColors.error, opacity: 0.15 }}
							>
								<div className="text-xs font-medium text-muted-foreground mb-1">Anomalies</div>
								<div className="text-lg font-semibold text-gray-900 dark:text-white">
									{anomalyStats.total}
								</div>
							</div>
						</div>
					)}

					{/* Chart */}
					<ResponsiveContainer width="100%" height={expanded ? height * 1.5 : height}>
						<ComposedChart
							data={chartData}
							margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
							role="img"
							aria-label={`Anomaly detection chart for ${timeseries}. ${anomalies.length} anomalies detected using ${method} method.`}
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

							{/* Normal data line */}
							<Line
								type="monotone"
								dataKey="value"
								stroke={lineChartStyles.stroke}
								strokeWidth={lineChartStyles.strokeWidth}
								dot={false}
								activeDot={lineChartStyles.activeDot}
								isAnimationActive={true}
								animationDuration={chartAnimations.duration}
								name="Time Series"
							/>

							{/* Anomaly points as scatter */}
							<Scatter data={anomalyScatterData} fill={severityFillColors.HIGH} name="Anomalies">
								{anomalyScatterData.map((entry, index) => (
									<Cell
										key={`cell-${index}`}
										fill={
											severityFillColors[entry.anomalySeverity as keyof typeof severityFillColors]
										}
									/>
								))}
							</Scatter>
						</ComposedChart>
					</ResponsiveContainer>

					{/* Legend info */}
					<div className="mt-4 flex justify-center gap-6 text-xs">
						<div className="flex items-center gap-2">
							<div style={{ width: 20, height: 3, background: lineChartStyles.stroke }} />
							<span style={{ color: chartColors.gray600 }}>Time Series Data</span>
						</div>
						{Object.entries(severityColors)
							.map(
								([severity, color]) =>
									anomalyStats.bySeverity[severity] > 0 && (
										<div key={severity} className="flex items-center gap-2">
											<div
												style={{ width: 12, height: 12, borderRadius: "50%", background: color }}
											/>
											<span style={{ color: chartColors.gray600 }}>{severity} Severity</span>
										</div>
									),
							)
							.filter(Boolean)}
					</div>
				</div>
			</Card>
		</div>
	);
};

export default AnomalyChart;
