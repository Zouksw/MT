"use client";

import { useState, useEffect, useCallback } from "react";
import { Tag, Button, message, Card, Row, Col, Alert } from "antd";
import type { Breakpoint } from "antd";
import {
  ThunderboltOutlined,
  RocketOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import GlassCard from "@/components/ui/GlassCard";
import { useIsMobile } from "@/lib/responsive-utils";

// Check if AI features are disabled
const AI_DISABLED = process.env.NEXT_PUBLIC_AI_DISABLED === 'true';

interface AIModel {
  id: string;
  name: string;
  type: string;
  description: string;
  ainode: boolean;
  useCase?: string;
}

export default function AIModelsPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<AIModel[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setPermissionError(null);
    try {
      const response = await fetch("/api/iotdb/ai/models");
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403 || response.status === 503) {
          setPermissionError(error.error || "AI features are restricted to administrators");
        }
        throw new Error(error.error || "Failed to fetch models");
      }
      const data = await response.json();
      setModels(data.models || []);
    } catch (error: any) {
      if (!permissionError) {
        message.error(`Failed to load models: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const columns = [
    {
      title: "Model ID",
      dataIndex: "id",
      key: "id",
      width: 150,
      responsive: ["lg"] as Breakpoint[],
      render: (id: string) => (
        <code className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
          {id}
        </code>
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 180,
      render: (name: string, record: AIModel) => (
        <span className="font-semibold text-gray-900 dark:text-gray-50">
          {name}
          {record.ainode && (
            <Tag color="blue" icon={<ThunderboltOutlined />} className="ml-2">
              Built-in
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 100,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (type: string) => {
        const color = type === "prediction" ? "green" : "blue";
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Action",
      key: "action",
      width: isMobile ? 80 : 120,
      fixed: "right" as const,
      render: (_: any, _record: AIModel) => (
        <Button
          type="primary"
          icon={<RocketOutlined />}
          onClick={() => window.location.href = "/forecasts/create"}
          style={{
            background: "#0066CC",
            border: "none",
            borderRadius: "4px",
            fontWeight: 600,
          }}
        >
          {!isMobile && "Use Model"}
        </Button>
      ),
    },
  ];

  const totalModels = models.length;

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "AI & Anomaly Detection", href: "/ai" },
    { title: "AI Models" },
  ];

  return (
    <PageContainer>
      {/* AI Feature Disabled Warning */}
      {AI_DISABLED && (
        <Alert
          message="AI Features Temporarily Disabled"
          description="AI features including model training and prediction have been temporarily disabled for security reasons. Contact your administrator for more information."
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: isMobile ? 16 : 24 }}
          closable
        />
      )}

      {/* Permission Error Alert */}
      {permissionError && (
        <Alert
          message="AI Feature Access Restricted"
          description={
            permissionError.includes("disabled")
              ? "AI features are currently disabled. Please contact your administrator to enable them."
              : "AI model management is only available to administrators. If you are an administrator, please ensure you are logged in with your admin account."
          }
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: isMobile ? 16 : 24 }}
          closable
          onClose={() => setPermissionError(null)}
        />
      )}

      <PageHeader
        title="AI Models"
        description="Built-in AI models for forecasting and prediction"
        breadcrumbs={breadcrumbItems}
        actions={
          <Button
            type="primary"
            onClick={fetchModels}
            loading={loading}
            disabled={AI_DISABLED}
            icon={<ReloadOutlined />}
            style={{
              background: "#0066CC",
              border: "none",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            {!isMobile && "Refresh"}
          </Button>
        }
      />

      {/* Statistics Card */}
      <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Col xs={24} sm={12}>
          <GlassCard intensity="medium" style={{ padding: isMobile ? "16px" : "20px" }}>
            <div className="flex items-center mb-3">
              <div
                className="w-10 h-10 rounded-md bg-primary flex items-center justify-center mr-3"
              >
                <ExperimentOutlined className="text-[20px] text-white" />
              </div>
              <span className="text-body-sm font-medium text-gray-600 dark:text-gray-400">
                Available Models
              </span>
            </div>
            <div className="text-[28px] font-bold text-gray-900 dark:text-gray-50 data-text">
              {totalModels}
            </div>
            <span className="text-body-sm text-gray-500 dark:text-gray-400">
              Built-in AI models
            </span>
          </GlassCard>
        </Col>
      </Row>

      {/* Models Table */}
      <DataTable
        columns={columns}
        dataSource={models}
        rowKey="id"
        loading={loading}
        enableZebraStriping={true}
        stickyHeader={true}
        scroll={{ x: isMobile ? "max-content" : undefined }}
        pagination={false}
      />

      {/* Info Card */}
      <Card
        title="About AI Models"
        style={{ marginTop: isMobile ? 16 : 24 }}
      >
        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
          <Col xs={24} md={8}>
            <LineChartOutlined className="text-2xl text-info mb-2" />
            <h5 className="text-h5 font-display font-semibold text-gray-900 dark:text-gray-50 mb-2">
              Time Series Forecasting
            </h5>
            <p className="text-body text-gray-600 dark:text-gray-400">
              Use built-in ARIMA, FFT, or Neural Network models to generate predictions for your time series data.
            </p>
          </Col>
          <Col xs={24} md={8}>
            <ExperimentOutlined className="text-2xl text-purple-600 mb-2" />
            <h5 className="text-h5 font-display font-semibold text-gray-900 dark:text-gray-50 mb-2">
              Anomaly Detection
            </h5>
            <p className="text-body text-gray-600 dark:text-gray-400">
              Detect anomalies in your data using statistical and machine learning methods.
            </p>
          </Col>
          <Col xs={24} md={8}>
            <ThunderboltOutlined className="text-2xl text-primary mb-2" />
            <h5 className="text-h5 font-display font-semibold text-gray-900 dark:text-gray-50 mb-2">
              IoTDB AI Node
            </h5>
            <p className="text-body text-gray-600 dark:text-gray-400">
              Models run directly on IoTDB server for optimal performance.
            </p>
          </Col>
        </Row>
      </Card>
    </PageContainer>
  );
}
