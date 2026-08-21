"use client";

import { Database, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { type Column, Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { formatDecimal } from "@/lib/format";
import { useIsMobile } from "@/lib/responsive-utils";
import type { Dataset, TimeSeries } from "@/types/api";
import { authFetch } from "@/utils/auth";

/* ── stat display ───────────────────────────────────────────────────────── */

function StatDisplay({
	label,
	value,
	suffix,
	icon,
}: {
	label: string;
	value: string | number;
	suffix?: string;
	icon?: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-3 py-2">
			{icon && <span className="text-muted-foreground">{icon}</span>}
			<div>
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
					{label}
				</p>
				<p className="text-lg font-semibold text-foreground">
					{typeof value === "number" ? value.toLocaleString() : value}
					{suffix && (
						<span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>
					)}
				</p>
			</div>
		</div>
	);
}

/* ── storage format tag color mapping ──────────────────────────────────── */

const STORAGE_FORMAT_COLORS: Record<string, "info" | "success" | "warning"> = {
	TIMESERIES: "info",
	INFLUXDB: "success",
	CSV: "warning",
};

/* ── page ───────────────────────────────────────────────────────────────── */

interface DatasetWithStats extends Dataset {
	datapointsCount?: number;
	sizeMB?: number;
	lastImport?: string;
	storageLocation?: string;
}

export default function DatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const router = useRouter();
	const isMobile = useIsMobile();
	const toast = useToast();

	const [dataset, setDataset] = useState<DatasetWithStats | null>(null);
	const [timeseries, setTimeseries] = useState<TimeSeries[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showDeleteModal, setShowDeleteModal] = useState(false);

	const fetchDataset = useCallback(async () => {
		if (!id) {
			setError("Dataset ID is required");
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			const response = await authFetch(`/api/datasets/${id}`);
			if (!response.ok) {
				throw new Error("Failed to fetch dataset");
			}
			const data = await response.json();
			const payload = data.data || data;
			setDataset(payload);
			// GET /api/datasets/:id already embeds the owned timeseries rows
			// (datasetService.getDataset includes them with datapoint counts) —
			// the old separate /:id/timeseries fetch hit a route that never
			// existed and silently left this table empty forever.
			setTimeseries(payload.timeseries ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		fetchDataset();
	}, [fetchDataset]);

	const handleDelete = async () => {
		try {
			const response = await authFetch(`/api/datasets/${id}`, { method: "DELETE" });
			if (!response.ok) {
				throw new Error("Failed to delete dataset");
			}
			toast.showSuccess("Dataset deleted");
			router.push("/datasets");
		} catch {
			toast.showError("Failed to delete dataset");
		}
	};

	/* ── loading / error states ─────────────────────────────────────────── */

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 lg:p-6 flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
			</div>
		);
	}

	if (error || !dataset) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 lg:p-6">
				<div className="mx-auto max-w-[1440px]">
					<div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3">
						{error || "Dataset not found"}
					</div>
				</div>
			</div>
		);
	}

	/* ── timeseries table columns ───────────────────────────────────────── */

	const tsColumns: Column<TimeSeries>[] = [
		{
			key: "name",
			title: "Name",
			render: (_v: unknown, record: TimeSeries) => (
				<div className="flex items-center gap-2">
					<Database className="size-4" />
					<span className="font-semibold text-foreground">{record.name}</span>
				</div>
			),
		},
		{
			key: "slug",
			title: "Slug",
			render: (_v: unknown, record: TimeSeries) => (
				<span className="text-muted-foreground text-sm">
					{String((record as unknown as Record<string, unknown>).slug || "-")}
				</span>
			),
		},
		{
			key: "unit",
			title: "Unit",
			render: (_v: unknown, record: TimeSeries) => (
				<span className="text-muted-foreground">
					{String((record as unknown as Record<string, unknown>).unit || "-")}
				</span>
			),
		},
		{
			key: "datapoints",
			title: "Data Points",
			render: (_v: unknown, record: TimeSeries) => (
				<span className="data-text text-[13px] text-foreground">
					{Number(
						((record as unknown as Record<string, unknown>)._count as Record<string, unknown>)
							?.dataPoints || 0,
					)}
				</span>
			),
		},
		{
			key: "createdAt",
			title: "Created",
			render: (_v: unknown, record: TimeSeries) => (
				<span className="text-sm text-muted-foreground">
					{new Date(record.createdAt).toLocaleDateString()}
				</span>
			),
		},
	];

	/* ── render ─────────────────────────────────────────────────────────── */

	const tsCount = dataset._count?.timeseries || timeseries.length || 0;

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 lg:p-6">
			<div className="mx-auto max-w-[1440px]">
				{/* Header */}
				<div className="mb-6">
					<nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
						<a href="/" className="hover:text-gray-700 dark:hover:text-gray-200">
							Home
						</a>
						<span>/</span>
						<a href="/datasets" className="hover:text-gray-700 dark:hover:text-gray-200">
							Datasets
						</a>
						<span>/</span>
						<span className="text-foreground font-medium">{dataset.name}</span>
					</nav>

					<div className="flex items-start justify-between gap-4">
						<div>
							<h1 className="text-2xl font-semibold text-foreground tracking-tight">
								{dataset.name}
							</h1>
							{dataset.description && (
								<p className="mt-1 text-sm text-muted-foreground">{dataset.description}</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							{/* No Edit/Export actions: neither page nor backend endpoint
							 * exists (PATCH /:id is backend-only; export has neither).
							 * Recorded in TECH-DEBT — do not link routes that 404. */}
							<Button
								variant="danger"
								size="sm"
								icon={<Trash2 className="size-3.5" />}
								onClick={() => setShowDeleteModal(true)}
							>
								Delete
							</Button>
						</div>
					</div>
				</div>

				{/* Content grid */}
				<div className={`grid gap-6 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
					{/* Dataset Summary */}
					<Card className={isMobile ? "" : "col-span-1"}>
						<CardHeader>
							<CardTitle>Dataset Summary</CardTitle>
						</CardHeader>
						<CardBody>
							<div className="space-y-4">
								{/* Key-value pairs replacing Descriptions */}
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Storage Format</span>
										<Tag color={STORAGE_FORMAT_COLORS[dataset.storageFormat] || "default"}>
											{dataset.storageFormat}
										</Tag>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Visibility</span>
										<Tag color={dataset.isPublic ? "success" : "warning"}>
											{dataset.isPublic ? "Public" : "Private"}
										</Tag>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Import Status</span>
										<Tag color={dataset.isImported ? "success" : "warning"}>
											{dataset.isImported ? "Imported" : "Pending"}
										</Tag>
									</div>
								</div>

								<div className="border-t border pt-4 space-y-3">
									<StatDisplay
										label="Time Series"
										value={tsCount}
										suffix="series"
										icon={<Database className="size-4" />}
									/>
									{dataset.datapointsCount !== undefined && (
										<StatDisplay label="Total Data Points" value={dataset.datapointsCount} />
									)}
									{dataset.sizeMB !== undefined && (
										<StatDisplay
											label="Storage Size"
											value={formatDecimal(dataset.sizeMB, 2)}
											suffix="MB"
										/>
									)}
								</div>
							</div>
						</CardBody>
					</Card>

					{/* Description card */}
					{dataset.description && (
						<Card className={isMobile ? "" : "col-span-2"}>
							<CardHeader>
								<CardTitle>Description</CardTitle>
							</CardHeader>
							<CardBody>
								<p className="text-foreground">{dataset.description}</p>
								<div className="mt-4 space-y-1 text-sm text-muted-foreground">
									<p>Created: {new Date(dataset.createdAt).toLocaleString()}</p>
									<p>Updated: {new Date(dataset.updatedAt).toLocaleString()}</p>
								</div>
							</CardBody>
						</Card>
					)}
				</div>

				{/* Time Series List */}
				<div className="mt-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Associated Time Series</CardTitle>
								<Button
									size="sm"
									icon={<Plus className="size-3.5" />}
									onClick={() => router.push(`/timeseries/create?dataset=${dataset.id}`)}
								>
									Add Series
								</Button>
							</div>
						</CardHeader>
						<CardBody className="p-0">
							{timeseries.length === 0 ? (
								<div className="text-center py-12">
									<p className="text-muted-foreground">
										No time series associated with this dataset.
									</p>
								</div>
							) : (
								<Table
									columns={tsColumns}
									dataSource={timeseries}
									rowKey={(record: TimeSeries) => record.id}
									onRow={(record: TimeSeries) => ({
										// No /timeseries/show/[id] page exists — edit is the
										// only per-series destination.
										onClick: () => router.push(`/timeseries/edit/${record.id}`),
										className: "cursor-pointer",
									})}
								/>
							)}
						</CardBody>
					</Card>
				</div>

				{/* Statistics Card */}
				{dataset.datapointsCount !== undefined && dataset.datapointsCount > 0 && (
					<div className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle>Statistics</CardTitle>
							</CardHeader>
							<CardBody>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<StatDisplay label="Data Points" value={dataset.datapointsCount} />
									<StatDisplay label="Time Series" value={`${tsCount} / 100`} />
									<StatDisplay
										label="Storage Used"
										value={`${formatDecimal(dataset.sizeMB || 0, 2)} MB`}
									/>
									<StatDisplay
										label="Last Import"
										value={dataset.lastImport ? "Recently" : "Never"}
									/>
								</div>
							</CardBody>
						</Card>
					</div>
				)}

				{/* Delete confirmation modal */}
				<Modal
					open={showDeleteModal}
					onClose={() => setShowDeleteModal(false)}
					title="Delete Dataset"
					footer={
						<>
							<Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
								Cancel
							</Button>
							<Button variant="danger" onClick={handleDelete}>
								Delete
							</Button>
						</>
					}
				>
					<p className="text-gray-600 dark:text-gray-300">
						Are you sure you want to delete this dataset? This action cannot be undone and will
						remove all associated time series and data points.
					</p>
				</Modal>
			</div>
		</div>
	);
}
