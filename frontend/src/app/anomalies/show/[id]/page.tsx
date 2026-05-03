/**
 * Anomaly Detail Page
 *
 * Displays detailed information about a specific anomaly including:
 * - Anomaly metadata (severity, status, detection method)
 * - Context and related time series
 * - Visualization of the anomalous data point
 * - Resolution actions
 */

"use client";

import { Check, ChevronRight, Clock, Home, TrendingUp, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { authFetch } from "@/utils/auth";

interface AnomalyDetailParams {
	id: string;
}

interface AnomalyWithDetails extends Record<string, any> {
	id: string;
	timeseries?: {
		id: string;
		name: string;
		path: string;
	};
	detectedAt?: string;
	resolvedAt?: string;
	resolvedBy?: string;
	resolutionNote?: string;
	detectionMethod?: string;
	threshold?: number;
	actualValue?: number;
	normalRange?: {
		min: number;
		max: number;
	};
	severity: string;
	isResolved?: boolean;
}

export default function AnomalyDetailPage({ params }: { params: Promise<AnomalyDetailParams> }) {
	const { id } = use(params);
	const router = useRouter();
	const toast = useToast();
	const [anomaly, setAnomaly] = useState<AnomalyWithDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchAnomaly = useCallback(async () => {
		if (!id) {
			setError("Anomaly ID is required");
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			const response = await authFetch(`/api/anomalies/${id}`);
			if (!response.ok) {
				throw new Error("Failed to fetch anomaly");
			}
			const data = await response.json();
			setAnomaly(data.data || data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		fetchAnomaly();
	}, [fetchAnomaly]);

	const handleResolve = async () => {
		try {
			const response = await authFetch(`/api/anomalies/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "RESOLVED" }),
			});
			if (!response.ok) {
				throw new Error("Failed to resolve anomaly");
			}
			toast.showSuccess("Anomaly resolved successfully");
			fetchAnomaly();
		} catch {
			toast.showError("Failed to resolve anomaly");
		}
	};

	const handleDismiss = async () => {
		try {
			const response = await authFetch(`/api/anomalies/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "DISMISSED" }),
			});
			if (!response.ok) {
				throw new Error("Failed to dismiss anomaly");
			}
			toast.showSuccess("Anomaly dismissed");
			fetchAnomaly();
		} catch {
			toast.showError("Failed to dismiss anomaly");
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
				</div>
			</div>
		);
	}

	if (error || !anomaly) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
				<div className="max-w-md mx-auto mt-20">
					<div className="bg-card rounded-lg shadow-sm border border p-6 text-center">
						<h3 className="text-lg font-semibold text-red-500 mb-3">Error</h3>
						<p className="text-muted-foreground mb-6">{error || "Anomaly not found"}</p>
						<Button variant="primary" onClick={() => window.history.back()}>
							Go Back
						</Button>
					</div>
				</div>
			</div>
		);
	}

	const severityTagColor = (
		severity: string,
	): "success" | "warning" | "error" | "primary" | "default" => {
		const map: Record<string, "success" | "warning" | "error" | "primary" | "default"> = {
			low: "success",
			medium: "warning",
			high: "error",
		};
		return map[severity] || "default";
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
			{/* Breadcrumb */}
			<nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
				<a href="/" className="hover:text-gray-700 dark:hover:text-gray-200">
					<Home className="size-4" />
				</a>
				<ChevronRight className="size-3" />
				<a href="/anomalies" className="hover:text-gray-700 dark:hover:text-gray-200">
					Anomalies
				</a>
				<ChevronRight className="size-3" />
				<span className="text-gray-900 dark:text-gray-100 font-medium">
					Anomaly #{anomaly.id.substring(0, 8)}
				</span>
			</nav>

			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-foreground">
						Anomaly #{anomaly.id.substring(0, 8)}
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Detected{" "}
						{anomaly.detectedAt ? new Date(anomaly.detectedAt).toLocaleString() : "Recently"}
					</p>
				</div>
				<div className="flex gap-2">
					{anomaly.isResolved !== true && (
						<Button variant="primary" onClick={handleResolve}>
							<Check className="size-4 mr-1.5" />
							Resolve
						</Button>
					)}
					<Button variant="ghost" onClick={handleDismiss}>
						<X className="size-4 mr-1.5" />
						Dismiss
					</Button>
				</div>
			</div>

			{/* Main grid */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
				{/* Anomaly Status Card */}
				<div className="bg-card rounded-lg shadow-sm border border p-6">
					<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
						Anomaly Status
					</h3>
					<div className="space-y-4">
						<div>
							<span className="text-sm text-muted-foreground">Severity</span>
							<div className="mt-1">
								<Tag color={severityTagColor(anomaly.severity)}>
									{anomaly.severity?.toUpperCase()}
								</Tag>
							</div>
						</div>
						<div>
							<span className="text-sm text-muted-foreground">Status</span>
							<div className="mt-1">
								<Tag color={anomaly.isResolved === true ? "success" : "info"}>
									{anomaly.isResolved ? "RESOLVED" : "OPEN"}
								</Tag>
							</div>
						</div>
						<div>
							<span className="text-sm text-muted-foreground">Detection Method</span>
							<div className="mt-1 text-sm font-medium text-foreground">
								{anomaly.detectionMethod || "statistical"}
							</div>
						</div>
					</div>

					{anomaly.isResolved === true && anomaly.resolvedAt && (
						<Alert
							variant="success"
							title={`Resolved by ${anomaly.resolvedBy || "Admin"}`}
							className="mt-4"
						>
							{anomaly.resolutionNote || "No resolution note provided"}
						</Alert>
					)}
				</div>

				{/* Anomaly Context Card */}
				<div className="bg-card rounded-lg shadow-sm border border p-6 lg:col-span-2">
					<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
						Anomaly Context
					</h3>
					<div className="space-y-4">
						{anomaly.timeseries && (
							<div className="flex items-center gap-2">
								<TrendingUp className="size-4 text-gray-400" />
								<span className="font-semibold text-foreground">{anomaly.timeseries.name}</span>
								<span className="text-sm text-muted-foreground">({anomaly.timeseries.path})</span>
							</div>
						)}

						{anomaly.actualValue !== undefined && (
							<div>
								<span className="text-sm text-muted-foreground">Detected Value</span>
								<div
									className="text-2xl font-semibold mt-1"
									style={{
										color: anomaly.severity === "high" ? "#ef4444" : "#f59e0b",
									}}
								>
									{anomaly.actualValue.toFixed(4)}
									{anomaly.threshold ? ` / ${anomaly.threshold}` : ""}
								</div>
							</div>
						)}

						{anomaly.normalRange && (
							<div>
								<span className="text-sm text-muted-foreground">Normal Range</span>
								<div className="mt-1 flex gap-4 text-sm">
									<span>Min: {anomaly.normalRange.min.toFixed(4)}</span>
									<span>Max: {anomaly.normalRange.max.toFixed(4)}</span>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Visualization */}
			<div className="bg-card rounded-lg shadow-sm border border p-6 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
					Data Visualization
				</h3>
				<Alert variant="info" title="Chart showing the anomaly in context" className="mb-4">
					The anomalous data point will be highlighted on the chart
				</Alert>
				<div className="h-[300px] flex items-center justify-center bg-red-50 dark:bg-red-900/10 rounded-lg border border-dashed border-red-200 dark:border-red-800/30">
					<TriangleAlert className="size-12 text-red-500 mr-4" />
					<div>
						<span className="font-semibold text-foreground">Anomaly Visualization</span>
						<br />
						<span className="text-sm text-muted-foreground">
							Chart will display the anomalous data point
						</span>
					</div>
				</div>
			</div>

			{/* Timeline */}
			<div className="bg-card rounded-lg shadow-sm border border p-6 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
					Event Timeline
				</h3>
				<div className="relative pl-6">
					{/* Timeline line */}
					<div className="absolute left-2 top-2 bottom-2 w-0.5 bg-muted" />

					{/* Detected event */}
					<div className="relative mb-6">
						<div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white dark:border-gray-800" />
						<div>
							<span className="font-semibold text-foreground">Anomaly Detected</span>
							<br />
							<span className="text-sm text-muted-foreground">
								{anomaly.detectedAt ? new Date(anomaly.detectedAt).toLocaleString() : "Recently"}
							</span>
						</div>
					</div>

					{/* Resolved event */}
					{anomaly.isResolved === true && (
						<div className="relative">
							<div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-gray-800" />
							<div>
								<span className="font-semibold text-foreground">Anomaly Resolved</span>
								<br />
								<span className="text-sm text-muted-foreground">
									{anomaly.resolvedAt ? new Date(anomaly.resolvedAt).toLocaleString() : "Recently"}
								</span>
								{anomaly.resolutionNote && (
									<>
										<br />
										<span className="text-sm text-muted-foreground">{anomaly.resolutionNote}</span>
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Quick Actions */}
			<div className="bg-card rounded-lg shadow-sm border border p-6">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
					Quick Actions
				</h3>
				<div className="flex flex-wrap gap-3">
					{anomaly.timeseries && (
						<Button
							variant="secondary"
							onClick={() =>
								anomaly.timeseries && router.push(`/timeseries?path=${anomaly.timeseries.path}`)
							}
						>
							<TrendingUp className="size-4 mr-1.5" />
							View Time Series
						</Button>
					)}
					<Button variant="ghost" onClick={() => router.push("/anomalies")}>
						<Clock className="size-4 mr-1.5" />
						View Related Anomalies
					</Button>
				</div>
			</div>
		</div>
	);
}
