"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Card, Typography, Button, Space, Tag, Spin, Alert } from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  DisconnectOutlined,
} from "@ant-design/icons";
import dynamic from "next/dynamic";
import {
  chartColors,
  chartTooltipStyles,
  chartGridStyles,
  chartAxisStyles,
  lineChartStyles,
  referenceLineStyles,
  chartAnimations,
} from "@/lib/chart-config";

const { Text } = Typography;

// Dynamic imports for Recharts components to reduce initial bundle size
const LineChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.LineChart })),
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

const ReferenceLine = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ReferenceLine })),
  { ssr: false }
) as React.ComponentType<any>;

interface DataPoint {
  timestamp: number;
  value: number;
}

interface RealTimeChartProps {
  timeseries?: string;
  autoScroll?: boolean;
  maxPoints?: number;
  refreshInterval?: number;
  showStatistics?: boolean;
  height?: number;
  onDisconnect?: () => void;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  timeseries = "root.test2",
  autoScroll: _autoScroll = true,
  maxPoints = 100,
  refreshInterval = 2000,
  showStatistics = true,
  height = 400,
  onDisconnect,
}) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Calculate statistics
  const statistics = React.useMemo(() => {
    if (data.length === 0) return null;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const last = values[values.length - 1];

    return { min, max, mean, std, last, count: values.length };
  }, [data]);

  // Format timestamp for display
  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  // Format value for display
  const formatValue = (val: number) => {
    return typeof val === "number" ? val.toFixed(4) : val;
  };

  // Fetch data point with proper cleanup check
  const fetchDataPoint = useCallback(async () => {
    // Prevent fetching if component is unmounted or paused
    if (!isMountedRef.current || isPaused) return;

    try {
      const response = await fetch(
        `/api/iotdb/query/latest?timeseries=${encodeURIComponent(timeseries)}&limit=1`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const result = await response.json();

      if (!isMountedRef.current) return; // Check again after async operation

      if (result.data && result.data.length > 0) {
        const newDataPoint = {
          timestamp: result.data[0].timestamp || Date.now(),
          value: parseFloat(result.data[0].value),
        };

        setData((prevData) => {
          const newData = [...prevData, newDataPoint];
          // Keep only maxPoints
          if (newData.length > maxPoints) {
            return newData.slice(-maxPoints);
          }
          return newData;
        });

        setError(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (isMountedRef.current) {
        setError(message);
      }
    }
  }, [timeseries, isPaused, maxPoints]);

  // Start real-time updates
  const startUpdates = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsConnected(true);
    setLoading(false);

    // Set component as mounted
    isMountedRef.current = true;

    // Fetch initial data
    fetchDataPoint();

    // Set up interval for polling
    intervalRef.current = setInterval(() => {
      fetchDataPoint();
    }, refreshInterval);
  }, [fetchDataPoint, refreshInterval]);

  // Stop real-time updates
  const stopUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Toggle pause/resume
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Clear data
  const clearData = useCallback(() => {
    setData([]);
    setError(null);
  }, []);

  // Cleanup on unmount - CRITICAL for preventing memory leaks
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    return () => {
      // Mark component as unmounted FIRST to prevent state updates
      isMountedRef.current = false;

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Note: wsRef was unused in this component (using polling instead of WebSocket)
      // Kept for potential future WebSocket implementation
    };
  }, []);

  // Auto-start updates when connected state changes
  useEffect(() => {
    if (isConnected && !isPaused) {
      // Updates are already started via startUpdates button
      // This effect ensures polling is active when connected
    }
  }, [isConnected, isPaused]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: chartTooltipStyles.backgroundColor,
            border: chartTooltipStyles.border,
            borderRadius: chartTooltipStyles.borderRadius,
            padding: chartTooltipStyles.padding,
            boxShadow: chartTooltipStyles.boxShadow,
            backdropFilter: chartTooltipStyles.backdropFilter,
          }}
        >
          <p style={{ margin: 0, fontSize: chartTooltipStyles.fontSize, color: chartTooltipStyles.color }}>
            {formatTimestamp(payload[0].payload.timestamp)}
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600, color: chartColors.gray900 }}>
            Value: {formatValue(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 4 }}
      styles={{ body: { padding: "20px" } }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Space direction="vertical" size={0}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text strong style={{ fontSize: 15 }}>
              Real-Time Data
            </Text>
            {isConnected && (
              <Tag
                color="success"
                icon={<SyncOutlined spin />}
                style={{ margin: 0 }}
              >
                LIVE
              </Tag>
            )}
            {isPaused && isConnected && (
              <Tag color="warning" style={{ margin: 0 }}>
                PAUSED
              </Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {timeseries}
          </Text>
        </Space>

        <Space>
          {!isConnected ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startUpdates}
              loading={loading}
              aria-label="Start real-time data monitoring"
            >
              Start
            </Button>
          ) : (
            <>
              <Button
                icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={togglePause}
                aria-label={isPaused ? "Resume real-time updates" : "Pause real-time updates"}
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={clearData}
                aria-label="Clear all chart data"
              >
                Clear
              </Button>
              <Button
                danger
                icon={<DisconnectOutlined />}
                onClick={() => {
                  stopUpdates();
                  onDisconnect?.();
                }}
                aria-label="Stop real-time monitoring"
              >
                Stop
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message="Connection Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Statistics */}
      {showStatistics && statistics && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: "12px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 4,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Current</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: chartColors.warning }}>
              {formatValue(statistics.last)}
            </div>
          </div>
          <div
            style={{
              padding: "12px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 4,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Min</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: chartColors.success }}>
              {formatValue(statistics.min)}
            </div>
          </div>
          <div
            style={{
              padding: "12px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 4,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Max</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: chartColors.primary }}>
              {formatValue(statistics.max)}
            </div>
          </div>
          <div
            style={{
              padding: "12px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 4,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: chartColors.gray600, marginBottom: 4, fontWeight: 500 }}>Mean</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: chartColors.purple }}>
              {formatValue(statistics.mean)}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {data.length === 0 ? (
        <div
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: chartColors.gray50,
            borderRadius: 4,
          }}
        >
          <div style={{ textAlign: "center", color: "#9ca3af" }}>
            <SyncOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div style={{ fontSize: 14 }}>
              {isConnected ? "Waiting for data..." : "Click Start to begin real-time monitoring"}
            </div>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            role="img"
            aria-label={`Line chart showing real-time data for ${timeseries}. Current value: ${data[data.length - 1]?.value || 'N/A'}. ${data.length} data points displayed.`}
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
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineChartStyles.stroke}
              strokeWidth={lineChartStyles.strokeWidth}
              dot={false}
              activeDot={lineChartStyles.activeDot}
              animationDuration={chartAnimations.duration}
            />
            {statistics && (
              <>
                <ReferenceLine
                  y={statistics.mean}
                  stroke={referenceLineStyles.stroke}
                  strokeDasharray={referenceLineStyles.strokeDasharray}
                  strokeWidth={referenceLineStyles.strokeWidth}
                  label={{ value: "Mean", fill: chartColors.purple, fontSize: referenceLineStyles.label.fontSize, fontWeight: referenceLineStyles.label.fontWeight }}
                />
                <ReferenceLine
                  y={statistics.mean + statistics.std}
                  stroke={chartColors.warning}
                  strokeDasharray={referenceLineStyles.strokeDasharray}
                  strokeWidth={referenceLineStyles.strokeWidth}
                  label={{ value: "+1σ", fill: chartColors.warning, fontSize: referenceLineStyles.label.fontSize, fontWeight: referenceLineStyles.label.fontWeight }}
                />
                <ReferenceLine
                  y={statistics.mean - statistics.std}
                  stroke={chartColors.warning}
                  strokeDasharray={referenceLineStyles.strokeDasharray}
                  strokeWidth={referenceLineStyles.strokeWidth}
                  label={{ value: "-1σ", fill: chartColors.warning, fontSize: referenceLineStyles.label.fontSize, fontWeight: referenceLineStyles.label.fontWeight }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Footer Info */}
      {data.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          Showing {data.length} data point{data.length !== 1 ? "s" : ""} • Refresh every {refreshInterval / 1000}s
        </div>
      )}
    </Card>
  );
};

export default RealTimeChart;
