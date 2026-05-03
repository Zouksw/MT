"use client";

import { Activity, BarChart3, Minus, Target, TrendingDown, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import {
	API_BASE,
	formatMape,
	getAuthHeaders,
	getMapeTextColor,
	MODEL_COLORS,
	MODEL_NAME_MAP,
} from "@/lib/ai-utils";

interface ModelAccuracy {
	modelId: string;
	avgMape: number | null;
	predictionCount: number;
	verifiedCount: number;
}

interface BacktestWindow {
	days: number;
	mape: number | null;
	predictionCount: number;
	verifiedCount: number;
}

interface BacktestData {
	modelId: string;
	windows: BacktestWindow[];
	trend: string;
}

interface EnrichedModel extends ModelAccuracy {
	displayName: string;
	backtest: BacktestData | null;
	verificationRate: number;
}

function mapeBadge(mape: number | null) {
	if (mape === null) return <span className="text-muted-foreground">--</span>;
	return (
		<span className={`font-mono font-medium ${getMapeTextColor(mape)}`}>{mape.toFixed(2)}%</span>
	);
}

function trendBadge(trend: string) {
	switch (trend) {
		case "improving":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
					<TrendingUp className="size-3" /> Improving
				</span>
			);
		case "degrading":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
					<TrendingDown className="size-3" /> Degrading
				</span>
			);
		case "stable":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
					<Minus className="size-3" /> Stable
				</span>
			);
		default:
			return <span className="text-xs text-muted-foreground">N/A</span>;
	}
}

