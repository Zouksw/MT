"use client";

import { Clock, Download, Plus, TrendingUp, TriangleAlert, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { type Column, Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { deleteRecord, useList } from "@/lib/api";
import { useIsMobile } from "@/lib/responsive-utils";

// Forecast record shape returned from the API
interface ForecastRecord {
	id: string;
	modelId: string;
	timeseriesId: string;
	timestamp: string;
	predictedValue: number | { toNumber(): number };
	lowerBound?: number | { toNumber(): number } | null;
	upperBound?: number | { toNumber(): number } | null;
	confidence: number | { toNumber(): number };
	anomalyProbability?: number | { toNumber(): number } | null;
	isAnomaly: boolean;
	createdAt: string;
	model?: { algorithm: string };
	timeseries?: { name: string; unit?: string };
}

// Stat card component
function StatCard({
	label,
	value,
	icon,
	variant,
	loading,
}: {
	label: string;
	value: number | string;
	icon?: React.ReactNode;
	variant?: "primary" | "success" | "warning" | "default";
	loading?: boolean;
}) {
	const variantStyles: Record<string, string> = {
		primary: "border-primary/20 dark:border-primary/20 bg-primary/5 dark:bg-primary/10",
		success: "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10",
		warning: "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10",
		default: "",
	};

	return (
		<div className={`rounded-lg p-5 shadow-sm border ${variant ? variantStyles[variant] : ""}`}>
			<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
				{icon}
				{label}
			</div>
			{loading ? (
				<div className="h-8 w-16 bg-muted rounded animate-pulse" />
			) : (
				<div className="text-2xl font-semibold text-foreground">
					{typeof value === "number" ? value.toLocaleString() : value}
				</div>
			)}
		</div>
	);
}

export default function ForecastList() {
	const router = useRouter();
	const toast = useToast();
	const isMobile = useIsMobile();
	const [page, setPage] = useState(1);
	const pageSize = isMobile ? 10 : 20;

	// Fetch forecasts for the table
	const {
		data: forecasts,
		loading,
		mutate,
	} = useList<ForecastRecord>("forecasts", {
		pageSize: 1000,
		sort: "timestamp",
		order: "desc",
	});

	// Stats
	const totalForecasts = forecasts?.length ?? 0;
	const uniqueModels = new Set((forecasts || []).map((f) => f.modelId)).size;
	const uniqueTimeseries = new Set((forecasts || []).map((f) => f.timeseriesId)).size;
	const anomalyCount = (forecasts || []).filter((f) => f.isAnomaly).length ?? 0;

	// Pagination
	const paginatedData = useMemo(() => {
		const start = (page - 1) * pageSize;
		return (forecasts || []).slice(start, start + pageSize);
	}, [forecasts, page, pageSize]);

	const totalPages = Math.ceil((forecasts?.length || 0) / pageSize);

	// Helper to get numeric value from possibly-decimal object
	const toNum = (value: number | { toNumber(): number } | null | undefined): number => {
		if (typeof value === "object" && value !== null && typeof value.toNumber === "function") {
			return value.toNumber();
		}
		return Number(value);
	};

	// Model algorithm tag color
	const algoTagColor = (
		algo: string,
	): "primary" | "info" | "success" | "warning" | "error" | "default" => {
		const map: Record<string, "primary" | "info" | "success" | "warning" | "error" | "default"> = {
			ARIMA: "info",
			PROPHET: "primary",
			LSTM: "success",
			TRANSFORMER: "warning",
			ENSEMBLE: "error",
		};
		return map[algo] || "default";
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteRecord("forecasts", id);
			toast.showSuccess("Forecast deleted");
			mutate();
		} catch {
			toast.showError("Failed to delete forecast");
		}
	};

	// Handle export to CSV
	const handleExport = () => {
		const dataSource = forecasts || [];
		if (dataSource.length === 0) return;

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

		const csvRows = [
			headers.join(","),
			...dataSource.map((record: ForecastRecord) => {
				const timeseriesName = record.timeseries?.name || "-";
				const algorithm = record.model?.algorithm || "-";
				const predictedValue = toNum(record.predictedValue);
				const unit = record.timeseries?.unit || "";
				const confidence = toNum(record.confidence);
				const lowerBound = toNum(record.lowerBound);
				const upperBound = toNum(record.upperBound);
				const anomalyProbability = toNum(record.anomalyProbability);

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
		URL.revokeObjectURL(url);
	};

	// Table columns
	const columns: Column<ForecastRecord>[] = [
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
			key: "timestamp",
			title: "Forecast Time",
			dataIndex: "timestamp",
			width: 160,
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
			key: "timeseries",
			title: "Time Series",
			dataIndex: "timeseries",
			width: 180,
			render: (ts: ForecastRecord["timeseries"]) => (
				<span className="font-semibold text-foreground">{ts?.name || "-"}</span>
			),
		},
		{
			key: "model",
			title: "Model",
			dataIndex: "model",
			width: 140,
			render: (model: ForecastRecord["model"]) => {
				const algo = model?.algorithm;
				return algo ? <Tag color={algoTagColor(algo)}>{algo}</Tag> : "-";
			},
		},
		{
			key: "predictedValue",
			title: "Predicted Value",
			dataIndex: "predictedValue",
			width: 140,
			align: "right",
			render: (value: ForecastRecord["predictedValue"], record: ForecastRecord) => {
				const numValue = toNum(value);
				const unit = record.timeseries?.unit || "";
				return (
					<span
						className="text-[13px] text-foreground"
						style={{ fontVariantNumeric: "tabular-nums" }}
					>
						{numValue.toFixed(2)} {unit}
					</span>
				);
			},
		},
		{
			key: "confidence",
			title: "Confidence",
			dataIndex: "confidence",
			width: 110,
			align: "center",
			render: (value: ForecastRecord["confidence"]) => {
				const numValue = toNum(value);
				const percentage = (numValue * 100).toFixed(0);
				const color: "success" | "info" | "warning" =
					numValue >= 0.9 ? "success" : numValue >= 0.7 ? "info" : "warning";
				return <Tag color={color}>{percentage}%</Tag>;
			},
		},
		{
			key: "range",
			title: "Range",
			width: 160,
			align: "right",
			render: (_value: unknown, record: ForecastRecord) => {
				const lower = toNum(record.lowerBound);
				const upper = toNum(record.upperBound);
				const unit = record.timeseries?.unit || "";

				if (!lower || !upper) {
					return <span className="text-muted-foreground">-</span>;
				}

				return (
					<span className="text-xs text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
						[{lower.toFixed(2)}, {upper.toFixed(2)}] {unit}
					</span>
				);
			},
		},
		{
			key: "isAnomaly",
			title: "Anomaly",
			dataIndex: "isAnomaly",
			width: 100,
			align: "center",
			render: (isAnomaly: boolean, record: ForecastRecord) => {
				const probability = toNum(record.anomalyProbability);

				if (isAnomaly) {
					return (
						<div>
							<span className="text-sm font-medium text-red-600 dark:text-red-400">Yes</span>
							{probability > 0 && (
								<div
									className="text-[11px] text-muted-foreground"
									style={{ fontVariantNumeric: "tabular-nums" }}
								>
									{(probability * 100).toFixed(0)}%
								</div>
							)}
						</div>
					);
				}
				return <span className="text-sm font-medium text-green-600 dark:text-green-400">No</span>;
			},
		},
		{
			key: "createdAt",
			title: "Created At",
			dataIndex: "createdAt",
			width: 140,
			render: (value: string) =>
				value
					? new Date(value).toLocaleDateString("en-US", {
							year: "numeric",
							month: "2-digit",
							day: "2-digit",
						})
					: "-",
		},
		{
			key: "actions",
			title: "Actions",
			width: isMobile ? 100 : 140,
			render: (_value: unknown, record: ForecastRecord) => (
				<div className="flex gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => router.push(`/forecasts/show/${record.id}`)}
					>
						View
					</Button>
					<Button variant="danger" size="sm" onClick={() => handleDelete(record.id)}>
						Delete
					</Button>
				</div>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title="Forecasts"
				description="AI-powered time series forecasting and predictions"
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "AI & Anomaly Detection", href: "/ai" },
					{ label: "Forecasts" },
				]}
				actions={
					<>
						<Button variant="secondary" size="sm" onClick={handleExport}>
							<Download className="size-4 mr-1.5" />
							{!isMobile && "Export"}
						</Button>
						<Button variant="primary" size="md" onClick={() => router.push("/forecasts/create")}>
							<Plus className="size-4 mr-1.5" />
							{!isMobile && "Generate Forecast"}
						</Button>
					</>
				}
			/>

			{/* Statistics Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<StatCard
					label="Total Forecasts"
					value={totalForecasts}
					variant="primary"
					loading={loading}
					icon={<TrendingUp className="size-4" />}
				/>
				<StatCard
					label="Active Models"
					value={uniqueModels}
					variant="success"
					loading={loading}
					icon={<Zap className="size-4" />}
				/>
				<StatCard
					label="Time Series"
					value={uniqueTimeseries}
					loading={loading}
					icon={<Clock className="size-4" />}
				/>
				<StatCard
					label="Anomalies Detected"
					value={anomalyCount}
					variant={anomalyCount > 0 ? "warning" : "default"}
					loading={loading}
					icon={<TriangleAlert className="size-4" />}
				/>
			</div>

			{/* Table */}
			<div className="bg-card rounded-lg shadow-sm border">
				<Table
					columns={columns}
					dataSource={paginatedData}
					rowKey="id"
					loading={loading}
					emptyText="No forecasts generated yet"
				/>

				{/* Pagination */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between px-6 py-4 border-t border">
						<span className="text-sm text-muted-foreground">
							{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, forecasts?.length || 0)} of{" "}
							{forecasts?.length || 0} items
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
