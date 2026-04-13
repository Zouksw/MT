"use client";

import React, { useState, useRef } from "react";
import { Card, Button, Space, Typography, Spin, Alert, Tag, Tooltip as AntTooltip } from "antd";
import {
    FileImageOutlined,
    FileExcelOutlined,
    ExpandOutlined,
    CompressOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import dynamic from "next/dynamic";
import {
    chartColors,
    chartTooltipStyles,
    chartGridStyles,
    chartAxisStyles,
    lineChartStyles,
    chartAnimations,
} from "@/lib/chart-config";

const { Text } = Typography;

// Dynamic imports for Recharts components to reduce initial bundle size
const ComposedChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ComposedChart })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    ),
    ssr: false,
  }
) as React.ComponentType<any>;

const Line = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Line })),
  { ssr: false }
) as React.ComponentType<any>;

const XAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.XAxis })),
  { ssr: false }
) as React.ComponentType<any>;

const YAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.YAxis })),
  { ssr: false }
) as React.ComponentType<any>;

const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
  { ssr: false }
) as React.ComponentType<any>;

const Tooltip = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Tooltip })),
  { ssr: false }
) as React.ComponentType<any>;

const Legend = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Legend })),
  { ssr: false }
) as React.ComponentType<any>;

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
  { ssr: false }
) as React.ComponentType<any>;

const Scatter = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Scatter })),
  { ssr: false }
) as React.ComponentType<any>;

