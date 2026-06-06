"use client";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import "dayjs/locale/zh-cn";

import { Check, RefreshCw, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { type Column, Table } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useIsMobile } from "@/lib/responsive-utils";
import { authFetch } from "@/utils/auth";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

interface AlertItem {
	id: string;
	type: "ANOMALY" | "FORECAST_READY" | "SYSTEM";
	severity: "INFO" | "WARNING" | "ERROR";
	message: string;
	isRead: boolean;
	createdAt: string;
	timeseries?: {
		id: string;
		name: string;
		dataset: {
			name: string;
		};
	};
}

interface AlertStats {
	total: number;
	unread: number;
	bySeverity: Record<string, number>;
	byType: Record<string, number>;
}

export default function AlertList() {
	const _router = useRouter();
	const toast = useToast();
	const isMobile = useIsMobile();
	const [alerts, setAlerts] = useState<AlertItem[]>([]);
	const [stats, setStats] = useState<AlertStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("all");
	const [deleteTarget, setDeleteTarget] = useState<AlertItem | null>(null);
	const [page, setPage] = useState(1);
	const pageSize = isMobile ? 10 : 20;
	const [filters, setFilters] = useState({
		type: undefined as string | undefined,
		severity: undefined as string | undefined,
		unreadOnly: false,
	});

	const fetchAlerts = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (filters.unreadOnly) params.append("unreadOnly", "true");
			if (filters.type) params.append("type", filters.type);
			if (filters.severity) params.append("severity", filters.severity);

			const response = await authFetch(`/api/alerts?${params}`);
			if (!response.ok) throw new Error("Failed to fetch alerts");
			const data = await response.json();
			setAlerts(data.alerts || []);
		} catch {
			toast.showError("Failed to load alerts");
		} finally {
			setLoading(false);
		}
	}, [filters, toast]);

	const fetchStats = useCallback(async () => {
		try {
			const response = await authFetch("/api/alerts/stats");
			if (!response.ok) throw new Error("Failed to fetch stats");
			const result = await response.json();
			setStats(result.data || result);
		} catch {
			// Stats are optional, don't show error to user
		}
	}, []);

	useEffect(() => {
		fetchAlerts();
		fetchStats();
	}, [fetchAlerts, fetchStats]);

	const handleMarkAsRead = async (alertId: string) => {
		try {
			await authFetch(`/api/alerts/${alertId}/read`, { method: "PATCH" });
			fetchAlerts();
			fetchStats();
			toast.showSuccess("Marked as read");
		} catch {
			toast.showError("Failed to mark as read");
		}
	};

	const handleMarkAllAsRead = async () => {
		try {
			await authFetch("/api/alerts/read-all", { method: "PATCH" });
			fetchAlerts();
			fetchStats();
			toast.showSuccess("All alerts marked as read");
		} catch {
			toast.showError("Failed to mark all as read");
		}
	};

	const handleDeleteAlert = async (alertId: string) => {
		try {
			await authFetch(`/api/alerts/${alertId}`, { method: "DELETE" });
			fetchAlerts();
			fetchStats();
			toast.showSuccess("Alert deleted");
		} catch {
			toast.showError("Failed to delete alert");
		} finally {
			setDeleteTarget(null);
		}
	};

	const getAlertSeverityTagColor = (
		severity: string,
	): "default" | "primary" | "success" | "warning" | "error" | "info" => {
		const map: Record<string, "default" | "primary" | "success" | "warning" | "error" | "info"> = {
			INFO: "info",
			WARNING: "warning",
			ERROR: "error",
		};
		return map[severity] || "default";
	};

	const getAlertTypeTagColor = (
		type: string,
	): "default" | "primary" | "success" | "warning" | "error" | "info" => {
		const map: Record<string, "default" | "primary" | "success" | "warning" | "error" | "info"> = {
			ANOMALY: "error",
			FORECAST_READY: "info",
			SYSTEM: "success",
		};
		return map[type] || "default";
	};

	const getAlertIcon = (severity: string) => {
		if (severity === "ERROR") return <span className="text-red-500">&#10060;</span>;
		if (severity === "WARNING") return <span className="text-amber-500">&#9888;</span>;
		return <span className="text-amber-600">&#8505;</span>;
	};

	const filteredAlerts = alerts.filter((alert) => {
		if (activeTab === "unread") return !alert.isRead;
		if (activeTab === "anomaly") return alert.type === "ANOMALY";
		if (activeTab === "forecast") return alert.type === "FORECAST_READY";
		if (activeTab === "system") return alert.type === "SYSTEM";
		return true;
	});

	const totalPages = Math.ceil(filteredAlerts.length / pageSize);
	const paginatedAlerts = filteredAlerts.slice((page - 1) * pageSize, page * pageSize);

	// Reset page when filters or tab change
	useEffect(() => {
		setPage(1);
	}, []);

	const columns: Column<AlertItem>[] = [
		{
			key: "status",
			title: "Status",
			dataIndex: "isRead",
			width: 80,
			align: "center",
			render: (_value: unknown, record: AlertItem) => (
				<span title={record.isRead ? "Read" : "New"}>
					{record.isRead ? (
						<span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
					) : (
						<span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
					)}
				</span>
			),
		},
		{
			key: "type",
			title: "Type",
			dataIndex: "type",
			width: 160,
			render: (type: unknown) => {
				const t = String(type);
				const icons: Record<string, string> = {
					ANOMALY: "\u{1F6A8}",
					FORECAST_READY: "\u{1F4C8}",
					SYSTEM: "⚙️",
				};
				return (
					<Tag color={getAlertTypeTagColor(t)}>
						{icons[t] || ""} {t.replace(/_/g, " ")}
					</Tag>
				);
			},
		},
		{
			key: "severity",
			title: "Severity",
			dataIndex: "severity",
			width: 110,
			align: "center",
			render: (severity: unknown) => {
				const s = String(severity);
				return <Tag color={getAlertSeverityTagColor(s)}>{s}</Tag>;
			},
		},
		{
			key: "message",
			title: "Message",
			dataIndex: "message",
			render: (message: unknown, record: AlertItem) => (
				<div className="flex items-center gap-2">
					{getAlertIcon(record.severity)}
					<span className="text-body truncate">{String(message)}</span>
				</div>
			),
		},
		{
			key: "timeseries",
			title: "Time Series",
			dataIndex: "timeseries",
			width: 180,
			render: (timeseries?: { name: string; dataset: { name: string } }) =>
				timeseries ? (
					<div>
						<div className="text-[13px] text-foreground">{timeseries.name}</div>
						<div className="text-[11px] text-muted-foreground">{timeseries.dataset.name}</div>
					</div>
				) : (
					"-"
				),
		},
		{
			key: "createdAt",
			title: "Time",
			dataIndex: "createdAt",
			width: 140,
			render: (date: unknown) => {
				const d = String(date);
				return (
					<span
						title={dayjs(d).format("YYYY-MM-DD HH:mm:ss")}
						className="text-body-sm text-muted-foreground"
					>
						{dayjs(d).fromNow()}
					</span>
				);
			},
		},
		{
			key: "actions",
			title: "Actions",
			width: isMobile ? 80 : 180,
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			render: (_value: any, record: AlertItem) => (
				<div className="flex items-center gap-2">
					{!record.isRead && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => handleMarkAsRead(record.id)}
							aria-label="Mark as read"
						>
							{!isMobile && "Mark Read"}
							{isMobile && <Check className="size-4" />}
						</Button>
					)}
					<Button
						size="sm"
						variant="danger"
						onClick={() => setDeleteTarget(record)}
						aria-label="Delete alert"
					>
						{!isMobile && "Delete"}
						{isMobile && <Trash2 className="size-4" />}
					</Button>
				</div>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title="Alerts & Notifications"
				description="View and manage system alerts, anomalies, and notifications"
				breadcrumbs={[{ label: "Home", href: "/" }, { label: "Alerts & Notifications" }]}
				actions={
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							onClick={() => {
								fetchAlerts();
								fetchStats();
							}}
						>
							<RefreshCw className="size-4 mr-1.5" />
							{!isMobile && "Refresh"}
						</Button>
						{stats && stats.unread > 0 && (
							<Button onClick={handleMarkAllAsRead}>
								<Check className="size-4 mr-1.5" />
								{!isMobile && "Mark All Read"}
							</Button>
						)}
					</div>
				}
			/>

			{/* Statistics */}
			{stats && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<Card>
						<CardBody>
							<p className="text-sm text-muted-foreground">Total Alerts</p>
							<p className="text-2xl font-semibold text-foreground mt-1">{stats.total}</p>
						</CardBody>
					</Card>
					<Card>
						<CardBody>
							<p className="text-sm text-muted-foreground">Unread</p>
							<p className="text-2xl font-semibold text-foreground mt-1">{stats.unread}</p>
						</CardBody>
					</Card>
					<Card>
						<CardBody>
							<p className="text-sm text-muted-foreground">Errors</p>
							<p className="text-2xl font-semibold text-foreground mt-1">
								{stats.bySeverity.ERROR || 0}
							</p>
						</CardBody>
					</Card>
					<Card>
						<CardBody>
							<p className="text-sm text-muted-foreground">Warnings</p>
							<p className="text-2xl font-semibold text-foreground mt-1">
								{stats.bySeverity.WARNING || 0}
							</p>
						</CardBody>
					</Card>
				</div>
			)}

			{/* Filters */}
			<Card className="mb-4">
				<CardBody>
					<div className="flex flex-wrap items-center gap-3">
						<span className="font-semibold text-foreground">Filter by:</span>
						<Select
							placeholder="Type"
							value={filters.type}
							onChange={(value) => setFilters({ ...filters, type: value || undefined })}
							options={[
								{ value: "ANOMALY", label: "Anomaly" },
								{ value: "FORECAST_READY", label: "Forecast Ready" },
								{ value: "SYSTEM", label: "System" },
							]}
						/>
						<Select
							placeholder="Severity"
							value={filters.severity}
							onChange={(value) => setFilters({ ...filters, severity: value || undefined })}
							options={[
								{ value: "INFO", label: "Info" },
								{ value: "WARNING", label: "Warning" },
								{ value: "ERROR", label: "Error" },
							]}
						/>
						<Select
							placeholder="Status"
							value={filters.unreadOnly ? "unread" : undefined}
							onChange={(value) => setFilters({ ...filters, unreadOnly: value === "unread" })}
							options={[{ value: "unread", label: "Unread Only" }]}
						/>
						{(filters.type || filters.severity || filters.unreadOnly) && (
							<Button
								variant="danger"
								size="sm"
								onClick={() =>
									setFilters({ type: undefined, severity: undefined, unreadOnly: false })
								}
							>
								Clear Filters
							</Button>
						)}
					</div>
				</CardBody>
			</Card>

			{/* Alerts Table */}
			<Card>
				<Tabs
					activeKey={activeTab}
					onChange={setActiveTab}
					items={[
						{ key: "all", label: `All Alerts (${stats?.total || 0})`, content: null },
						{ key: "unread", label: `Unread (${stats?.unread || 0})`, content: null },
						{ key: "anomaly", label: "Anomalies", content: null },
						{ key: "forecast", label: "Forecasts", content: null },
						{ key: "system", label: "System", content: null },
					]}
				/>

				<div className="mt-4">
					{filteredAlerts.length === 0 ? (
						<Alert variant="info">
							{activeTab === "unread"
								? "You have no unread alerts."
								: "No alerts match your current filters."}
						</Alert>
					) : (
						<>
							<Table
								columns={columns}
								dataSource={paginatedAlerts}
								rowKey="id"
								loading={loading}
								emptyText="No alerts found"
							/>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className="flex items-center justify-between px-6 py-3 border-t border">
									<span className="text-sm text-muted-foreground">
										Total {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""}
									</span>
									<div className="flex items-center gap-2">
										<Button
											variant="ghost"
											size="sm"
											disabled={page <= 1}
											onClick={() => setPage(page - 1)}
										>
											Previous
										</Button>
										<span className="text-sm text-foreground">
											{page} / {totalPages}
										</span>
										<Button
											variant="ghost"
											size="sm"
											disabled={page >= totalPages}
											onClick={() => setPage(page + 1)}
										>
											Next
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</Card>

			{/* Delete Confirmation Modal */}
			<Modal
				open={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				title="Delete Alert"
				footer={
					<>
						<Button variant="ghost" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={() => deleteTarget && handleDeleteAlert(deleteTarget.id)}
						>
							Delete
						</Button>
					</>
				}
			>
				<p className="text-sm text-muted-foreground">
					Are you sure you want to delete this alert? This action cannot be undone.
				</p>
			</Modal>
		</PageContainer>
	);
}
