"use client";

import {
	BarChart3,
	CircleCheck,
	Minus,
	Target,
	TrendingDown,
	TrendingUp,
	Trophy,
} from "lucide-react";
import Link from "next/link";
import { AccuracyTrendChart } from "@/components/charts/AccuracyTrendChart";
import { ModelPerformanceBarChart } from "@/components/charts/ModelPerformanceBarChart";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { useAccuracyData } from "@/hooks/useAccuracyData";
import type { ModelWithBacktest } from "@/types/accuracy";

function TrendIcon({ trend }: { trend: string }) {
	switch (trend) {
		case "improving":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
					<TrendingUp className="size-3.5" /> Improving
				</span>
			);
		case "degrading":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
					<TrendingDown className="size-3.5" /> Degrading
				</span>
			);
		case "stable":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
					<Minus className="size-3.5" /> Stable
				</span>
			);
		default:
			return <span className="text-xs text-muted-foreground">Insufficient data</span>;
	}
}

function MapeBadge({ mape }: { mape: number | null }) {
	if (mape === null) return <span className="text-sm text-muted-foreground">--</span>;
	let variant: "success" | "warning" | "error" | "default" = "success";
	if (mape >= 12) variant = "error";
	else if (mape >= 7) variant = "warning";
	else if (mape >= 3) variant = "default";
	return (
		<span
			className={`text-sm font-medium ${
				variant === "success"
					? "text-green-600 dark:text-green-400"
					: variant === "warning"
						? "text-primary"
						: variant === "error"
							? "text-red-600 dark:text-red-400"
							: "text-primary"
			}`}
		>
			{mape.toFixed(1)}%
		</span>
	);
}

const columns = [
	{
		key: "displayName",
		title: "Model",
		dataIndex: "displayName" as const,
		render: (_value: unknown, record: ModelWithBacktest) => (
			<Link
				href={`/ai/accuracy/${record.modelId}`}
				className="font-medium text-foreground hover:text-primary transition-colors"
			>
				{record.displayName}
			</Link>
		),
	},
	{
		key: "avgMape",
		title: "MAPE",
		dataIndex: "avgMape" as const,
		align: "right" as const,
		render: (value: unknown) => <MapeBadge mape={value as number | null} />,
	},
	{
		key: "trend",
		title: "Trend",
		render: (_value: unknown, record: ModelWithBacktest) => (
			<TrendIcon trend={record.backtest?.trend || "insufficient_data"} />
		),
	},
	{
		key: "predictionCount",
		title: "Predictions",
		dataIndex: "predictionCount" as const,
		align: "right" as const,
		render: (value: number) => (
			<span className="text-sm text-muted-foreground">{(value as number).toLocaleString()}</span>
		),
	},
	{
		key: "verifiedCount",
		title: "Verified",
		dataIndex: "verifiedCount" as const,
		align: "right" as const,
		render: (value: unknown) => (
			<span className="text-sm text-muted-foreground">{(value as number).toLocaleString()}</span>
		),
	},
];

export default function AccuracyPage() {
	const {
		models,
		overallAccuracy,
		bestModel,
		totalPredictions,
		totalVerified,
		loading,
		error,
		retry,
	} = useAccuracyData();

	if (error) {
		return (
			<PageContainer>
				<PageHeader
					title="Prediction Accuracy"
					description="Monitor AI model performance and prediction accuracy over time"
					breadcrumbs={[
						{ label: "Home", href: "/dashboard" },
						{ label: "AI", href: "/ai/models" },
						{ label: "Accuracy" },
					]}
				/>
				<ErrorDisplay error={error} retry={retry} context="accuracy data" />
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Prediction Accuracy"
				description="Monitor AI model performance and prediction accuracy over time"
				breadcrumbs={[
					{ label: "Home", href: "/dashboard" },
					{ label: "AI", href: "/ai/models" },
					{ label: "Accuracy" },
				]}
			/>

			<LoadingState loading={loading} skeletonType="stats">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<StatCard
						title="Overall Accuracy"
						value={overallAccuracy !== null ? Number(overallAccuracy.toFixed(1)) : "--"}
						icon={<Target className="size-5" />}
						variant="primary"
						trend={
							overallAccuracy !== null
								? {
										value: Number(Math.max(0, 100 - overallAccuracy).toFixed(0)),
										isPositive: overallAccuracy < 10,
									}
								: undefined
						}
					/>
					<StatCard
						title="Best Model"
						value={bestModel?.displayName ?? "--"}
						icon={<Trophy className="size-5" />}
						variant="default"
					/>
					<StatCard
						title="Total Predictions"
						value={totalPredictions}
						icon={<BarChart3 className="size-5" />}
						variant="default"
					/>
					<StatCard
						title="Verified"
						value={totalVerified}
						icon={<CircleCheck className="size-5" />}
						variant="success"
					/>
				</div>
			</LoadingState>

			<LoadingState loading={loading} skeletonType="table">
				<Card className="mb-6">
					<CardHeader>
						<CardTitle className="text-sm font-medium">Model Comparison</CardTitle>
					</CardHeader>
					<CardBody className="p-0">
						{models.length > 0 ? (
							<Table
								columns={columns}
								dataSource={models}
								rowKey="modelId"
								emptyText="No models with accuracy data"
							/>
						) : (
							<div className="py-12">
								<EmptyState
									type="data"
									title="No accuracy data yet"
									description="Prediction accuracy will appear here once models have generated and verified predictions."
								/>
							</div>
						)}
					</CardBody>
				</Card>
			</LoadingState>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<AccuracyTrendChart models={models} />
				<ModelPerformanceBarChart models={models} />
			</div>
		</PageContainer>
	);
}