const Cell = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Cell })),
  { ssr: false }
) as React.ComponentType<any>;

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
    onExport?: (format: 'png' | 'csv') => void;
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
        const anomalyMap = new Map(
            anomalies.map(a => [a.timestamp, a])
        );

        const data: TimeSeriesData[] = historicalData.map(d => ({
            timestamp: d.timestamp,
            value: d.value,
            isAnomaly: anomalyMap.has(d.timestamp),
            anomalySeverity: anomalyMap.get(d.timestamp)?.severity,
            anomalyScore: anomalyMap.get(d.timestamp)?.score,
        }));

        // Also include any anomalies not in historical data
        anomalies.forEach(a => {
            if (!data.find(d => d.timestamp === a.timestamp)) {
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
    const anomalyScatterData = chartData.filter(d => d.isAnomaly);

    // Calculate statistics
    const stats = React.useMemo(() => {
        if (chartData.length === 0) return null;

        const values = chartData.map(d => d.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        );
        const min = Math.min(...values);
        const max = Math.max(...values);

        return { mean, std, min, max, count: values.length };
    }, [chartData]);

    const anomalyStats = React.useMemo(() => {
        const bySeverity: Record<string, number> = {};
        anomalies.forEach(a => {
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
            const html2canvas = (await import('html2canvas')).default;

            const canvas = await html2canvas(chartRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
            });

            const link = document.createElement('a');
            link.download = `anomaly-${timeseries.replace(/\./g, '-')}-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            onExport?.('png');
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to export chart:', error);
        } finally {
            setExporting(false);
        }
    };

    // Export data as CSV
    const exportAsCSV = () => {
        try {
            const headers = ['Timestamp', 'Value', 'Is Anomaly', 'Severity', 'Score'];
            const rows = chartData.map(d => [
                new Date(d.timestamp).toISOString(),
                d.value.toFixed(4),
                d.isAnomaly ? 'Yes' : 'No',
                d.anomalySeverity || '',
                d.anomalyScore?.toFixed(4) || '',
            ]);

            const csv = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.download = `anomaly-${timeseries.replace(/\./g, '-')}-${Date.now()}.csv`;
            link.href = URL.createObjectURL(blob);
            link.click();

            onExport?.('csv');
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to export data:', error);
        }
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
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
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600, color: chartColors.gray900 }}>
                        Value: {formatValue(data.value)}
                    </p>
                    {data.isAnomaly && (
                        <>
                            <p style={{ margin: "8px 0 4px 0", fontSize: 12, fontWeight: 600 }}>
                                <Tag color={severityColors[data.anomalySeverity as keyof typeof severityColors]}>
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
            <Card
                variant="borderless"
                style={{ borderRadius: 4 }}
                styles={{ body: { padding: "40px", textAlign: "center" } }}
            >
                <Spin size="large" tip="Loading anomaly data..." />
            </Card>
        );
    }

    return (
        <div ref={chartRef}>
            <Card
                variant="borderless"
                style={{ borderRadius: 4 }}
                styles={{ body: { padding: expanded ? "24px" : "20px" } }}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <Space direction="vertical" size={0}>
                        <Text strong style={{ fontSize: 16 }}>
                            Anomaly Detection: {timeseries}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Method: {method.toUpperCase()} • {chartData.length} data points • {anomalyStats.total} anomalies
                        </Text>
                    </Space>

                    <Space>
                        <AntTooltip title="Export as PNG">
                            <Button
                                icon={<FileImageOutlined />}
                                onClick={exportAsPNG}
                                loading={exporting}
                                size="small"
                                aria-label="Export anomaly chart as PNG image"
                            >
                                PNG
                            </Button>
                        </AntTooltip>
                        <AntTooltip title="Export as CSV">
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={exportAsCSV}
                                size="small"
                                aria-label="Export anomaly data as CSV spreadsheet"
                            >
                                CSV
                            </Button>
                        </AntTooltip>
                        <Button
                            icon={expanded ? <CompressOutlined /> : <ExpandOutlined />}
                            onClick={() => setExpanded(!expanded)}
                            size="small"
                            aria-label={expanded ? "Collapse anomaly chart to normal size" : "Expand anomaly chart to full size"}
                        >
                            {expanded ? "Collapse" : "Expand"}
                        </Button>
                    </Space>
                </div>

                {/* Anomaly Summary Alert */}
                {anomalyStats.total > 0 && (
                    <Alert
                        message={`${anomalyStats.total} Anomalies Detected`}
                        description={
                            <Space size={8} wrap>
                                {anomalyStats.bySeverity.CRITICAL > 0 && (
                                    <Tag color="purple">Critical: {anomalyStats.bySeverity.CRITICAL}</Tag>
                                )}
                                {anomalyStats.bySeverity.HIGH > 0 && (
                                    <Tag color="red">High: {anomalyStats.bySeverity.HIGH}</Tag>
                                )}
                                {anomalyStats.bySeverity.MEDIUM > 0 && (
                                    <Tag color="orange">Medium: {anomalyStats.bySeverity.MEDIUM}</Tag>
                                )}
                                {anomalyStats.bySeverity.LOW > 0 && (
                                    <Tag color="green">Low: {anomalyStats.bySeverity.LOW}</Tag>
                                )}
                            </Space>
                        }
                        type="warning"
                        icon={<WarningOutlined />}
                        style={{ marginBottom: 20 }}
                        showIcon
                    />
                )}

                {/* Statistics */}
                {stats && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: 12,
                            marginBottom: 20,
                        }}
                    >
                        <div
                            style={{
                                padding: "12px",
                                background: chartColors.purple,
                                borderRadius: 4,
                                textAlign: "center",
                                opacity: 0.15,
                            }}
                        >
                            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Mean</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: chartColors.gray900 }}>
                                {formatValue(stats.mean)}
                            </div>
                        </div>
                        <div
                            style={{
                                padding: "12px",
                                background: chartColors.success,
                                borderRadius: 4,
                                textAlign: "center",
                                opacity: 0.15,
                            }}
                        >
                            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Std Dev</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: chartColors.gray900 }}>
                                {formatValue(stats.std)}
                            </div>
                        </div>
                        <div
                            style={{
                                padding: "12px",
                                background: chartColors.warning,
                                borderRadius: 4,
                                textAlign: "center",
                                opacity: 0.15,
                            }}
                        >
                            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Range</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: chartColors.gray900 }}>
                                {formatValue(stats.min)} - {formatValue(stats.max)}
                            </div>
                        </div>
                        <div
                            style={{
                                padding: "12px",
                                background: chartColors.error,
                                borderRadius: 4,
                                textAlign: "center",
                                opacity: 0.15,
                            }}
                        >
                            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Anomalies</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: chartColors.gray900 }}>
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
                        <Scatter
                            data={anomalyScatterData}
                            fill={severityFillColors.HIGH}
                            name="Anomalies"
                        >
                            {anomalyScatterData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={severityFillColors[entry.anomalySeverity as keyof typeof severityFillColors]}
                                />
                            ))}
                        </Scatter>
                    </ComposedChart>
                </ResponsiveContainer>

                {/* Legend info */}
                <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 24, fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 20, height: 3, background: lineChartStyles.stroke }} />
                        <span style={{ color: chartColors.gray600 }}>Time Series Data</span>
                    </div>
                    {Object.entries(severityColors).map(([severity, color]) => (
                        anomalyStats.bySeverity[severity] > 0 && (
                            <div key={severity} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                                <span style={{ color: chartColors.gray600 }}>{severity} Severity</span>
                            </div>
                        )
                    )).filter(Boolean)}
                </div>
            </Card>
        </div>
    );
};

export default AnomalyChart;
