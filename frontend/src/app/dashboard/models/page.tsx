"use client";

import React, { useState, useEffect } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Table,
  Tag,
  Progress,
  Select,
  ConfigProvider,
  Space,
  Alert,
} from "antd";
import {
  ThunderboltOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";

const { Text } = Typography;

interface ModelAccuracy {
  modelId: string;
  avgMape: number | null;
  predictionCount: number;
  verifiedCount: number;
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

const modelDescMap: Record<string, string> = {
  arima: "AutoRegressive Integrated Moving Average",
  holtwinters: "Triple exponential smoothing",
  exponential_smoothing: "Simple exponential smoothing",
  naive_forecaster: "Baseline: last observed value",
  stl_forecaster: "STL decomposition + forecast",
  timer_xl: "LSTM deep learning model",
  sundial: "Transformer-based model",
};

function getMapeColor(mape: number | null): string {
  if (mape === null) return "#d1d5db";
  if (mape < 3) return "#16a34a";
  if (mape < 7) return "#d97706";
  return "#dc2626";
}

function getMapeLabel(mape: number | null): string {
  if (mape === null) return "No data";
  if (mape < 3) return "Excellent";
  if (mape < 7) return "Good";
  if (mape < 15) return "Fair";
  return "Poor";
}

const columns = [
  {
    title: "Model",
    dataIndex: "modelId",
    key: "modelId",
    render: (id: string) => (
      <div>
        <Text strong style={{ fontFamily: "monospace" }}>
          {modelNameMap[id] || id}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {modelDescMap[id] || ""}
        </Text>
      </div>
    ),
  },
  {
    title: "MAPE",
    dataIndex: "avgMape",
    key: "avgMape",
    align: "right" as const,
    sorter: (a: ModelAccuracy, b: ModelAccuracy) =>
      (a.avgMape ?? 999) - (b.avgMape ?? 999),
    render: (mape: number | null) => (
      <Space>
        <Text
          strong
          style={{
            fontFamily: "monospace",
            fontSize: 16,
            color: getMapeColor(mape),
          }}
        >
          {mape !== null ? `${mape.toFixed(2)}%` : "—"}
        </Text>
        <Tag
          color={
            mape === null
              ? "default"
              : mape < 3
              ? "green"
              : mape < 7
              ? "orange"
              : "red"
          }
          style={{ fontSize: 11 }}
        >
          {getMapeLabel(mape)}
        </Tag>
      </Space>
    ),
  },
  {
    title: "Predictions",
    dataIndex: "predictionCount",
    key: "predictionCount",
    align: "center" as const,
    render: (count: number) => (
      <Text style={{ fontFamily: "monospace" }}>{count}</Text>
    ),
  },
  {
    title: "Verified",
    dataIndex: "verifiedCount",
    key: "verifiedCount",
    align: "center" as const,
    render: (verified: number, record: ModelAccuracy) => (
      <div>
        <Progress
          percent={
            record.predictionCount > 0
              ? Math.round((verified / record.predictionCount) * 100)
              : 0
          }
          size="small"
          format={() => `${verified}/${record.predictionCount}`}
          strokeColor="#3b82f6"
        />
      </div>
    ),
  },
  {
    title: "Accuracy Rating",
    key: "rating",
    align: "center" as const,
    render: (_: any, record: ModelAccuracy) => {
      const mape = record.avgMape;
      if (mape === null)
        return <Tag color="default">Awaiting Data</Tag>;
      if (mape < 3)
        return (
          <Tag icon={<ThunderboltOutlined />} color="green">
            Top Performer
          </Tag>
        );
      if (mape < 7) return <Tag color="blue">Reliable</Tag>;
      if (mape < 15) return <Tag color="orange">Needs Tuning</Tag>;
      return <Tag color="red">Underperforming</Tag>;
    },
  },
];

export default function ModelsComparisonPage() {
  const [accuracy, setAccuracy] = useState<ModelAccuracy[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [isDemoData, setIsDemoData] = useState(false);

  useEffect(() => {
    async function loadAccuracy() {
      setLoading(true);
      try {
        const token = (await import('@/lib/tokenManager')).tokenManager.getToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/signals/models/accuracy?days=${days}`,
          { headers }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.accuracy) {
            setAccuracy(data.data.accuracy);
            return;
          }
        }
        setAccuracy([]);
        setIsDemoData(true);
      } catch {
        setAccuracy([]);
        setIsDemoData(true);
      } finally {
        setLoading(false);
      }
    }

    loadAccuracy();
  }, [days]);

  const bestModel = accuracy.reduce(
    (best, m) =>
      m.avgMape !== null && (best === null || m.avgMape < best.avgMape!)
        ? m
        : best,
    null as ModelAccuracy | null
  );

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#F59E0B" } }}>
      <PageContainer>
        <PageHeader
          title="Model Comparison"
          description="Compare prediction accuracy across all AI models using MAPE (Mean Absolute Percentage Error)"
        />

        {isDemoData && (
          <Alert
            type="info"
            message="No prediction data yet."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Controls */}
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 16 }}
        >
          <Col>
            <Space>
              <Text type="secondary">Time Window:</Text>
              <Select
                value={days}
                onChange={setDays}
                style={{ width: 150 }}
                options={[
                  { label: "Last 7 days", value: 7 },
                  { label: "Last 30 days", value: 30 },
                  { label: "Last 90 days", value: 90 },
                ]}
              />
            </Space>
          </Col>
          <Col>
            {bestModel && bestModel.avgMape !== null && (
              <Tag color="green" style={{ fontSize: 13, padding: "4px 12px" }}>
                Best: {modelNameMap[bestModel.modelId]} (MAPE{" "}
                {bestModel.avgMape.toFixed(2)}%)
              </Tag>
            )}
          </Col>
        </Row>

        {/* Accuracy Table */}
        <Card>
          <Table
            dataSource={accuracy.map((a) => ({ ...a, key: a.modelId }))}
            columns={columns}
            loading={loading}
            pagination={false}
            size="middle"
          />
        </Card>

        {/* MAPE Explanation */}
        <Card
          style={{ marginTop: 16 }}
          size="small"
          title={<Text strong>Understanding MAPE</Text>}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Tag color="green">Excellent</Tag>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                MAPE &lt; 3%
              </Text>
            </Col>
            <Col span={6}>
              <Tag color="orange">Good</Tag>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                MAPE 3-7%
              </Text>
            </Col>
            <Col span={6}>
              <Tag color="orange">Fair</Tag>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                MAPE 7-15%
              </Text>
            </Col>
            <Col span={6}>
              <Tag color="red">Poor</Tag>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                MAPE &gt; 15%
              </Text>
            </Col>
          </Row>
          <Text
            type="secondary"
            style={{ fontSize: 11, display: "block", marginTop: 8 }}
          >
            MAPE = (1/n) × Σ|actual − predicted| / |actual| × 100. Lower is
            better. Verified when actual market data becomes available.
          </Text>
        </Card>
      </PageContainer>
    </ConfigProvider>
  );
}