export default function AIModelsPage() {
	const [models, setModels] = useState<EnrichedModel[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const headers = await getAuthHeaders();

				const accRes = await fetch(`${API_BASE}/api/signals/models/accuracy`, { headers });
				const accData = await accRes.json();
				const accuracyList: ModelAccuracy[] = accData.success
					? (accData.data?.accuracy ?? accData.data ?? [])
					: [];

				const backtestMap = new Map<string, BacktestData>();
				await Promise.allSettled(
					accuracyList.map(async (m) => {
						try {
							const btRes = await fetch(`${API_BASE}/api/signals/models/${m.modelId}/backtest`, {
								headers,
							});
							const btData = await btRes.json();
							if (btData.success && btData.data) {
								backtestMap.set(m.modelId, btData.data);
							}
						} catch {}
					}),
				);

				const enriched: EnrichedModel[] = accuracyList.map((m) => ({
					...m,
					displayName: MODEL_NAME_MAP[m.modelId] || m.modelId,
					backtest: backtestMap.get(m.modelId) ?? null,
					verificationRate:
						m.predictionCount > 0 ? Math.round((m.verifiedCount / m.predictionCount) * 100) : 0,
				}));

				setModels(enriched);
			} catch {
				setError("Failed to load model data");
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const stats = useMemo(() => {
		const valid = models.filter((m) => m.avgMape !== null);
		const best =
			valid.length > 0
				? valid.reduce((a, b) => ((a.avgMape ?? Infinity) < (b.avgMape ?? Infinity) ? a : b))
				: null;
		const avgMape =
			valid.length > 0 ? valid.reduce((s, m) => s + (m.avgMape ?? 0), 0) / valid.length : null;
		return { best, avgMape };
	}, [models]);

	const columns = [
		{
			key: "model",
			title: "Model",
			render: (_: unknown, record: EnrichedModel) => (
				<Link
					href={`/ai/accuracy`}
					className="font-medium text-foreground hover:text-primary transition-colors"
				>
					{record.displayName}
				</Link>
			),
		},
		{
			key: "mape",
			title: "Avg MAPE",
			align: "right" as const,
			render: (_: unknown, record: EnrichedModel) => mapeBadge(record.avgMape),
		},
		{
			key: "predictions",
			title: "Predictions",
			align: "right" as const,
			render: (_: unknown, record: EnrichedModel) => (
				<span className="text-sm text-muted-foreground">
					{record.predictionCount.toLocaleString()}
				</span>
			),
		},
		{
			key: "verified",
			title: "Verified",
			align: "right" as const,
			render: (_: unknown, record: EnrichedModel) => (
				<span className="text-sm text-muted-foreground">
					{record.verifiedCount.toLocaleString()}
				</span>
			),
		},
		{
			key: "verificationRate",
			title: "Verification Rate",
			render: (_: unknown, record: EnrichedModel) => (
				<div className="flex items-center gap-2">
					<div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full rounded-full bg-primary"
							style={{ width: `${record.verificationRate}%` }}
						/>
					</div>
					<span className="text-xs font-mono text-muted-foreground">
						{record.verificationRate}%
					</span>
				</div>
			),
		},
		{
			key: "trend",
			title: "Trend",
			render: (_: unknown, record: EnrichedModel) => trendBadge(record.backtest?.trend || ""),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title="AI Models"
				description="Compare all 7 prediction models — accuracy, coverage, and trend analysis"
				breadcrumbs={[
					{ label: "Home", href: "/dashboard" },
					{ label: "AI", href: "/ai" },
					{ label: "Models" },
				]}
			/>

			{error && (
				<ErrorDisplay error={error} retry={() => window.location.reload()} context="model data" />
			)}

			<LoadingState loading={loading} skeletonType="stats">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<StatCard
						title="Models Active"
						value={models.length}
						icon={<Zap className="size-5" />}
						variant="primary"
					/>
					<StatCard
						title="Best MAPE"
						value={
							stats.best?.avgMape !== null && stats.best?.avgMape !== undefined
								? Number(stats.best.avgMape.toFixed(2))
								: "--"
						}
						icon={<Target className="size-5" />}
						variant="success"
					/>
					<StatCard
						title="Avg MAPE"
						value={stats.avgMape !== null ? Number(stats.avgMape.toFixed(2)) : "--"}
						icon={<Activity className="size-5" />}
						variant="default"
					/>
					<StatCard
						title="Total Predictions"
						value={models.reduce((s, m) => s + m.predictionCount, 0)}
						icon={<BarChart3 className="size-5" />}
						variant="default"
					/>
				</div>
			</LoadingState>

			<LoadingState loading={loading} skeletonType="table">
				{models.length > 0 ? (
					<>
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="text-sm font-medium">Model Comparison</CardTitle>
							</CardHeader>
							<CardBody className="p-0">
								<Table
									columns={columns}
									dataSource={models}
									rowKey="modelId"
									emptyText="No models with accuracy data"
								/>
							</CardBody>
						</Card>

						{/* MAPE comparison bar chart */}
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="text-sm font-medium">MAPE Comparison</CardTitle>
							</CardHeader>
							<CardBody>
								<div className="space-y-3">
									{models
										.filter((m) => m.avgMape !== null)
										.sort((a, b) => (a.avgMape ?? Infinity) - (b.avgMape ?? Infinity))
										.map((m) => (
											<div key={m.modelId} className="flex items-center gap-4">
												<span className="text-sm font-medium w-28 shrink-0">{m.displayName}</span>
												<div className="flex-1 h-8 bg-muted rounded-md overflow-hidden relative">
													<div
														className="h-full rounded-md transition-all duration-500"
														style={{
															width: `${Math.min(100, ((m.avgMape ?? 0) / 20) * 100)}%`,
															backgroundColor: MODEL_COLORS[m.modelId] || "#6B7280",
															opacity: 0.85,
														}}
													/>
												</div>
												<span
													className={`text-sm font-mono font-medium w-20 text-right ${
														(m.avgMape ?? 0) < 5
															? "text-green-600 dark:text-green-400"
															: (m.avgMape ?? 0) < 10
																? "text-primary"
																: "text-red-600 dark:text-red-400"
													}`}
												>
													{m.avgMape !== null ? `${m.avgMape.toFixed(2)}%` : "--"}
												</span>
											</div>
										))}
								</div>
							</CardBody>
						</Card>

						{/* Per-model backtest windows */}
						<Card>
							<CardHeader>
								<CardTitle className="text-sm font-medium">Backtest Windows</CardTitle>
							</CardHeader>
							<CardBody>
								<div className="overflow-x-auto">
									<table className="min-w-full">
										<thead>
											<tr className="border-b border-border">
												<th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
													Model
												</th>
												<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
													7-day
												</th>
												<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
													30-day
												</th>
												<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
													90-day
												</th>
												<th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">
													Trend
												</th>
											</tr>
										</thead>
										<tbody>
											{models.map((m) => (
												<tr
													key={m.modelId}
													className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
												>
													<td className="px-4 py-3">
														<span className="font-medium text-foreground">{m.displayName}</span>
													</td>
													{[7, 30, 90].map((days) => {
														const w = m.backtest?.windows?.find((bw) => bw.days === days);
														return (
															<td key={days} className="px-4 py-3 text-right">
																{w?.mape !== null && w?.mape !== undefined ? (
																	mapeBadge(w.mape)
																) : (
																	<span className="text-muted-foreground">--</span>
																)}
															</td>
														);
													})}
													<td className="px-4 py-3 text-center">
														{trendBadge(m.backtest?.trend || "")}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</CardBody>
						</Card>
					</>
				) : (
					<div className="py-12">
						<EmptyState
							type="data"
							title="No model data yet"
							description="AI model accuracy data will appear once predictions are generated and verified."
						/>
					</div>
				)}
			</LoadingState>
		</PageContainer>
	);
}
