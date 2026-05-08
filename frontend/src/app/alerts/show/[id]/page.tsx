"use client";

import dayjs from "dayjs";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useOne } from "@/lib/api";
import { authFetch } from "@/utils/auth";

interface AlertShowPageProps {
	params: Promise<{ id: string }>;
}

const SEVERITY_CONFIG: Record<
	string,
	{
		tagColor: "info" | "warning" | "error";
		label: string;
		alertVariant: "info" | "warning" | "error";
	}
> = {
	INFO: { tagColor: "info", label: "Info", alertVariant: "info" },
	WARNING: { tagColor: "warning", label: "Warning", alertVariant: "warning" },
	ERROR: { tagColor: "error", label: "Error", alertVariant: "error" },
};

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
	ANOMALY: { label: "Anomaly Detection", icon: "\u{1F6A8}" },
	FORECAST_READY: { label: "Forecast Ready", icon: "\u{1F4C8}" },
	SYSTEM: { label: "System Event", icon: "⚙️" },
	THRESHOLD: { label: "Threshold Breach", icon: "\u{1F4CA}" },
};

export default function AlertShowPage({ params }: AlertShowPageProps) {
	const { id } = React.use(params);
	const router = useRouter();
	const toast = useToast();
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);

	const { data: alert, loading, mutate } = useOne("alerts", id);

	const handleMarkAsRead = async () => {
		try {
			const response = await authFetch(`/api/alerts/${id}/read`, { method: "PATCH" });
			if (!response.ok) throw new Error("Failed to mark alert as read");
			toast.showSuccess("Alert marked as read");
			mutate();
		} catch {
			toast.showError("Failed to mark alert as read");
		}
	};

	const handleDelete = async () => {
		try {
			const response = await authFetch(`/api/alerts/${id}`, { method: "DELETE" });
			if (!response.ok) throw new Error("Failed to delete alert");
			toast.showSuccess("Alert deleted");
			router.push("/alerts");
		} catch {
			toast.showError("Failed to delete alert");
		} finally {
			setDeleteModalOpen(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-muted p-4 md:p-6">
				<div className="mx-auto max-w-360">
					<Alert variant="info">Loading alert details...</Alert>
				</div>
			</div>
		);
	}

	if (!alert) {
		return (
			<div className="min-h-screen bg-muted p-4 md:p-6">
				<div className="mx-auto max-w-360">
					<Alert variant="error">Alert not found</Alert>
				</div>
			</div>
		);
	}

	const severityConfig = SEVERITY_CONFIG[alert.severity as string] || SEVERITY_CONFIG.INFO;
	const typeConfig = ALERT_TYPE_CONFIG[alert.type as string] || {
		label: alert.type as string,
		icon: "\u{1F4E2}",
	};

	return (
		<div className="min-h-screen bg-muted p-4 md:p-6">
			<div className="mx-auto max-w-360">
				{/* Breadcrumbs */}
				<nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
					<a href="/" className="hover:text-gray-700 dark:hover:text-gray-200">
						Home
					</a>
					<ChevronRight className="size-3" />
					<a href="/alerts" className="hover:text-gray-700 dark:hover:text-gray-200">
						Alerts & Notifications
					</a>
					<ChevronRight className="size-3" />
					<span className="text-foreground">Alert Details</span>
				</nav>

				{/* Page Header */}
				<div className="flex items-start justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl font-semibold text-foreground tracking-tight">Alert Details</h1>
						<p className="text-sm text-muted-foreground mt-1">
							View detailed information about this alert
						</p>
					</div>
					<Button variant="ghost" onClick={() => router.push("/alerts")}>
						<ArrowLeft className="size-4 mr-1.5" />
						Back to Alerts
					</Button>
				</div>

				{/* Status Alert */}
				<div className="mb-6">
					<Alert
						variant={severityConfig.alertVariant}
						title={`${typeConfig.icon} ${typeConfig.label} - ${severityConfig.label} Severity`}
					>
						{String(alert.message || alert.description || "No description provided")}
					</Alert>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Main Details */}
					<div className="lg:col-span-2">
						<Card>
							<CardHeader>
								<h3 className="text-lg font-semibold text-foreground">Alert Information</h3>
								<p className="text-sm text-muted-foreground">Details about this alert</p>
							</CardHeader>
							<CardBody>
								<dl className="space-y-4">
									{/* Alert ID */}
									<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
										<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
											Alert ID
										</dt>
										<dd>
											<code className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground">
												{String(alert.id)}
											</code>
										</dd>
									</div>

									{/* Name */}
									<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
										<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
											Name
										</dt>
										<dd className="font-semibold text-foreground">
											{String(alert.name ?? "Unnamed Alert")}
										</dd>
									</div>

									{/* Type */}
									<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
										<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
											Type
										</dt>
										<dd>
											<Tag color="info">
												{String(typeConfig.icon)} {String(typeConfig.label)}
											</Tag>
										</dd>
									</div>

									{/* Severity */}
									<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
										<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
											Severity
										</dt>
										<dd>
											<Tag color={severityConfig.tagColor}>{severityConfig.label}</Tag>
										</dd>
									</div>

									{/* Status */}
									<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
										<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
											Status
										</dt>
										<dd className="flex items-center gap-2">
											<span
												className={`inline-block w-2 h-2 rounded-full ${alert.isRead ? "bg-gray-300" : "bg-blue-500 animate-pulse"}`}
											/>
											<span className="text-sm text-foreground">
												{alert.isRead ? "Read" : "Unread"}
											</span>
										</dd>
									</div>

									{/* Created At */}
									<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
										<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
											Created At
										</dt>
										<dd className="text-sm text-foreground">
											{dayjs(String(alert.createdAt)).format("YYYY-MM-DD HH:mm:ss")}
										</dd>
									</div>

									{/* Time Series */}
									{!!alert.timeseries && (
										<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
											<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
												Time Series
											</dt>
											<dd className="flex items-center gap-2">
												<span className="font-semibold text-foreground">
													{String((alert.timeseries as Record<string, unknown>).name)}
												</span>
												{!!(alert.timeseries as Record<string, unknown>).unit && (
													<span className="text-sm text-muted-foreground">
														({String((alert.timeseries as Record<string, unknown>).unit)})
													</span>
												)}
											</dd>
										</div>
									)}

									{/* Description */}
									{!!alert.description && (
										<div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
											<dt className="text-sm font-medium text-muted-foreground sm:w-40 shrink-0">
												Description
											</dt>
											<dd className="text-sm text-foreground">{alert.description as string}</dd>
										</div>
									)}
								</dl>
							</CardBody>
						</Card>
					</div>

					{/* Side Panel */}
					<div className="space-y-6">
						{/* Quick Actions */}
						<Card>
							<CardHeader>
								<h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
								<p className="text-sm text-muted-foreground">Available actions for this alert</p>
							</CardHeader>
							<CardBody>
								<div className="space-y-3">
									{!alert.isRead && (
										<Button fullWidth onClick={handleMarkAsRead}>
											Mark as Read
										</Button>
									)}
									<Button variant="danger" fullWidth onClick={() => setDeleteModalOpen(true)}>
										Delete Alert
									</Button>
								</div>
							</CardBody>
						</Card>

						{/* Metadata Card */}
						<Card>
							<CardHeader>
								<h3 className="text-lg font-semibold text-foreground">Metadata</h3>
								<p className="text-sm text-muted-foreground">Alert metadata</p>
							</CardHeader>
							<CardBody>
								<dl className="space-y-3">
									<div className="flex justify-between">
										<dt className="text-sm text-muted-foreground">Created At</dt>
										<dd className="text-sm text-foreground">
											{dayjs(String(alert.createdAt)).format("YYYY-MM-DD HH:mm")}
										</dd>
									</div>
									<div className="flex justify-between">
										<dt className="text-sm text-muted-foreground">Time</dt>
										<dd className="text-sm text-foreground">
											{dayjs(String(alert.createdAt)).format("HH:mm:ss")}
										</dd>
									</div>
								</dl>
							</CardBody>
						</Card>
					</div>
				</div>

				{/* Delete Confirmation Modal */}
				<Modal
					open={deleteModalOpen}
					onClose={() => setDeleteModalOpen(false)}
					title="Delete Alert"
					footer={
						<>
							<Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
								Cancel
							</Button>
							<Button variant="danger" onClick={handleDelete}>
								Delete
							</Button>
						</>
					}
				>
					<p className="text-sm text-muted-foreground">
						Are you sure you want to delete this alert? This action cannot be undone.
					</p>
				</Modal>
			</div>
		</div>
	);
}
