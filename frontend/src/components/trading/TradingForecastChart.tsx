"use client";

import React, { useMemo } from "react";
import { Typography, Space, Tag, Spin } from "antd";
import dynamic from "next/dynamic";
import { TRADING_COLORS } from "@/lib/trading-chart-config";

const { Text } = Typography;

// Dynamic imports — single recharts chunk
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

const ComposedChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ComposedChart })),
  { ssr: false }
) as React.ComponentType<any>;

const Area = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Area })),
  { ssr: false }
) as React.ComponentType<any>;

const ReferenceLine = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ReferenceLine })),
  { ssr: false }
) as React.ComponentType<any>;

const ReferenceArea = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ReferenceArea })),
  { ssr: false }
) as React.ComponentType<any>;

interface Prediction {
  timestamps: number[];
  values: number[];
  lowerBound?: number[];
  upperBound?: number[];
  algorithm: string;
}

interface TradingForecastChartProps {
  historicalData: Array<{ timestamp: number; value: number }>;
  predictions: Record<string, Prediction>;
  currentPrice: number;
  supportLevel?: number;
  resistanceLevel?: number;
  loading?: boolean;
}

const modelColors = TRADING_COLORS.modelColors;

const modelNameMap: Record<string, string> = {
  arima: "ARIMA",
  holtwinters: "Holt-Winters",
  exponential_smoothing: "Exp. Smooth",
  naive_forecaster: "Naive",
  stl_forecaster: "STL",
  timer_xl: "Timer-XL",
  sundial: "Sundial",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipValue(value: string | number): string {
  if (typeof value === "number") return `$${value.toFixed(2)}`;
  if (typeof value === "string" && !isNaN(Number(value))) return `$${Number(value).toFixed(2)}`;
  return String(value);
}

export default function TradingForecastChart({
  historicalData,
  predictions,
  currentPrice,
  supportLevel,
  resistanceLevel,
  loading = false,
}: TradingForecastChartProps) {
  // Merge historical + predictions
  const chartData = useMemo(() => {
    const points: Array<Record<string, any>> = historicalData.map((d) => ({
      date: formatDate(d.timestamp),
      actual: d.value,
    }));

    for (const [modelId, pred] of Object.entries(predictions)) {
      for (let i = 0; i < pred.timestamps.length; i++) {
        const dateStr = formatDate(pred.timestamps[i]);
        let existing = points.find((p) => p.date === dateStr);
        if (!existing) {
          existing = { date: dateStr };
          points.push(existing);
        }
        existing[`${modelId}_value`] = pred.values[i];
        if (pred.lowerBound?.[i] != null) {
          existing[`${modelId}_lower`] = pred.lowerBound[i];
        }
        if (pred.upperBound?.[i] != null) {
          existing[`${modelId}_upper`] = pred.upperBound[i];
        }
      }
    }

    return points;
  }, [historicalData, predictions]);

  const modelIds = Object.keys(predictions);

  // Determine forecast zone boundaries (first model's timestamps)
  const forecastDates = useMemo(() => {
    if (modelIds.length === 0) return null;
    const firstPred = predictions[modelIds[0]];
    if (!firstPred || firstPred.timestamps.length === 0) return null;
    return {
      start: formatDate(firstPred.timestamps[0]),
      end: formatDate(firstPred.timestamps[firstPred.timestamps.length - 1]),
    };
  }, [predictions, modelIds]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <Spin tip="Loading forecast..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Space>
          <Text strong>Price Forecast</Text>
          <Text type="secondary" style={{ fontFamily: "monospace" }}>
            Current: ${currentPrice.toFixed(2)}
          </Text>
        </Space>
        <Space size={4}>
          {supportLevel != null && (
            <Tag color="green" style={{ fontFamily: "monospace", fontSize: 11 }}>
              Support ${supportLevel.toFixed(2)}
            </Tag>
          )}
          {resistanceLevel != null && (
            <Tag color="red" style={{ fontFamily: "monospace", fontSize: 11 }}>
              Resistance ${resistanceLevel.toFixed(2)}
            </Tag>
          )}
        </Space>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#666666" }} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#666666" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "none",
              borderRadius: 6,
              boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 2px 2px, rgba(0, 0, 0, 0.04) 0px 8px 8px -8px",
              padding: "10px 14px",
              fontSize: 12,
              color: "#ffffff",
            }}
            formatter={(value: string | number, name: string) => [
              formatTooltipValue(value),
              name,
            ]}
          />
          <Legend />

          {/* Forecast zone shading */}
          {forecastDates && (
            <ReferenceArea
              x1={forecastDates.start}
              x2={forecastDates.end}
              fill={TRADING_COLORS.forecastZone.fill}
              stroke={TRADING_COLORS.forecastZone.stroke}
            />
          )}

          {/* Historical actual price — solid gray */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={TRADING_COLORS.historicalLine}
            strokeWidth={2}
            dot={false}
            name="Actual"
          />

          {/* Symmetric confidence band for first model */}
          {modelIds[0] && predictions[modelIds[0]].lowerBound && (
            <>
              {/* Upper bound area (fills between baseline and upper) */}
              <Area
                type="monotone"
                dataKey={`${modelIds[0]}_upper`}
                stroke="none"
                fill={TRADING_COLORS.primary}
                fillOpacity={0.12}
                name="95% CI Upper"
              />
              {/* Lower bound area (cuts away below lower, creating symmetric band) */}
              <Area
                type="monotone"
                dataKey={`${modelIds[0]}_lower`}
                stroke="none"
                fill="#ffffff"
                fillOpacity={0.9}
                name="95% CI Lower"
              />
            </>
          )}

          {/* Model prediction lines — dashed amber/colored */}
          {modelIds.map((modelId) => (
            <Line
              key={modelId}
              type="monotone"
              dataKey={`${modelId}_value`}
              stroke={modelColors[modelId] || "#888"}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              name={modelNameMap[modelId] || modelId}
            />
          ))}

          {/* Support & Resistance reference lines */}
          {supportLevel != null && (
            <ReferenceLine
              y={supportLevel}
              stroke={TRADING_COLORS.supportLine}
              strokeDasharray="3 3"
              label={{ value: "Support", position: "right", fontSize: 10 }}
            />
          )}
          {resistanceLevel != null && (
            <ReferenceLine
              y={resistanceLevel}
              stroke={TRADING_COLORS.resistanceLine}
              strokeDasharray="3 3"
              label={{ value: "Resistance", position: "right", fontSize: 10 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
