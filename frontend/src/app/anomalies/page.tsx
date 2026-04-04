"use client";

import {
  DeleteButton,
  List,
  ShowButton,
  useTable,
} from "@refinedev/antd";
import { Space, Tag, Typography } from "antd";
import type { Breakpoint } from "antd";
import { DateField, NumberField } from "@refinedev/antd";
import { useList } from "@refinedev/core";
import {
  AlertOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { ResponsiveStats } from "@/components/ui/MobileStatsCard";
import { useIsMobile } from "@/lib/responsive-utils";

const { Text } = Typography;

export default function AnomalyList() {
  const { tableProps } = useTable({
    syncWithLocation: true,
    sorters: {
      initial: [{ field: "detectedAt", order: "desc" }],
    },
  });

  const isMobile = useIsMobile();

  // Get statistics
  const anomaliesStatsResult = useList({
    resource: "anomalies",
    pagination: { pageSize: 1000 },
  });

  const anomaliesStats = anomaliesStatsResult?.result?.data ?? [];
  const totalAnomalies = anomaliesStats?.length ?? 0;
  const criticalCount = anomaliesStats?.filter((a: any) => a.severity === "CRITICAL").length ?? 0;
  const highCount = anomaliesStats?.filter((a: any) => a.severity === "HIGH").length ?? 0;

  // Define table columns
  const columns = [
    {
      dataIndex: "id",
      title: "ID",
      width: 100,
      fixed: "left" as const,
      responsive: ["lg"] as Breakpoint[],
      render: (id: string) => (
        <code style={{ fontSize: 12, padding: "2px 6px", background: "#f5f5f5", borderRadius: 4 }}>
          {id.slice(0, 8)}...
        </code>
      ),
    },
    {
      dataIndex: "severity",
      title: "Severity",
      width: 120,
      sorter: true,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (severity: string) => {
        const colors: Record<string, string> = {
          LOW: "green",
          MEDIUM: "orange",
          HIGH: "red",
          CRITICAL: "purple",
        };
        const icons: Record<string, React.ReactNode> = {
          LOW: <ExclamationCircleOutlined />,
          MEDIUM: <WarningOutlined />,
          HIGH: <AlertOutlined />,
          CRITICAL: <CloseCircleOutlined />,
        };
        return (
          <Tag
            color={colors[severity]}
            icon={icons[severity]}
            style={{ margin: 0 }}
          >
            {severity}
          </Tag>
        );
      },
    },
    {
      dataIndex: "timeseries",
      title: "Time Series",
      width: 180,
      ellipsis: true,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (ts: any) => ts?.name || "-",
    },
    {
      dataIndex: "value",
      title: "Value",
      width: 120,
      align: "right" as const,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (val: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          <NumberField value={Number(val) || 0} options={{ notation: "standard" }} />
        </span>
      ),
    },
    {
      dataIndex: "expectedRange",
      title: "Expected Range",
      width: 160,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (_: any, record: any) => (
        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, color: "#6B7280" }}>
          {record.minExpected} - {record.maxExpected}
        </span>
      ),
    },
    {
      dataIndex: "detectionMethod",
      title: "Detection Method",
      width: 140,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (method: string) => <Tag>{method}</Tag>,
    },
    {
      dataIndex: "detectedAt",
      title: "Detected At",
      width: 140,
      sorter: true,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (value: string) => <DateField value={value} format="YYYY-MM-DD HH:mm" />,
    },
    {
      title: "Actions",
      dataIndex: "actions",
      width: isMobile ? 80 : 120,
      fixed: "right" as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <ShowButton hideText={!isMobile} size="small" recordItemId={record.id} />
          <DeleteButton hideText={!isMobile} size="small" recordItemId={record.id} />
        </Space>
      ),
    },
  ];

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "AI & Anomaly Detection", href: "/ai/anomalies" },
    { title: "Detected Anomalies" },
  ];

  return (
    <PageContainer>
      <List>
        <PageHeader
          title="Detected Anomalies"
          description="AI-powered anomaly detection for your time series data"
          breadcrumbs={breadcrumbItems}
        />

        {/* Statistics - Mobile-First Responsive Layout */}
        <ResponsiveStats
          isMobile={isMobile}
          items={[
            {
              label: "Total Anomalies",
              value: totalAnomalies,
            },
            {
              label: "Critical",
              value: criticalCount,
              color: "#0066CC",
            },
            {
              label: "High",
              value: highCount,
              color: "#EC4899",
            },
            {
              label: "Detection Rate",
              value: "98.5",
              suffix: "%",
            },
          ]}
          featuredIndex={0}
        />

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
