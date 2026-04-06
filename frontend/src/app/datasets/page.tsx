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
import { Space, Tag } from "antd";
import type { Breakpoint } from "antd";
import { useList } from "@refinedev/core";
import {
  PlusOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { ResponsiveStats } from "@/components/ui/MobileStatsCard";
import { useIsMobile } from "@/lib/responsive-utils";

export default function DatasetsList() {
  const { tableProps } = useTable({
    syncWithLocation: true,
    sorters: {
      initial: [{ field: "createdAt", order: "desc" }],
    },
  });

  const isMobile = useIsMobile();

  const datasetsStatsResult = useList({
    resource: "datasets",
    pagination: { pageSize: 1000 },
  });

  const datasetsStats = datasetsStatsResult?.result?.data ?? [];
  const totalDatasets = datasetsStats?.length ?? 0;
  const publicDatasets = datasetsStats?.filter(
    (ds: any) => ds.isPublic
  ).length ?? 0;
  const importedDatasets = datasetsStats?.filter(
    (ds: any) => ds.isImported
  ).length ?? 0;

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
          <span className="font-semibold">{name}</span>
          {record.isPublic && (
            <Tag color="green" className="text-[11px]">Public</Tag>
          )}
        </Space>
      ),
    },
    {
      dataIndex: "description",
      title: "Description",
      width: 250,
      ellipsis: true,
      responsive: ["md", "lg", "xl"] as Breakpoint[],
      render: (desc: string) => desc || "-",
    },
    {
      dataIndex: "storageFormat",
      title: "Storage",
      width: 130,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (format: string) => (
        <Tag color="blue">{format || "IOTDB_CACHE"}</Tag>
      ),
    },
    {
      dataIndex: "rowsCount",
      title: "Rows",
      width: 100,
      align: "right" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (count: number) => (
        <span className="data-text text-[13px] text-gray-700 dark:text-gray-300">
          {(count ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      dataIndex: ["_count", "timeseries"],
      title: "Time Series",
      width: 110,
      align: "center" as const,
      responsive: ["sm", "md", "lg", "xl"] as Breakpoint[],
      render: (count: number) => (
        <Tag color={count > 0 ? "blue" : "default"} className="m-0">
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
    { title: "Datasets" },
  ];

  return (
    <PageContainer>
      <List breadcrumb={false}>
        <PageHeader
          title="Datasets"
          description="Manage your time series datasets"
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
              {!isMobile && "Create Dataset"}
            </CreateButton>
          }
        />

        <div style={{ marginBottom: isMobile ? 16 : 32 }}>
          <ResponsiveStats
            isMobile={isMobile}
            items={[
              {
                label: "Total Datasets",
                value: totalDatasets,
              },
              {
                label: "Public",
                value: publicDatasets,
              },
              {
                label: "Imported",
                value: importedDatasets,
              },
            ]}
            featuredIndex={0}
          />
        </div>

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
            showTotal: (total) => `Total ${total} dataset${total !== 1 ? "s" : ""}`,
            position: ["bottomRight"] as ["bottomRight"],
            simple: isMobile,
          }}
        />
      </List>
    </PageContainer>
  );
}
