"use client";

import { useState } from "react";
import { Form, Input, InputNumber, Select, Button, message, Spin, Row, Col, Tag } from "antd";
import { AlertOutlined, WarningOutlined, ExclamationCircleOutlined } from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ContentCard } from "@/components/layout/ContentCard";
import { DataTable } from "@/components/tables/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import dynamic from "next/dynamic";

// Dynamic import for heavy chart component
const AnomalyChart = dynamic(
  () => import("@/components/charts/AnomalyChart").then(mod => ({ default: mod.AnomalyChart })),
  {
    loading: () => (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Spin size="large" />
      </div>
    ),
    ssr: false,
  }
);

interface Anomaly {
  timestamp: number;
  value: number;
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface VisualizationResult {
  timeseries: string;
  historical: Array<{ timestamp: number; value: number }>;
  anomalies: Anomaly[];
  statistics: {
    total: number;
    bySeverity: Record<string, number>;
  };
  method: string;
}

export default function AIAnomaliesPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualizationResult | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);

  const severityColors: Record<string, string> = {
    LOW: "green",
    MEDIUM: "orange",
    HIGH: "red",
    CRITICAL: "purple",
  };

  const severityIcons: Record<string, React.ReactNode> = {
    LOW: <ExclamationCircleOutlined />,
    MEDIUM: <WarningOutlined />,
    HIGH: <AlertOutlined />,
    CRITICAL: <ExclamationCircleOutlined />,
  };

  const handleDetect = async (values: any) => {
    setLoading(true);
    setResult(null);

    try {
      const token = (await import('@/lib/tokenManager')).tokenManager.getToken();
      const response = await fetch("/api/iotdb/ai/anomalies/visualize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          timeseries: values.timeseries,
          threshold: values.threshold,
          method: values.method || "statistical",
          historyPoints: values.historyPoints || 100,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Detection failed");
      }

      const data = await response.json();
      setResult(data);
      message.success(`Detection completed! Found ${data.statistics.total} anomalies.`);
    } catch (error: any) {
      message.error(`Detection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  const columns = [
    {
      title: "Severity",
      dataIndex: "severity",
      key: "severity",
      width: 140,
      render: (severity: string) => (
        <Tag
          color={severityColors[severity]}
          icon={severityIcons[severity]}
          style={{ margin: 0 }}
        >
          {severity}
        </Tag>
      ),
      sorter: (a: Anomaly, b: Anomaly) => {
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return order[a.severity] - order[b.severity];
      },
    },
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 180,
      render: (ts: number) => formatTimestamp(ts),
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      width: 120,
      align: "right" as const,
      render: (val: number) => (
        <span className="data-text text-[13px] text-gray-700 dark:text-gray-300">
          {val.toFixed(2)}
        </span>
      ),
    },
    {
      title: "Anomaly Score",
      dataIndex: "score",
      key: "score",
      width: 140,
      align: "right" as const,
      sorter: (a: Anomaly, b: Anomaly) => b.score - a.score,
      render: (score: number) => (
        <span
          className="font-semibold data-text"
          style={{
            color:
              score > 4
                ? "#EF4444"
                : score > 3
                ? "#F59E0B"
                : score > 2
                ? "#3B82F6"
                : "#10B981",
          }}
        >
          {score.toFixed(4)}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="AI Anomaly Detection"
        description="Detect anomalies in your time series data using AI"
      />

      <ContentCard
        title="Detection Configuration"
        subtitle={<span className="text-body-sm">Powered by AI Node</span>}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleDetect}
          initialValues={{
            timeseries: "root.test2",
            threshold: 2.5,
            method: "statistical",
            historyPoints: 100,
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Time Series Path"
                name="timeseries"
                rules={[{ required: true, message: "Please enter time series path" }]}
              >
                <Input placeholder="e.g., root.test2" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Threshold (Z-score)"
                name="threshold"
                rules={[{ required: true, message: "Please enter threshold" }]}
                tooltip="Values with Z-score above this threshold will be flagged as anomalies"
              >
                <InputNumber min={0} max={10} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Detection Method" name="method">
            <Select>
              <Select.Option value="statistical">Statistical (Z-score)</Select.Option>
              <Select.Option value="ml">Machine Learning</Select.Option>
              <Select.Option value="stray">STRAY Algorithm</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Historical Data Points"
            name="historyPoints"
            tooltip="Number of historical data points to display on chart"
          >
            <InputNumber
              min={10}
              max={1000}
              step={10}
              style={{ width: "100%" }}
              placeholder="e.g., 100"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              icon={<WarningOutlined />}
              style={{
                background: "#171717",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
              }}
            >
              Detect Anomalies
            </Button>
          </Form.Item>
        </Form>
      </ContentCard>

      {loading && (
        <ContentCard style={{ textAlign: "center" }}>
          <Spin size="large" tip="Detecting anomalies..." />
        </ContentCard>
      )}

      {result && (
        <>
          {/* Anomaly Chart */}
          <AnomalyChart
            timeseries={result.timeseries}
            historicalData={result.historical}
            anomalies={result.anomalies}
            method={result.method}
            onExport={(_format) => {
              // Export handled by AnomalyChart component
            }}
          />

          {/* Statistics Cards */}
          <Row gutter={[16, 16]} style={{ marginTop: 24, marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <StatCard
                title="Total Anomalies"
                value={result.statistics.total}
                icon={<AlertOutlined />}
                variant={result.statistics.total > 0 ? "warning" : "success"}
              />
            </Col>
            {result.statistics.bySeverity.CRITICAL !== undefined && (
              <Col xs={24} sm={12} md={6}>
                <StatCard
                  title="Critical"
                  value={result.statistics.bySeverity.CRITICAL || 0}
                  icon={<ExclamationCircleOutlined />}
                  variant="error"
                />
              </Col>
            )}
            {result.statistics.bySeverity.HIGH !== undefined && (
              <Col xs={24} sm={12} md={6}>
                <StatCard
                  title="High Severity"
                  value={result.statistics.bySeverity.HIGH || 0}
                  icon={<AlertOutlined />}
                  variant="error"
                />
              </Col>
            )}
          </Row>

          {/* Anomaly Details Table */}
          <ContentCard title="Anomaly Details">
            <DataTable
              columns={columns}
              dataSource={result.anomalies}
              rowKey={(record) => `${record.timestamp}-${record.severity}`}
              enableZebraStriping={true}
              stickyHeader={true}
              pagination={{ pageSize: 10 }}
            />
          </ContentCard>
        </>
      )}
    </PageContainer>
  );
}
