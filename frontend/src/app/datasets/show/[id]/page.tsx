"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Row,
  Col,
  Statistic,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Descriptions,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  CloudDownloadOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Breakpoint } from "antd";
import type { Dataset, TimeSeries } from "@/types/api";
import { authFetch } from "@/utils/auth";
import { DetailPageLayout, DetailSection } from "@/components/layout/DetailPageLayout";
import { useIsMobile } from "@/lib/responsive-utils";

interface DatasetDetailParams {
  id?: string;
}

interface DatasetWithStats extends Dataset {
  datapointsCount?: number;
  sizeMB?: number;
  lastImport?: string;
  storageLocation?: string;
}

export default function DatasetDetailPage() {
  const params = useParams() as DatasetDetailParams;
  const router = useRouter();
  const [dataset, setDataset] = useState<DatasetWithStats | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchDataset = useCallback(async () => {
    if (!params.id) {
      setError("Dataset ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch(`/api/datasets/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch dataset");
      }
      const data = await response.json();
      setDataset(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchTimeseries = useCallback(async () => {
    if (!params.id) return;

    try {
      const response = await authFetch(`/api/datasets/${params.id}/timeseries`);
      if (response.ok) {
        const data = await response.json();
        setTimeseries(data.data || data.items || []);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to fetch timeseries:", err);
    }
  }, [params.id]);

  useEffect(() => {
    fetchDataset();
    fetchTimeseries();
  }, [fetchDataset, fetchTimeseries]);

  const handleDelete = async () => {
    // TODO: Implement delete with confirmation
    router.push("/datasets");
  };

  if (loading) {
    return (
      <DetailPageLayout
        title="Dataset Details"
        loading={loading}
      />
    );
  }

  if (error || !dataset) {
    return (
      <DetailPageLayout
        title="Dataset"
        error={error || "Dataset not found"}
      />
    );
  }

  const breadcrumb = [
    { label: "Datasets", href: "/datasets" },
    { label: dataset.name }
  ];

  const actions = [
    {
      icon: <EditOutlined />,
      label: "Edit",
      href: `/datasets/edit/${dataset.id}`
    },
    {
      icon: <CloudDownloadOutlined />,
      label: "Export",
      onClick: () => router.push(`/datasets/export/${dataset.id}`)
    },
    {
      icon: <DeleteOutlined />,
      label: "Delete",
      danger: true,
      onClick: handleDelete
    }
  ];

  const storageFormatColors: Record<string, string> = {
    TSFILE: "blue",
    IoTDB: "green",
    PARQUET: "purple"
  };

  return (
    <DetailPageLayout
      title={dataset.name}
      subtitle={dataset.description}
      breadcrumb={breadcrumb}
      actions={actions}
    >
      {/* Summary Card */}
      <DetailSection title="Dataset Summary" colSpan={isMobile ? 24 : 8}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Storage Format">
              <Tag color={storageFormatColors[dataset.storageFormat]}>
                {dataset.storageFormat}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Visibility">
              <Tag color={dataset.isPublic ? "green" : "orange"}>
                {dataset.isPublic ? "Public" : "Private"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Import Status">
              <Tag color={dataset.isImported ? "success" : "processing"}>
                {dataset.isImported ? "Imported" : "Pending"}
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          <Statistic
            title="Time Series"
            value={dataset._count?.timeseries || timeseries.length || 0}
            prefix={<DatabaseOutlined />}
            suffix="series"
          />

          {dataset.datapointsCount !== undefined && (
            <Statistic
              title="Total Data Points"
              value={dataset.datapointsCount}
              prefix={<LineChartOutlined />}
            />
          )}

          {dataset.sizeMB !== undefined && (
            <Statistic
              title="Storage Size"
              value={dataset.sizeMB}
              suffix="MB"
              precision={2}
            />
          )}
        </Space>
      </DetailSection>

      {/* Description Card */}
      {dataset.description && (
        <DetailSection title="Description" colSpan={isMobile ? 24 : 16}>
          <p className="text-body">{dataset.description}</p>
          <Space direction="vertical" style={{ width: "100%", marginTop: "16px" }}>
            <span className="text-body-sm text-gray-500 dark:text-gray-400">
              Created: {new Date(dataset.createdAt).toLocaleString()}
            </span>
            <span className="text-body-sm text-gray-500 dark:text-gray-400">
              Updated: {new Date(dataset.updatedAt).toLocaleString()}
            </span>
          </Space>
        </DetailSection>
      )}

      {/* Time Series List */}
      <DetailSection
        title="Associated Time Series"
        colSpan={24}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            href={`/timeseries/create?dataset=${dataset.id}`}
            style={{
              background: "#0066CC",
              border: "none",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            Add Series
          </Button>
        }
      >
        {timeseries.length === 0 ? (
          <Card>
            <span className="text-body text-gray-500 dark:text-gray-400">No time series associated with this dataset.</span>
          </Card>
        ) : (
          <Table
            columns={timeseriesColumns}
            dataSource={timeseries}
            rowKey={(record) => record.id}
            pagination={isMobile ? { pageSize: 5 } : { pageSize: 10 }}
            scroll={{ x: "max-content" }}
            size={isMobile ? "small" : "large"}
            onRow={(record) => ({
              onClick: () => router.push(`/timeseries/${record.id}`),
              style: { cursor: "pointer" }
            })}
          />
        )}
      </DetailSection>

      {/* Statistics Card */}
      {dataset.datapointsCount !== undefined && dataset.datapointsCount > 0 && (
        <DetailSection title="Statistics" colSpan={24}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Data Points"
                  value={dataset.datapointsCount}
                  valueStyle={{ color: "#3f860a" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Time Series"
                  value={dataset._count?.timeseries || timeseries.length}
                  suffix="/ 100"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Storage Used"
                  value={dataset.sizeMB || 0}
                  suffix="MB"
                  precision={2}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Last Import"
                  value={dataset.lastImport ? "Recently" : "Never"}
                />
              </Card>
            </Col>
          </Row>
        </DetailSection>
      )}
    </DetailPageLayout>
  );
}

// Table columns for time series
const timeseriesColumns: ColumnsType<TimeSeries> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    render: (name, _record) => (
      <Space>
        <DatabaseOutlined />
        <span className="font-semibold text-gray-900 dark:text-gray-50">{name}</span>
      </Space>
    )
  },
  {
    title: "Path",
    dataIndex: "path",
    key: "path",
    responsive: ["lg"] as Breakpoint[]
  },
  {
    title: "Unit",
    dataIndex: "unit",
    key: "unit",
    responsive: ["md"] as Breakpoint[],
    render: (unit) => unit || "-"
  },
  {
    title: "Data Points",
    dataIndex: "_count",
    key: "datapoints",
    render: (count) => count?.datapoints || 0,
    responsive: ["lg"] as Breakpoint[]
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    key: "createdAt",
    render: (date) => new Date(date).toLocaleDateString(),
    responsive: ["xl"] as Breakpoint[]
  }
];
