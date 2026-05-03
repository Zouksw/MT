"use client";

import { BarChart3, Calendar, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { API_BASE, formatMape, getAuthHeaders, getMapeTextColor } from "@/lib/ai-utils";

interface BacktestWindow {
	window: number;
	mape: number | null;
	predictionCount: number;
	verifiedCount: number;
	trend: string;
}

interface BacktestResult {
	modelId: string;
	windows: BacktestWindow[];
	trend: string;
}

function mapeColor(value: number | null): string {
	if (value === null) return "text-muted-foreground";
	return getMapeTextColor(value);
}

function trendLabel(trend: string): string {
	switch (trend) {
		case "improving":
			return "Improving";
		case "degrading":
			return "Degrading";
		case "stable":
			return "Stable";
		default:
			return "Insufficient data";
	}
}

export default function BacktestPage() {
	const [models, setModels] = useState<string[]>([]);
	const [selectedModel, setSelectedModel] = useState<string>("");
	const [backtest, setBacktest] = useState<BacktestResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch model list
	useEffect(() => {
		(async () => {
			try {
				const headers = await getAuthHeaders();
				const res = await fetch(`${API_BASE}/api/signals/models`, { headers });
				const data = await res.json();
				if (data.success) {
					const modelIds = data.data.models;
					setModels(modelIds);
					if (modelIds.length > 0 && !selectedModel) {
						setSelectedModel(modelIds[0]);
					}
				}
			} catch {
				setError("Failed to load models");
			} finally {
				setLoading(false);
			}
		})();
	}, [selectedModel]);

	// Fetch backtest when model changes
	useEffect(() => {
		if (!selectedModel) return;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const headers = await getAuthHeaders();
				const res = await fetch(`${API_BASE}/api/signals/models/${selectedModel}/backtest`, {
					headers,
				});
				const data = await res.json();
				if (data.success) {
					setBacktest(data.data);
				} else {
					setError(data.error?.message || "Backtest failed");
				}
			} catch {
				setError("Failed to load backtest data");
			} finally {
				setLoading(false);
			}
		})();
	}, [selectedModel]);

	const bestWindow = backtest?.windows?.reduce<BacktestWindow | null>(
		(best, w) =>
			!best || (w.mape !== null && best.mape !== null && w.mape < best.mape) ? w : best,
		null,
	);

	const columns = [
		{
			key: "window",
			title: "Window",
			render: (_: unknown, record: BacktestWindow) => `${record.window}-day`,
		},
		{
			key: "mape",
			title: "MAPE",
			render: (_: unknown, record: BacktestWindow) => (
				<span className={`font-mono font-medium ${mapeColor(record.mape)}`}>
					{formatMape(record.mape)}
				</span>
			),
		},
		{
			key: "predictions",
			title: "Predictions",
			render: (_: unknown, record: BacktestWindow) => record.predictionCount.toLocaleString(),
		},
		{
			key: "verified",
			title: "Verified",
			render: (_: unknown, record: BacktestWindow) => record.verifiedCount.toLocaleString(),
		},
		{
			key: "trend",
			title: "Trend",
			render: (_: unknown, record: BacktestWindow) => (
				<span
					className={`text-sm font-medium ${
						record.trend === "improving"
							? "text-green-600 dark:text-green-400"
							: record.trend === "degrading"
								? "text-red-600 dark:text-red-400"
								: "text-muted-foreground"
					}`}
				>
					{trendLabel(record.trend)}
				</span>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title="Backtest Reports"
				description="Compare model predictions against actual market outcomes over different time windows"
				breadcrumbs={[
					{ label: "Home", href: "/dashboard" },
					{ label: "AI", href: "/ai" },
					{ label: "Backtest" },
				]}
			/>

			{/* Model Selector */}
			<Card className="mb-6">
				<CardBody>
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
						<div className="flex items-center gap-2">
							<BarChart3 className="size-5 text-muted-foreground" />
							<span className="text-sm font-medium text-foreground">Select Model</span>
						</div>
						<div className="flex flex-wrap gap-2">
							{models.map((modelId) => (
								<Button
									key={modelId}
									variant={selectedModel === modelId ? "primary" : "secondary"}
									size="sm"
									onClick={() => setSelectedModel(modelId)}
								>
									{modelId}
								</Button>
							))}
						</div>
					</div>
				</CardBody>
			</Card>

			{error && (
				<ErrorDisplay
					error={error}
					retry={() => setSelectedModel(selectedModel)}
					context="backtest data"
				/>
			)}

			<LoadingState loading={loading} skeletonType="stats">
				{backtest && (
					<>
						{/* Summary Stats */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
							<StatCard
								title="Best MAPE"
								value={
									bestWindow?.mape !== null && bestWindow?.mape !== undefined
										? Number(bestWindow.mape.toFixed(2))
										: "--"
								}
								icon={<Target className="size-5" />}
								variant="primary"
							/>
							<StatCard
								title="Overall Trend"
								value={trendLabel(backtest.trend)}
								icon={<TrendingUp className="size-5" />}
								variant={backtest.trend === "improving" ? "success" : "default"}
							/>
							<StatCard
								title="Windows Tested"
								value={backtest.windows?.length ?? 0}
								icon={<Calendar className="size-5" />}
								variant="default"
							/>
							<StatCard
								title="Total Predictions"
								value={backtest.windows?.reduce((sum, w) => sum + w.predictionCount, 0) ?? 0}
								icon={<BarChart3 className="size-5" />}
								variant="default"
							/>
						</div>

						{/* Backtest Results Table */}
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="text-sm font-medium">
									Backtest Results — {selectedModel}
								</CardTitle>
							</CardHeader>
							<CardBody className="p-0">
								<Table
									columns={columns}
									dataSource={backtest.windows || []}
									rowKey="window"
									emptyText="No backtest data available"
								/>
							</CardBody>
						</Card>

						{/* MAPE Visualization */}
						<Card>
							<CardHeader>
								<CardTitle className="text-sm font-medium">MAPE by Time Window</CardTitle>
							</CardHeader>
							<CardBody>
								<div className="space-y-3">
									{(backtest.windows || []).map((w) => (
										<div key={w.window} className="flex items-center gap-4">
											<span className="text-sm text-muted-foreground w-20 shrink-0">
												{w.window}-day
											</span>
											<div className="flex-1 h-8 bg-muted rounded-md overflow-hidden relative">
												{w.mape !== null && (
													<div
														className={`h-full rounded-md transition-all duration-500 ${
															w.mape < 5
																? "bg-green-500/80 dark:bg-green-600/80"
																: w.mape < 10
																	? "bg-primary/80"
																	: "bg-red-500/80 dark:bg-red-600/80"
														}`}
														style={{ width: `${Math.min(100, (w.mape / 20) * 100)}%` }}
													/>
												)}
											</div>
											<span
												className={`text-sm font-mono font-medium w-20 text-right ${mapeColor(w.mape)}`}
											>
												{formatMape(w.mape)}
											</span>
										</div>
									))}
								</div>
							</CardBody>
						</Card>
					</>
				)}
			</LoadingState>
		</PageContainer>
	);
}
