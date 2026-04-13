/**
 * Forecast Detail Page
 *
 * Displays detailed information about a specific forecast including:
 * - Forecast metadata (algorithm, parameters, accuracy)
 * - Visualization of predicted vs actual values
 * - Confidence intervals
 * - Historical runs comparison
 */

"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Row,
  Col,
  Statistic,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Alert,
  Modal,
  message,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Forecast } from "@/types/api";
import { authFetch } from "@/utils/auth";
import { DetailPageLayout, DetailSection } from "@/components/layout/DetailPageLayout";
import { useIsMobile } from "@/lib/responsive-utils";

interface ForecastDetailParams {
  id?: string;
}

interface ForecastWithDetails extends Forecast {
  algorithm?: string;
  horizon?: number;
  accuracy?: number;
  mae?: number;
  rmse?: number;
  status?: "pending" | "running" | "completed" | "failed";
}

export default function ForecastDetailPage() {
  const params = useParams() as ForecastDetailParams;
  const router = useRouter();
  const [forecast, setForecast] = useState<ForecastWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchForecast = useCallback(async () => {
    if (!params.id) {
      setError("Forecast ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch(`/api/forecasts/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch forecast");
      }
      const data = await response.json();
      setForecast(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const handleDelete = async () => {
    Modal.confirm({
      title: "Delete Forecast",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to delete this forecast? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const response = await authFetch(`/api/forecasts/${params.id}`, { method: "DELETE" });
          if (!response.ok) {
            throw new Error("Failed to delete forecast");
          }
          message.success("Forecast deleted");
          router.push("/forecasts");
        } catch {
          message.error("Failed to delete forecast");
        }
      },
    });
  };

  if (loading) {
    return (
      <DetailPageLayout
        title="Forecast Details"
        loading={loading}
      />
    );
  }

  if (error || !forecast) {
    return (
      <DetailPageLayout
        title="Forecast"
        error={error || "Forecast not found"}
      />
    );
  }

  const breadcrumb = [
    { label: "Forecasts", href: "/forecasts" },
    { label: forecast.id.substring(0, 8) || "Detail" }
  ];

  const actions = [
    {
      icon: <EditOutlined />,
      label: "Edit",
      href: `/forecasts/edit/${forecast.id}`
    },
    {
      icon: <DeleteOutlined />,
      label: "Delete",
      danger: true,
      onClick: handleDelete
    }
  ];

  return (
    <DetailPageLayout
      title={forecast.timeseries?.name || "Forecast"}
      subtitle={`Created ${new Date(forecast.createdAt).toLocaleString()}`}
      breadcrumb={breadcrumb}
      actions={actions}
    >
      {/* Summary Card */}
      <DetailSection title="Forecast Summary" colSpan={isMobile ? 24 : 8}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Statistic
            title="Status"
            value={forecast.status || "completed"}
            valueStyle={{
              color: forecast.status === "completed" ? "#22c55e" :
                     forecast.status === "failed" ? "#ef4444" : "#f59e0b"
            }}
            prefix={<CheckCircleOutlined />}
          />

          <Statistic
            title="Algorithm"
            value={forecast.algorithm || "arima"}
            suffix={<Tag color="blue">AI Model</Tag>}
          />

          <Statistic
            title="Forecast Horizon"
            value={forecast.horizon || forecast.predictedValues?.length || 0}
            suffix="steps"
          />

          {forecast.accuracy !== undefined && (
            <Statistic
              title="Accuracy"
              value={forecast.accuracy}
              precision={2}
              suffix="%"
              valueStyle={{ color: forecast.accuracy > 80 ? "#22c55e" : "#f59e0b" }}
            />
          )}
        </Space>
      </DetailSection>

      {/* Chart Card */}
      <DetailSection title="Forecast Visualization" colSpan={isMobile ? 24 : 16}>
        <Alert
          message="Forecast chart will be displayed here"
          description="This will show the predicted values with confidence intervals"
          type="info"
          showIcon
          style={{ marginBottom: "16px" }}
        />
        <div className="h-[300px] flex items-center justify-center bg-info/10 rounded-lg border border-dashed border-info/30">
          <LineChartOutlined className="text-[48px] text-info" />
          <span className="text-body text-gray-500 dark:text-gray-400 ml-4">
            Chart visualization
          </span>
        </div>
      </DetailSection>

      {/* Parameters Card */}
      <DetailSection title="Forecast Parameters" colSpan={24}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card size="small" title="Time Range">
              <Space direction="vertical" style={{ width: "100%" }}>
                <span className="text-body">
                  <ClockCircleOutlined /> Start:{" "}
                  {new Date(forecast.startTime).toLocaleString()}
                </span>
                <span className="text-body">
                  <ClockCircleOutlined /> End:{" "}
                  {new Date(forecast.endTime).toLocaleString()}
                </span>
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card size="small" title="Model">
              <Space direction="vertical" style={{ width: "100%" }}>
                <span className="text-body">Model ID: {forecast.modelId?.substring(0, 8)}...</span>
                <span className="text-body">Type: {forecast.model?.algorithm || "arima"}</span>
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card size="small" title="Performance Metrics">
              <Space direction="vertical" style={{ width: "100%" }}>
                {forecast.mae !== undefined && (
                  <span className="text-body data-text">MAE: {forecast.mae.toFixed(4)}</span>
                )}
                {forecast.rmse !== undefined && (
                  <span className="text-body data-text">RMSE: {forecast.rmse.toFixed(4)}</span>
                )}
              </Space>
            </Card>
          </Col>
        </Row>
      </DetailSection>

      {/* Predicted Values Table */}
      <DetailSection title="Predicted Values" colSpan={24}>
        <Table
          columns={predictedValuesColumns}
          dataSource={forecast.predictedValues.map((value, index) => ({
            key: index,
            index: index + 1,
            value,
            lower: forecast.confidenceIntervals?.lower?.[index],
            upper: forecast.confidenceIntervals?.upper?.[index]
          }))}
          pagination={{ pageSize: 10 }}
          scroll={{ x: "max-content" }}
          size={isMobile ? "small" : "large"}
        />
      </DetailSection>

      {/* Historical Runs */}
      <DetailSection title="Historical Runs" colSpan={24} extra={<Button type="link">View All</Button>}>
        <Alert
          message="Historical forecast runs will be displayed here"
          description="Compare different forecast runs for the same time series"
          type="info"
          showIcon={false}
        />
      </DetailSection>
    </DetailPageLayout>
  );
}

// Table columns for predicted values
const predictedValuesColumns: ColumnsType<{
  key: number;
  index: number;
  value: number;
  lower?: number;
  upper?: number;
}> = [
  {
    title: "#",
    dataIndex: "index",
    key: "index",
    width: 80
  },
  {
    title: "Predicted Value",
    dataIndex: "value",
    key: "value",
    render: (value) => <span className="data-text">{value.toFixed(4)}</span>
  },
  {
    title: "Lower Bound",
    dataIndex: "lower",
    key: "lower",
    render: (lower) => lower !== undefined ? <span className="data-text">{lower.toFixed(4)}</span> : "-"
  },
  {
    title: "Upper Bound",
    dataIndex: "upper",
    key: "upper",
    render: (upper) => upper !== undefined ? <span className="data-text">{upper.toFixed(4)}</span> : "-"
  }
];
