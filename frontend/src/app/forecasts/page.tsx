"use client";

import {
  DateField,
  DeleteButton,
  List,
  ShowButton,
  useTable,
  CreateButton,
} from "@refinedev/antd";
import { Space, Table, Tag, Badge, Row, Col } from "antd";
import type { Breakpoint } from "antd";
import { useList } from "@refinedev/core";
import {
  LineChartOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  DownloadOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { Button } from "@/components/ui";
import { GlassCard } from "@/components/ui/GlassCard";
import { useIsMobile } from "@/lib/responsive-utils";

export default function ForecastList() {
  const { tableProps } = useTable({
    syncWithLocation: true,
    sorters: {
      initial: [{ field: "timestamp", order: "desc" }],
    },
  });

  const isMobile = useIsMobile();

  // Get statistics
  const forecastStatsResult = useList({
    resource: "forecasts",
    pagination: { pageSize: 1000 },
  });

  const forecastStats = forecastStatsResult?.result?.data ?? [];
  const totalForecasts = forecastStats?.length ?? 0;

  // Calculate unique models and timeseries
  const uniqueModels = new Set(forecastStats.map((f: any) => f.modelId)).size;
  const uniqueTimeseries = new Set(forecastStats.map((f: any) => f.timeseriesId)).size;

  // Calculate anomalies
  const anomalyCount = forecastStats?.filter((f: any) => f.isAnomaly).length ?? 0;

  // Define table columns
  const columns = [
    {
      dataIndex: "id",
      title: "ID",
      width: 100,
      fixed: "left" as const,
      responsive: ["lg"] as Breakpoint[],
      render: (id: string) => (
        <code className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 data-text">
          {id.slice(0, 8)}...
        </code>
      ),
    },
    {
      dataIndex: "timestamp",
      title: "Forecast Time",
      width: 160,
      sorter: true,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (value: string) => (
        <Space direction="vertical" size={0}>
          <DateField value={value} format="YYYY-MM-DD HH:mm" />
        </Space>
      ),
    },
    {
      dataIndex: "timeseries",
      title: "Time Series",
      width: 180,
      ellipsis: true,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (ts: any) => (
        <Space>
          <span className="font-semibold text-gray-900 dark:text-gray-50">{ts?.name || "-"}</span>
        </Space>
      ),
    },
    {
      dataIndex: "model",
      title: "Model",
      width: 140,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (model: any) => {
        const algo = model?.algorithm;
        const colors: Record<string, string> = {
          ARIMA: "blue",
          PROPHET: "purple",
          LSTM: "green",
          TRANSFORMER: "orange",
          ENSEMBLE: "red",
        };
        return algo ? (
          <Tag color={colors[algo] || "default"}>{algo}</Tag>
        ) : "-";
      },
    },
    {
      dataIndex: "predictedValue",
      title: "Predicted Value",
      width: 140,
      align: "right" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (value: any, record: any) => {
        const numValue = typeof value === "object" ? value.toNumber?.() : Number(value);
        const unit = record.timeseries?.unit || "";
        return (
          <span className="data-text text-[13px] text-gray-700 dark:text-gray-300">
            {numValue.toFixed(2)} {unit}
          </span>
        );
      },
    },
    {
      dataIndex: "confidence",
      title: "Confidence",
      width: 110,
      align: "center" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (value: any) => {
        const numValue = typeof value === "object" ? value.toNumber?.() : Number(value);
        const percentage = (numValue * 100).toFixed(0);
        const color = numValue >= 0.9 ? "green" : numValue >= 0.7 ? "blue" : "orange";
        return <Tag color={color}>{percentage}%</Tag>;
      },
    },
    {
      dataIndex: "lowerBound",
      title: "Range",
      width: 160,
      align: "right" as const,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (_: any, record: any) => {
        const lower = typeof record.lowerBound === "object"
          ? record.lowerBound.toNumber?.()
          : Number(record.lowerBound);
        const upper = typeof record.upperBound === "object"
          ? record.upperBound.toNumber?.()
          : Number(record.upperBound);
        const unit = record.timeseries?.unit || "";

        if (!lower || !upper) {
          return <span className="text-gray-400 dark:text-gray-600">-</span>;
        }

        return (
          <span className="data-text text-xs text-gray-700 dark:text-gray-300">
            [{lower.toFixed(2)}, {upper.toFixed(2)}] {unit}
          </span>
        );
      },
    },
    {
      dataIndex: "isAnomaly",
      title: "Anomaly",
      width: 100,
      align: "center" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (isAnomaly: boolean, record: any) => {
        const probability = typeof record.anomalyProbability === "object"
          ? record.anomalyProbability.toNumber?.()
          : Number(record.anomalyProbability);

        if (isAnomaly) {
          return (
            <Space direction="vertical" size={0}>
              <Badge status="error" text="Yes" />
              {probability > 0 && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 data-text">
                  {(probability * 100).toFixed(0)}%
                </span>
              )}
            </Space>
          );
        }
        return <Badge status="success" text="No" />;
      },
    },
    {
      dataIndex: "createdAt",
      title: "Created At",
      width: 140,
      sorter: true,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (value: string) => <DateField value={value} format="YYYY-MM-DD" />,
    },
    {
      title: "Actions",
      dataIndex: "actions",
      width: isMobile ? 80 : 120,
      fixed: "right" as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <ShowButton hideText={!isMobile} size="small" recordItemId={record.id} />
          <DeleteButton hideText={!isMobile} size="small" recordItemId={record.id} confirmTitle="Delete this forecast?" />
        </Space>
      ),
    },
  ];

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "AI & Anomaly Detection", href: "/ai" },
    { title: "Forecasts" },
  ];

  // Handle export to CSV
  const handleExport = () => {
    // Get current data from table
    const dataSource = tableProps.dataSource || [];

    if (dataSource.length === 0) {
      return;
    }

    // Define CSV headers
    const headers = [
      "ID",
      "Forecast Time",
      "Time Series",
      "Algorithm",
      "Predicted Value",
      "Unit",
      "Confidence",
      "Lower Bound",
      "Upper Bound",
      "Is Anomaly",
      "Anomaly Probability",
      "Created At",
    ];

    // Convert data to CSV rows
    const csvRows = [
      headers.join(","),
      ...dataSource.map((record: any) => {
        const timeseriesName = record.timeseries?.name || "-";
        const algorithm = record.model?.algorithm || "-";
        const predictedValue = typeof record.predictedValue === "object"
          ? record.predictedValue.toNumber?.()
          : Number(record.predictedValue);
        const unit = record.timeseries?.unit || "";
        const confidence = typeof record.confidence === "object"
          ? record.confidence.toNumber?.()
          : Number(record.confidence);
        const lowerBound = typeof record.lowerBound === "object"
          ? record.lowerBound.toNumber?.()
          : Number(record.lowerBound);
        const upperBound = typeof record.upperBound === "object"
          ? record.upperBound.toNumber?.()
          : Number(record.upperBound);
        const anomalyProbability = typeof record.anomalyProbability === "object"
          ? record.anomalyProbability.toNumber?.()
          : Number(record.anomalyProbability);

        return [
          record.id,
          record.timestamp || "",
          `"${timeseriesName}"`,
          algorithm,
          predictedValue?.toFixed(4) || "",
          `"${unit}"`,
          confidence?.toFixed(4) || "",
          lowerBound?.toFixed(4) || "",
          upperBound?.toFixed(4) || "",
          record.isAnomaly ? "Yes" : "No",
          anomalyProbability?.toFixed(4) || "",
          record.createdAt || "",
        ].join(",");
      }),
    ];

    // Create blob and download
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `forecasts_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageContainer>
      <List>
        <PageHeader
          title="Forecasts"
          description="AI-powered time series forecasting and predictions"
          breadcrumbs={breadcrumbItems}
          actions={
            <Space>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                icon={<DownloadOutlined />}
              >
                {!isMobile && "Export"}
              </Button>
              <CreateButton
                icon={<PlusOutlined />}
                style={{
                  background: "#0066CC",
                  border: "none",
                  height: "40px",
                  borderRadius: "4px",
                  fontWeight: 600,
                }}
              >
                {!isMobile && "Generate Forecast"}
              </CreateButton>
            </Space>
          }
        />

        {/* Statistics Cards with Glassmorphism */}
        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={12} sm={12} md={6}>
            <GlassCard intensity="medium" style={{ padding: isMobile ? "16px" : "20px" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-md bg-primary flex items-center justify-center"
                >
                  <LineChartOutlined style={{ fontSize: "20px", color: "#fff" }} />
                </div>
                <span className="text-body-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Forecasts
                </span>
              </div>
              <div className="text-[28px] font-bold text-gray-900 dark:text-gray-50 mb-1 data-text">
                {totalForecasts}
              </div>
              <span className="text-body-sm text-gray-500 dark:text-gray-400">
                AI predictions generated
              </span>
            </GlassCard>
          </Col>

          <Col xs={12} sm={12} md={6}>
            <GlassCard intensity="medium" style={{ padding: isMobile ? "16px" : "20px" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-md bg-info flex items-center justify-center"
                >
                  <ThunderboltOutlined style={{ fontSize: "20px", color: "#fff" }} />
                </div>
                <span className="text-body-sm font-medium text-gray-600 dark:text-gray-400">
                  Active Models
                </span>
              </div>
              <div className="text-[28px] font-bold text-gray-900 dark:text-gray-50 mb-1 data-text">
                {uniqueModels}
              </div>
              <span className="text-body-sm text-success dark:text-success-light">
                AI algorithms
              </span>
            </GlassCard>
          </Col>

          <Col xs={12} sm={12} md={6}>
            <GlassCard intensity="medium" style={{ padding: isMobile ? "16px" : "20px" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center"
                >
                  <ClockCircleOutlined style={{ fontSize: "20px", color: "#fff" }} />
                </div>
                <span className="text-body-sm font-medium text-gray-600 dark:text-gray-400">
                  Time Series
                </span>
              </div>
              <div className="text-[28px] font-bold text-gray-900 dark:text-gray-50 mb-1 data-text">
                {uniqueTimeseries}
              </div>
              <span className="text-body-sm text-gray-500 dark:text-gray-400">
                Being forecasted
              </span>
            </GlassCard>
          </Col>

          <Col xs={12} sm={12} md={6}>
            <GlassCard intensity="medium" style={{ padding: isMobile ? "16px" : "20px" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-md bg-warning flex items-center justify-center"
                >
                  <LineChartOutlined style={{ fontSize: "20px", color: "#fff" }} />
                </div>
                <span className="text-body-sm font-medium text-gray-600 dark:text-gray-400">
                  Anomalies Detected
                </span>
              </div>
              <div className="text-[28px] font-bold text-gray-900 dark:text-gray-50 mb-1 data-text">
                {anomalyCount}
              </div>
              <span className={`text-body-sm ${anomalyCount > 0 ? "text-warning dark:text-warning-light" : "text-success dark:text-success-light"}`}>
                {anomalyCount > 0 ? "Need attention" : "All normal"}
              </span>
            </GlassCard>
          </Col>
        </Row>

        {/* Data Table */}
        <DataTable
          {...tableProps}
          rowKey="id"
          columns={columns}
          enableZebraStriping={true}
          stickyHeader={true}
          scroll={{ x: isMobile ? "max-content" : undefined }}
          pagination={{
            pageSize: isMobile ? 10 : 20,
            showSizeChanger: !isMobile,
            simple: isMobile,
          }}
        />
      </List>
    </PageContainer>
  );
}
