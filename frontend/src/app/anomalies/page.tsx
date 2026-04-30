"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useList, deleteRecord } from "@/lib/api";
import { Table, type Column } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useIsMobile } from "@/lib/responsive-utils";
import { TriangleAlert, AlertCircle, CircleX } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

// Stat card component for this page
function StatCard({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: string | number;
  color?: string;
  suffix?: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-5 shadow-sm">
      <div className="text-sm font-medium text-muted-foreground mb-2">
        {label}
      </div>
      <div
        className="text-2xl font-semibold"
        style={{ color: color || "#111827" }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && (
          <span className="text-base font-medium ml-1">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function AnomalyList() {
  const router = useRouter();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const pageSize = isMobile ? 10 : 20;

  // Fetch anomalies for the table
  const { data: anomalies, loading, mutate } = useList<any>("anomalies", {
    pageSize: 1000,
    sort: "detectedAt",
    order: "desc",
  });

  // Stats
  const totalAnomalies = anomalies?.length ?? 0;
  const criticalCount = anomalies?.filter((a: any) => a.severity === "CRITICAL").length ?? 0;
  const highCount = anomalies?.filter((a: any) => a.severity === "HIGH").length ?? 0;

  // Severity color mapping to our Tag colors
  const severityTagColor = (severity: string): "success" | "warning" | "error" | "primary" | "default" => {
    const map: Record<string, "success" | "warning" | "error" | "primary" | "default"> = {
      LOW: "success",
      MEDIUM: "warning",
      HIGH: "error",
      CRITICAL: "primary",
    };
    return map[severity] || "default";
  };

  // Severity icon
  const severityIcon = (severity: string) => {
    switch (severity) {
      case "LOW":
        return <TriangleAlert className="size-3.5 mr-1 inline" />;
      case "MEDIUM":
        return <AlertCircle className="size-3.5 mr-1 inline" />;
      case "HIGH":
      case "CRITICAL":
        return <CircleX className="size-3.5 mr-1 inline" />;
      default:
        return null;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecord("anomalies", id);
      toast.showSuccess("Anomaly deleted");
      mutate();
    } catch {
      toast.showError("Failed to delete anomaly");
    }
  };

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (anomalies || []).slice(start, start + pageSize);
  }, [anomalies, page, pageSize]);

  const totalPages = Math.ceil((anomalies?.length || 0) / pageSize);

  // Table columns
  const columns: Column<any>[] = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      width: 100,
      render: (id: string) => (
        <code className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground">
          {id?.slice(0, 8)}...
        </code>
      ),
    },
    {
      key: "severity",
      title: "Severity",
      dataIndex: "severity",
      width: 130,
      render: (severity: string) => (
        <Tag color={severityTagColor(severity)}>
          {severityIcon(severity)}
          {severity}
        </Tag>
      ),
    },
    {
      key: "timeseries",
      title: "Time Series",
      dataIndex: "timeseries",
      width: 180,
      render: (ts: any) => ts?.name || "-",
    },
    {
      key: "value",
      title: "Value",
      dataIndex: "value",
      width: 120,
      align: "right",
      render: (val: number) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {Number(val || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "expectedRange",
      title: "Expected Range",
      width: 160,
      render: (_: any, record: any) => (
        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, color: "#6B7280" }}>
          {record.minExpected} - {record.maxExpected}
        </span>
      ),
    },
    {
      key: "detectionMethod",
      title: "Detection Method",
      dataIndex: "detectionMethod",
      width: 140,
      render: (method: string) => method ? <Tag>{method}</Tag> : "-",
    },
    {
      key: "detectedAt",
      title: "Detected At",
      dataIndex: "detectedAt",
      width: 150,
      render: (value: string) =>
        value
          ? new Date(value).toLocaleString("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
    },
    {
      key: "actions",
      title: "Actions",
      width: isMobile ? 100 : 140,
      render: (_: any, record: any) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/anomalies/show/${record.id}`)}
          >
            View
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Detected Anomalies"
        description="AI-powered anomaly detection for your time series data"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "AI & Anomaly Detection", href: "/ai/anomalies" },
          { label: "Detected Anomalies" },
        ]}
      />

      {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Anomalies" value={totalAnomalies} />
          <StatCard label="Critical" value={criticalCount} color="#B8860B" />
          <StatCard label="High" value={highCount} color="#EC4899" />
          <StatCard label="Detection Rate" value="98.5" suffix="%" />
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg shadow-sm border">
          <Table
            columns={columns}
            dataSource={paginatedData}
            rowKey="id"
            loading={loading}
            emptyText="No anomalies detected"
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border">
              <span className="text-sm text-muted-foreground">
                {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, anomalies?.length || 0)} of {anomalies?.length || 0} items
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
    </PageContainer>
  );
}
