"use client";

import React from "react";
import { Table, Progress, Typography } from "antd";
import SignalBadge from "./SignalBadge";

const { Text } = Typography;

interface ModelSignal {
  modelId: string;
  type: "BUY" | "SELL" | "HOLD";
  predictedChange: number;
  currentValue: number;
  predictedValue: number;
  confidence: number;
}

interface ModelConsensusTableProps {
  signals: ModelSignal[];
  loading?: boolean;
}

const modelNameMap: Record<string, string> = {
  arima: "ARIMA",
  holtwinters: "Holt-Winters",
  exponential_smoothing: "Exp. Smoothing",
  naive_forecaster: "Naive",
  stl_forecaster: "STL",
  timer_xl: "Timer-XL",
  sundial: "Sundial",
};

export default function ModelConsensusTable({
  signals,
  loading = false,
}: ModelConsensusTableProps) {
  const columns = [
    {
      title: "Model",
      dataIndex: "modelId",
      key: "modelId",
      render: (id: string) => (
        <Text strong style={{ fontFamily: "monospace", fontSize: 13 }}>
          {modelNameMap[id] || id}
        </Text>
      ),
    },
    {
      title: "Signal",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: "BUY" | "SELL" | "HOLD", record: ModelSignal) => (
        <SignalBadge type={type} confidence={record.confidence} size="small" />
      ),
    },
    {
      title: "Predicted",
      dataIndex: "predictedValue",
      key: "predictedValue",
      align: "right" as const,
      render: (v: number) => (
        <Text style={{ fontFamily: "monospace" }}>
          {v?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Change",
      dataIndex: "predictedChange",
      key: "predictedChange",
      align: "right" as const,
      render: (change: number) => (
        <Text
          style={{
            fontFamily: "monospace",
            color: change > 0 ? "#16a34a" : change < 0 ? "#dc2626" : undefined,
          }}
        >
          {change > 0 ? "+" : ""}
          {change.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: "Confidence",
      dataIndex: "confidence",
      key: "confidence",
      width: 120,
      render: (confidence: number) => (
        <Progress
          percent={Math.round(confidence * 100)}
          size="small"
          strokeColor={confidence > 0.7 ? "#16a34a" : confidence > 0.4 ? "#d97706" : "#dc2626"}
        />
      ),
    },
  ];

  return (
    <Table
      dataSource={signals.map((s) => ({ ...s, key: s.modelId }))}
      columns={columns}
      loading={loading}
      pagination={false}
      size="small"
      style={{ fontSize: 13 }}
    />
  );
}
