"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { type Column, Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { deleteRecord, useList } from "@/lib/api";
import { useIsMobile } from "@/lib/responsive-utils";

/* ── stat card ──────────────────────────────────────────────────────────── */

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="bg-card rounded-lg shadow-sm border border px-5 py-4">
			<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
			<p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
		</div>
	);
}

// Row type for column render functions
interface DsRow {
	id: string;
	name: string;
	description?: string;
	isPublic?: boolean;
	storageFormat?: string;
	rowsCount?: number;
	_count?: { timeseries: number };
	createdAt: string;
}

function asRow(record: Record<string, unknown>): DsRow {
	return record as unknown as DsRow;
}

/* ── page ───────────────────────────────────────────────────────────────── */

export default function DatasetsList() {
	const router = useRouter();
	const isMobile = useIsMobile();
	const toast = useToast();

	const [page, setPage] = useState(1);
	const pageSize = isMobile ? 10 : 20;

	// Main data
	const { data, total, loading, mutate } = useList("datasets", {
		page,
		pageSize,
		sort: "createdAt",
		order: "desc",
	});

	// Stats data
	const { data: statsData } = useList("datasets", {
		pageSize: 1000,
	});

	const totalDatasets = statsData.length;
	const publicDatasets = statsData.filter((ds: Record<string, unknown>) => ds.isPublic).length;
	const importedDatasets = statsData.filter((ds: Record<string, unknown>) => ds.isImported).length;

	// Delete modal
	const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

	const handleDelete = async () => {
		if (!deleteTarget) return;
		try {
			await deleteRecord("datasets", String(deleteTarget.id));
			toast.showSuccess("Dataset deleted");
			mutate();
			setDeleteTarget(null);
		} catch {
			toast.showError("Failed to delete dataset");
		}
	};

	const totalPages = Math.ceil(total / pageSize);

	/* ── columns ────────────────────────────────────────────────────────── */

	const columns: Column<Record<string, unknown>>[] = useMemo(() => {
		const cols: Column<Record<string, unknown>>[] = [
			{
				key: "id",
				title: "ID",
				width: 100,
				render: (_v: unknown, record: Record<string, unknown>) => {
					const r = asRow(record);
					return (
						<code className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground data-text">
							{r.id.slice(0, 8)}...
						</code>
					);
				},
			},
			{
				key: "name",
				title: "Name",
				width: 200,
				render: (_v: unknown, record: Record<string, unknown>) => {
					const r = asRow(record);
					return (
						<div className="flex items-center gap-2">
							<span className="font-semibold">{r.name}</span>
							{r.isPublic && <Tag color="success">Public</Tag>}
						</div>
					);
				},
			},
			{
				key: "description",
				title: "Description",
				width: 250,
				render: (_v: unknown, record: Record<string, unknown>) => {
					const r = asRow(record);
					return (
						<span className="truncate block max-w-60 text-muted-foreground" title={r.description}>
							{r.description || "-"}
						</span>
					);
				},
			},
			{
				key: "storageFormat",
				title: "Storage",
				width: 130,
				render: (_v: unknown, record: Record<string, unknown>) => (
					<Tag color="info">{asRow(record).storageFormat || "TIMESERIES"}</Tag>
				),
			},
			{
				key: "rowsCount",
				title: "Rows",
				width: 100,
				align: "right",
				render: (_v: unknown, record: Record<string, unknown>) => {
					const r = asRow(record);
					return (
						<span className="data-text text-[13px] text-foreground">
							{(r.rowsCount ?? 0).toLocaleString()}
						</span>
					);
				},
			},
			{
				key: "timeseries",
				title: "Time Series",
				width: 110,
				align: "center",
				render: (_v: unknown, record: Record<string, unknown>) => {
					const r = asRow(record);
					const count = r._count?.timeseries ?? 0;
					return <Tag color={count > 0 ? "info" : "default"}>{count}</Tag>;
				},
			},
			{
				key: "createdAt",
				title: "Created",
				width: 140,
				render: (_v: unknown, record: Record<string, unknown>) =>
					new Date(asRow(record).createdAt).toISOString().split("T")[0],
			},
			{
				key: "actions",
				title: "Actions",
				width: isMobile ? 80 : 140,
				render: (_v: unknown, record: Record<string, unknown>) => {
					const r = asRow(record);
					return (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								aria-label="View"
								onClick={() => router.push(`/datasets/show/${r.id}`)}
							>
								<Eye className="size-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								aria-label="Edit"
								onClick={() => router.push(`/datasets/edit/${r.id}`)}
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
					);
				},
			},
		];
		return cols;
	}, [isMobile, router]);

	/* ── render ─────────────────────────────────────────────────────────── */

	return (
		<PageContainer>
			<PageHeader
				title="Datasets"
				description="Manage your time series datasets"
				breadcrumbs={[{ label: "Home", href: "/" }, { label: "Datasets" }]}
			/>

			{/* Statistics */}
			<div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
				<StatCard label="Total Datasets" value={totalDatasets} />
				<StatCard label="Public" value={publicDatasets} />
				<StatCard label="Imported" value={importedDatasets} />
			</div>

			{/* Table */}
			<div className="bg-card rounded-lg shadow-sm border border">
				<Table
					columns={columns}
					dataSource={data}
					rowKey="id"
					loading={loading}
					emptyText="No datasets found"
				/>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between mt-4 text-sm">
					<span className="text-muted-foreground">
						{(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of {total} dataset
						{total !== 1 ? "s" : ""}
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
				title="Delete Dataset"
				footer={
					<>
						<Button variant="secondary" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDelete}>
							Delete
						</Button>
					</>
				}
			>
				<p className="text-gray-600 dark:text-gray-300">
					Are you sure you want to delete this dataset? This action cannot be undone.
				</p>
			</Modal>
		</PageContainer>
	);
}
