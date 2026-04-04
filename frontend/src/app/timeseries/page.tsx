"use client";

import {
  DateField,
  DeleteButton,
  EditButton,
  List,
  ShowButton,
  useTable,
  CreateButton,
} from "@refinedev/antd";
import { Space, Table, Tag } from "antd";
import type { Breakpoint } from "antd";
import { useList } from "@refinedev/core";
import {
  DatabaseOutlined,
  AlertOutlined,
  PlusOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/tables/DataTable";
import { ResponsiveStats } from "@/components/ui/MobileStatsCard";
import { useIsMobile } from "@/lib/responsive-utils";

export default function TimeseriesList() {
  const { tableProps } = useTable({
    syncWithLocation: true,
    sorters: {
      initial: [{ field: "createdAt", order: "desc" }],
    },
  });

  const isMobile = useIsMobile();

  // Get statistics
  const timeseriesStatsResult = useList({
    resource: "timeseries",
    pagination: { pageSize: 1000 },
  });

  const timeseriesStats = timeseriesStatsResult?.result?.data ?? [];
  const totalTimeseries = timeseriesStats?.length ?? 0;
  const totalDataPoints = timeseriesStats?.reduce(
    (sum: number, ts: any) => sum + (ts._count?.dataPoints || 0),
    0
  ) ?? 0;
  const totalAnomalies = timeseriesStats?.reduce(
    (sum: number, ts: any) => sum + (ts._count?.anomalies || 0),
    0
  ) ?? 0;

  // Calculate trends (placeholder values - replace with real trend calculation)
  const timeseriesTrend: number | undefined = undefined;
  const anomaliesTrend: number | undefined = undefined;

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
      dataIndex: "name",
      title: "Name",
      width: 200,
      sorter: true,
      render: (name: string, record: any) => (
        <Space>
          <span
            className="font-semibold"
            style={{ color: record.colorHex || undefined }}
          >
            {name}
          </span>
          {record.isAnomalyDetectionEnabled && (
            <Tag color="orange" className="text-[11px]">
              Anomaly Detection
            </Tag>
          )}
        </Space>
      ),
    },
    {
      dataIndex: "slug",
      title: "Slug",
      width: 160,
      ellipsis: true,
      responsive: ["lg", "xl"] as Breakpoint[],
    },
    {
      dataIndex: "unit",
      title: "Unit",
      width: 80,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (unit: string) => unit || "-",
    },
    {
      dataIndex: "dataset",
      title: "Dataset",
      width: 180,
      ellipsis: true,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (dataset: any) => dataset?.name || "-",
    },
    {
      dataIndex: ["_count", "dataPoints"],
      title: "Data Points",
      width: 120,
      align: "right" as const,
      sorter: true,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (count: number) => (
        <span className="data-text text-[13px] text-gray-700 dark:text-gray-300">
          {(count ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      dataIndex: ["_count", "anomalies"],
      title: "Anomalies",
      width: 100,
      align: "center" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (count: number) => (
        <Tag color={count > 0 ? "red" : "green"} className="m-0">
          {count ?? 0}
        </Tag>
      ),
    },
    {
      dataIndex: ["createdAt"],
      title: "Created",
      width: 140,
      sorter: true,
      responsive: ["lg", "xl"] as Breakpoint[],
      render: (value: string) => <DateField value={value} format="YYYY-MM-DD" />,
    },
    {
      title: "Actions",
      dataIndex: "actions",
      width: isMobile ? 80 : 140,
      fixed: "right" as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <ShowButton hideText={!isMobile} size="small" recordItemId={record.id} />
          <EditButton hideText={!isMobile} size="small" recordItemId={record.id} />
          <DeleteButton hideText={!isMobile} size="small" recordItemId={record.id} />
        </Space>
      ),
    },
  ];

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "Time Series" },
  ];

  return (
    <PageContainer>
      <List>
        <PageHeader
          title="Time Series"
          description="Manage your time series data with real-time analytics"
          breadcrumbs={breadcrumbItems}
          actions={
            <CreateButton
              style={{
                background: "#0066CC",
                border: "none",
                height: "40px",
                borderRadius: "4px",
                fontWeight: 600,
              }}
              icon={<PlusOutlined />}
            >
              {!isMobile && "Create Time Series"}
            </CreateButton>
          }
        />

        {/* Statistics - Mobile-First Responsive Layout */}
        <div style={{ marginBottom: isMobile ? 16 : 32 }}>
          <ResponsiveStats
            isMobile={isMobile}
            items={[
              {
                label: "Total Time Series",
                value: totalTimeseries,
                trend: timeseriesTrend,
              },
              {
                label: "Data Points",
                value: totalDataPoints,
              },
              {
                label: "Anomalies",
                value: totalAnomalies,
                trend: anomaliesTrend,
                color: totalAnomalies > 0 ? "#EF4444" : undefined,
              },
              // TODO: Replace with real storage usage data from API
              {
                label: "Storage",
                value: "-",
                suffix: "",
              },
            ]}
            featuredIndex={0}
          />
        </div>

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
