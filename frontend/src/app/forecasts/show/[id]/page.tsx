/**
 * Forecast Detail Page
 *
 * Displays detailed information about a specific forecast including:
 * - Forecast metadata (algorithm, parameters, accuracy)
 * - Visualization of predicted vs actual values
 * - Confidence intervals
 * - Historical runs comparison
 */

"use client";

import { Check, Clock, Edit3, Trash2, TrendingUp } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { type Column, Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { authFetch } from "@/utils/auth";

interface ForecastDetailParams {
	id?: string;
}

interface PredictedValueRow {
	key: number;
	index: number;
	value: number;
	lower?: number;
	upper?: number;
}

interface ForecastWithDetails extends Record<string, any> {
	id: string;
	timeseries?: { name: string; unit?: string };
	algorithm?: string;
	horizon?: number;
	accuracy?: number;
	mae?: number;
	rmse?: number;
	status?: "pending" | "running" | "completed" | "failed";
	predictedValues: number[];
	confidenceIntervals?: { lower?: number[]; upper?: number[] };
	startTime: string;
	endTime: string;
	modelId?: string;
	model?: { algorithm?: string };
	createdAt: string;
}

export default function ForecastDetailPage() {
	const params = useParams() as ForecastDetailParams;
	const router = useRouter();
	const toast = useToast();
	const [forecast, setForecast] = useState<ForecastWithDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);

	const fetchForecast = useCallback(async () => {
		if (!params.id) {
			setError("Forecast ID is required");
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			const response = await authFetch(`/api/forecasts/${params.id}`);
			if (!response.ok) {
				throw new Error("Failed to fetch forecast");
			}
			const data = await response.json();
			setForecast(data.data || data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}, [params.id]);

	useEffect(() => {
		fetchForecast();
	}, [fetchForecast]);

	const handleDelete = async () => {
		try {
			const response = await authFetch(`/api/forecasts/${params.id}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				throw new Error("Failed to delete forecast");
			}
			toast.showSuccess("Forecast deleted");
			router.push("/forecasts");
		} catch {
			toast.showError("Failed to delete forecast");
		}
	};

	if (loading) {
		return (
			<PageContainer>
				<div className="flex items-center justify-center min-h-100">
					<div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
				</div>
			</PageContainer>
		);
	}

	if (error || !forecast) {
		return (
			<PageContainer>
				<div className="max-w-md mx-auto mt-20">
					<div className="bg-card rounded-lg shadow-sm border border p-6 text-center">
						<h3 className="text-lg font-semibold text-red-500 mb-3">Error</h3>
						<p className="text-muted-foreground mb-6">{error || "Forecast not found"}</p>
						<Button variant="primary" onClick={() => window.history.back()}>
							Go Back
						</Button>
					</div>
				</div>
			</PageContainer>
		);
	}

	// Build predicted values data for the table
	const predictedValuesData: PredictedValueRow[] = (forecast.predictedValues || []).map(
		(value, index) => ({
			key: index,
			index: index + 1,
			value,
			lower: forecast.confidenceIntervals?.lower?.[index],
			upper: forecast.confidenceIntervals?.upper?.[index],
		}),
	);

	// Table columns for predicted values
	const predictedValuesColumns: Column<PredictedValueRow>[] = [
		{
			key: "index",
			title: "#",
			dataIndex: "index",
			width: 80,
		},
		{
			key: "value",
			title: "Predicted Value",
			dataIndex: "value",
			render: (value: unknown) => (
				<span style={{ fontVariantNumeric: "tabular-nums" }}>{(value as number).toFixed(4)}</span>
			),
		},
		{
			key: "lower",
			title: "Lower Bound",
			dataIndex: "lower",
			render: (lower: unknown) => {
				const l = lower as number | undefined;
				return l !== undefined ? (
					<span style={{ fontVariantNumeric: "tabular-nums" }}>{l.toFixed(4)}</span>
				) : (
					"-"
				);
			},
		},
		{
			key: "upper",
			title: "Upper Bound",
			dataIndex: "upper",
			render: (upper: unknown) => {
				const u = upper as number | undefined;
				return u !== undefined ? (
					<span style={{ fontVariantNumeric: "tabular-nums" }}>{u.toFixed(4)}</span>
				) : (
					"-"
				);
			},
		},
	];

	const statusColor =
		forecast.status === "completed"
			? "#22c55e"
			: forecast.status === "failed"
				? "#ef4444"
				: "#f59e0b";

	return (
		<PageContainer>
			{/* Delete Confirmation Modal */}
			<Modal
				open={deleteModalOpen}
				onClose={() => setDeleteModalOpen(false)}
				title="Delete Forecast"
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
					Are you sure you want to delete this forecast? This action cannot be undone.
				</p>
			</Modal>

			<PageHeader
				title={forecast.timeseries?.name || "Forecast"}
				description={`Created ${new Date(forecast.createdAt).toLocaleString()}`}
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "Forecasts", href: "/forecasts" },
					{ label: forecast.id.substring(0, 8) },
				]}
				actions={
					<>
						<Button variant="ghost" onClick={() => router.push(`/forecasts/edit/${forecast.id}`)}>
							<Edit3 className="size-4 mr-1.5" />
							Edit
						</Button>
						<Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
							<Trash2 className="size-4 mr-1.5" />
							Delete
						</Button>
					</>
				}
			/>

			{/* Main grid */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
				{/* Summary Card */}
				<div className="bg-card rounded-lg shadow-sm border border p-6">
					<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
						Forecast Summary
					</h3>
					<div className="space-y-6">
						<div>
							<span className="text-sm text-muted-foreground">Status</span>
							<div className="mt-1 flex items-center gap-2">
								<Check className="size-5" style={{ color: statusColor }} />
								<span className="text-lg font-semibold" style={{ color: statusColor }}>
									{forecast.status || "completed"}
								</span>
							</div>
						</div>

						<div>
							<span className="text-sm text-muted-foreground">Algorithm</span>
							<div className="mt-1 flex items-center gap-2">
								<span className="text-lg font-semibold text-foreground">
									{forecast.algorithm || "arima"}
								</span>
								<Tag color="info">AI Model</Tag>
							</div>
						</div>

						<div>
							<span className="text-sm text-muted-foreground">Forecast Horizon</span>
							<div className="mt-1 text-lg font-semibold text-foreground">
								{forecast.horizon || forecast.predictedValues?.length || 0} steps
							</div>
						</div>

						{forecast.accuracy !== undefined && (
							<div>
								<span className="text-sm text-muted-foreground">Accuracy</span>
								<div
									className="mt-1 text-lg font-semibold"
									style={{
										color: forecast.accuracy > 80 ? "#22c55e" : "#f59e0b",
									}}
								>
									{forecast.accuracy.toFixed(2)}%
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Chart Card */}
				<div className="bg-card rounded-lg shadow-sm border border p-6 lg:col-span-2">
					<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
						Forecast Visualization
					</h3>
					<Alert variant="info" title="Forecast chart will be displayed here" className="mb-4">
						This will show the predicted values with confidence intervals
					</Alert>
					<div className="h-75 flex items-center justify-center bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-dashed border-blue-200 dark:border-blue-800/30">
						<TrendingUp className="size-12 text-blue-500 mr-4" />
						<span className="text-muted-foreground">Chart visualization</span>
					</div>
				</div>
			</div>

			{/* Parameters Card */}
			<div className="bg-card rounded-lg shadow-sm border border p-6 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
					Forecast Parameters
				</h3>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					{/* Time Range */}
					<div className="border border rounded-lg p-4">
						<h4 className="text-sm font-semibold text-foreground mb-2">Time Range</h4>
						<div className="space-y-1 text-sm text-muted-foreground">
							<div className="flex items-center gap-1.5">
								<Clock className="size-3.5" />
								Start: {new Date(forecast.startTime).toLocaleString()}
							</div>
							<div className="flex items-center gap-1.5">
								<Clock className="size-3.5" />
								End: {new Date(forecast.endTime).toLocaleString()}
							</div>
						</div>
					</div>

					{/* Model */}
					<div className="border border rounded-lg p-4">
						<h4 className="text-sm font-semibold text-foreground mb-2">Model</h4>
						<div className="space-y-1 text-sm text-muted-foreground">
							<div>Model ID: {forecast.modelId?.substring(0, 8)}...</div>
							<div>Type: {forecast.model?.algorithm || "arima"}</div>
						</div>
					</div>

					{/* Performance Metrics */}
					<div className="border border rounded-lg p-4">
						<h4 className="text-sm font-semibold text-foreground mb-2">Performance Metrics</h4>
						<div className="space-y-1 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
							{forecast.mae !== undefined && (
								<div className="text-muted-foreground">MAE: {forecast.mae.toFixed(4)}</div>
							)}
							{forecast.rmse !== undefined && (
								<div className="text-muted-foreground">RMSE: {forecast.rmse.toFixed(4)}</div>
							)}
							{forecast.mae === undefined && forecast.rmse === undefined && (
								<div className="text-gray-400">No metrics available</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Predicted Values Table */}
			<div className="bg-card rounded-lg shadow-sm border border p-6 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
					Predicted Values
				</h3>
				<Table
					columns={predictedValuesColumns}
					dataSource={predictedValuesData}
					rowKey="key"
					emptyText="No predicted values"
				/>
			</div>

			{/* Historical Runs */}
			<div className="bg-card rounded-lg shadow-sm border border p-6">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
						Historical Runs
					</h3>
					<Button variant="ghost" size="sm">
						View All
					</Button>
				</div>
				<Alert variant="info">
					Historical forecast runs will be displayed here. Compare different forecast runs for the
					same time series.
				</Alert>
			</div>
		</PageContainer>
	);
}
