"use client";

import { AlertCircle, CircleX, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { type Column, Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { deleteRecord, useList } from "@/lib/api";
import { formatDecimal } from "@/lib/format";
import { useIsMobile } from "@/lib/responsive-utils";

export default function AnomalyList() {
	const router = useRouter();
	const toast = useToast();
	const isMobile = useIsMobile();
	const [page, setPage] = useState(1);
	const pageSize = isMobile ? 10 : 20;

	// Fetch anomalies for the table
	const {
		data: anomalies,
		loading,
		mutate,
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
	} = useList<any>("anomalies", {
		pageSize: 1000,
		sort: "detectedAt",
		order: "desc",
	});

	// Stats
	const totalAnomalies = anomalies?.length ?? 0;
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
	const criticalCount = anomalies?.filter((a: any) => a.severity === "CRITICAL").length ?? 0;
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
	const highCount = anomalies?.filter((a: any) => a.severity === "HIGH").length ?? 0;

	// Severity color mapping to our Tag colors
	const severityTagColor = (
		severity: string,
	): "success" | "warning" | "error" | "primary" | "default" => {
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
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
	const columns: Column<any>[] = [
		{
			key: "id",
			title: "ID",
			dataIndex: "id",
			width: 100,
			render: (id: unknown) => (
				<code className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground">
					{String(id)?.slice(0, 8)}...
				</code>
			),
		},
		{
			key: "severity",
			title: "Severity",
			dataIndex: "severity",
			width: 130,
			render: (severity: unknown) => {
				const s = severity as string;
				return (
					<Tag color={severityTagColor(s)}>
						{severityIcon(s)}
						{s}
					</Tag>
				);
			},
		},
		{
			key: "timeseries",
			title: "Time Series",
			dataIndex: "timeseries",
			width: 180,
			render: (ts: unknown) => ((ts as Record<string, unknown>)?.name as string) || "-",
		},
		{
			key: "value",
			title: "Value",
			dataIndex: "value",
			width: 120,
			align: "right",
			render: (val: unknown) => (
				<span style={{ fontVariantNumeric: "tabular-nums" }}>
					{formatDecimal(Number(val || 0), 2)}
				</span>
			),
		},
		{
			key: "expectedRange",
			title: "Expected Range",
			width: 160,
			render: (_v: unknown, record: unknown) => {
				const r = record as Record<string, unknown>;
				return (
					<span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, color: "#6B7280" }}>
						{String(r.minExpected)} - {String(r.maxExpected)}
					</span>
				);
			},
		},
		{
			key: "detectionMethod",
			title: "Detection Method",
			dataIndex: "detectionMethod",
			width: 140,
			render: (method: unknown) => (method ? <Tag>{method as string}</Tag> : "-"),
		},
		{
			key: "detectedAt",
			title: "Detected At",
			dataIndex: "detectedAt",
			width: 150,
			render: (value: unknown) =>
				value
					? new Date(value as string).toLocaleString("en-US", {
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
			render: (_v: unknown, record: unknown) => {
				const r = record as Record<string, unknown>;
				return (
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => router.push(`/anomalies/show/${r.id}`)}
						>
							View
						</Button>
						<Button variant="danger" size="sm" onClick={() => handleDelete(r.id as string)}>
							Delete
						</Button>
					</div>
				);
			},
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
				<StatCard title="Total Anomalies" value={totalAnomalies} />
				<StatCard title="Critical" value={criticalCount} variant="primary" />
				<StatCard title="High" value={highCount} variant="warning" />
				<StatCard title="Detection Rate" value="98.5" suffix="%" />
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
							{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, anomalies?.length || 0)} of{" "}
							{anomalies?.length || 0} items
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
