"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useList, deleteRecord } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Table, type Column } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useIsMobile } from "@/lib/responsive-utils";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

/* ── stat card ──────────────────────────────────────────────────────────── */

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border px-5 py-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────────────── */

export default function TimeseriesList() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const pageSize = isMobile ? 10 : 20;

  // Main data
  const { data, total, loading, mutate } = useList<any>("timeseries", {
    page,
    pageSize,
    sort: "createdAt",
    order: "desc",
  });

  // Stats data
  const { data: statsData } = useList<any>("timeseries", {
    pageSize: 1000,
  });

  const totalTimeseries = statsData.length;
  const totalDataPoints = statsData.reduce(
    (sum: number, ts: any) => sum + (ts._count?.dataPoints || 0),
    0,
  );
  const totalAnomalies = statsData.reduce(
    (sum: number, ts: any) => sum + (ts._count?.anomalies || 0),
    0,
  );

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRecord("timeseries", deleteTarget.id);
      toast.showSuccess("Time series deleted");
      mutate();
      setDeleteTarget(null);
    } catch {
      toast.showError("Failed to delete time series");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  /* ── columns ────────────────────────────────────────────────────────── */

  const columns: Column<any>[] = useMemo(() => {
    const cols: Column<any>[] = [
      {
        key: "id",
        title: "ID",
        width: 100,
        render: (_v: any, record: any) => (
          <code className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground data-text">
            {record.id.slice(0, 8)}...
          </code>
        ),
      },
      {
        key: "name",
        title: "Name",
        width: 200,
        render: (_v: any, record: any) => (
          <div className="flex items-center gap-2">
            <span
              className="font-semibold"
              style={{ color: record.colorHex || undefined }}
            >
              {record.name}
            </span>
            {record.isAnomalyDetectionEnabled && (
              <Tag color="warning">Anomaly Detection</Tag>
            )}
          </div>
        ),
      },
      {
        key: "slug",
        title: "Slug",
        width: 160,
        render: (_v: any, record: any) => (
          <span className="truncate block max-w-[160px]" title={record.slug}>
            {record.slug}
          </span>
        ),
      },
      {
        key: "unit",
        title: "Unit",
        width: 80,
        render: (_v: any, record: any) => record.unit || "-",
      },
      {
        key: "dataset",
        title: "Dataset",
        width: 180,
        render: (_v: any, record: any) => (
          <span className="truncate block max-w-[180px]" title={record.dataset?.name}>
            {record.dataset?.name || "-"}
          </span>
        ),
      },
      {
        key: "dataPoints",
        title: "Data Points",
        width: 120,
        align: "right",
        render: (_v: any, record: any) => (
          <span className="data-text text-[13px] text-foreground">
            {(record._count?.dataPoints ?? 0).toLocaleString()}
          </span>
        ),
      },
      {
        key: "anomalies",
        title: "Anomalies",
        width: 100,
        align: "center",
        render: (_v: any, record: any) => {
          const count = record._count?.anomalies ?? 0;
          return <Tag color={count > 0 ? "error" : "success"}>{count}</Tag>;
        },
      },
      {
        key: "createdAt",
        title: "Created",
        width: 140,
        render: (_v: any, record: any) =>
          new Date(record.createdAt).toISOString().split("T")[0],
      },
      {
        key: "actions",
        title: "Actions",
        width: isMobile ? 80 : 140,
        render: (_v: any, record: any) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="View"
              onClick={() => router.push(`/timeseries/show/${record.id}`)}
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit"
              onClick={() => router.push(`/timeseries/edit/${record.id}`)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete"
              onClick={() => setDeleteTarget(record)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ];
    return cols;
  }, [isMobile, router]);

  /* ── render ─────────────────────────────────────────────────────────── */

  return (
    <PageContainer>
      <PageHeader
        title="Time Series"
        description="Manage your time series data with real-time analytics"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Time Series" },
        ]}
        actions={
          <Button
            icon={<Plus className="size-3.5" />}
            onClick={() => router.push("/timeseries/create")}
          >
            {!isMobile && "Create Time Series"}
          </Button>
        }
      />

      {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Time Series" value={totalTimeseries} />
          <StatCard label="Data Points" value={totalDataPoints} />
          <StatCard label="Anomalies" value={totalAnomalies} />
          <StatCard label="Storage" value="-" />
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg shadow-sm border border">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            emptyText="No time series found"
          />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">
              {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Time Series"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </>
          }
        >
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to delete this time series? This action cannot be undone.
          </p>
        </Modal>
    </PageContainer>
  );
}
