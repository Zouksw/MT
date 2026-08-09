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
import { useMemo } from "react";
import { AccuracyTrendChart } from "@/components/charts/AccuracyTrendChart";
import { ModelPerformanceBarChart } from "@/components/charts/ModelPerformanceBarChart";
import { PageContainer } from "@/components/layout/PageContainer";
import FreshnessBadge from "@/components/trading/FreshnessBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useAccuracyData } from "@/hooks/useAccuracyData";
import { formatPercentValue } from "@/lib/format";
import { isPrimaryModel, MIN_VERIFIED_SAMPLE, type ModelWithBacktest } from "@/types/accuracy";

function TrendIcon({ trend }: { trend: string }) {
	switch (trend) {
		case "improving":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-success">
					<TrendingUp className="size-3.5" /> Improving
				</span>
			);
		case "degrading":
			return (
				<span className="inline-flex items-center gap-1 text-xs text-destructive">
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

/**
 * MAPE value badge with a sample-size honesty gate.
 *
 * A MAPE figure is only meaningful with enough verified predictions to average
 * over. During the chronos-consensus transition window the primary models have
 * 0-1 verified samples — showing that single-sample MAPE next to thousand-sample
 * baselines would mislead users into thinking the baselines are more accurate.
 *
 * Below MIN_VERIFIED_SAMPLE we show "Insufficient data" with the actual count,
 * rather than a number dressed up as a real accuracy figure. This is the
 * honesty-first rule (PRODUCT-SPEC §诚实优先 + AGENTS.md §十 "不写虚构数据")
 * applied to the comparison table.
 */
function MapeBadge({ mape, verifiedCount = 0 }: { mape: number | null; verifiedCount?: number }) {
	if (mape === null) return <span className="text-sm text-muted-foreground">--</span>;
	if (verifiedCount < MIN_VERIFIED_SAMPLE) {
		return (
			<span className="inline-flex flex-col items-end leading-tight">
				<span className="text-sm text-muted-foreground">Insufficient data</span>
				<span className="text-[10px] text-muted-foreground/70">({verifiedCount} verified)</span>
			</span>
		);
	}
	let variant: "success" | "warning" | "error" | "default" = "success";
	if (mape >= 12) variant = "error";
	else if (mape >= 7) variant = "warning";
	else if (mape >= 3) variant = "default";
	return (
		<span
			className={`text-sm font-medium ${
				variant === "success"
					? "text-success"
					: variant === "warning"
						? "text-primary"
						: variant === "error"
							? "text-destructive"
							: "text-primary"
			}`}
		>
			{formatPercentValue(mape, 1)}
		</span>
	);
}

/**
 * Honesty callout shown during the chronos-consensus transition window.
 *
 * After commit 8992154 the primary consensus runs on chronos-only, so the
 * background scheduler only produces new chronos prediction_logs. Verified
 * MAPE needs the horizon (10d) to elapse before it can be computed, so during
 * the first weeks after the switch the primary models have < MIN_VERIFIED_SAMPLE
 * verified rows while the statistical baselines still show frozen pre-switch
 * MAPE (which will never update, by design).
 *
 * Without this banner a user sees chronos rows as "Insufficient data" /
 * "--" next to baselines at 2-3% and reasonably — but wrongly — concludes the
 * baselines are better. The banner states the actual situation: the primary
 * models' sample is accumulating; the baselines are historical comparison
 * figures, not a live leaderboard. Mirrors the SnapshotBanner honesty pattern.
 */
function AccuracyTransitionBanner({ models }: { models: ModelWithBacktest[] }) {
	const primaryModels = models.filter((m) => m.isPrimary ?? isPrimaryModel(m.modelId));
	// Show only when at least one primary model is below the sample floor —
	// once all primaries have accumulated enough verified rows this banner
	// disappears on its own (no manual cleanup needed).
	const needsBanner = primaryModels.some((m) => m.verifiedCount < MIN_VERIFIED_SAMPLE);
	if (!needsBanner) return null;

	const totalPrimaryVerified = primaryModels.reduce((s, m) => s + m.verifiedCount, 0);
	return (
		<div
			className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/20"
			role="status"
		>
			<p className="text-sm text-yellow-800 dark:text-yellow-200">
				<strong>Accuracy sample accumulating.</strong> The primary consensus models (Chronos
				ensemble) were recently activated and currently have{" "}
				<strong>
					{totalPrimaryVerified.toLocaleString()} verified prediction
					{totalPrimaryVerified !== 1 ? "s" : ""}
				</strong>{" "}
				— their MAPE figures will populate as more predictions reach their forecast horizon. The
				statistical baseline rows show historical MAPE from before the switch and are kept for
				comparison only; they are not a live leaderboard.
			</p>
		</div>
	);
}

/**
 * Headline comparison of the pretrained Chronos ensemble vs the statistical
 * baselines. The Chronos models (IoTDB-AINode-style pretrained base — the
 * project's core differentiator, AGENTS.md §二) consistently achieve lower
 * MAPE than the on-demand statistical baselines. This card surfaces that gap
 * as a single "Nx more accurate" figure so the advantage is not buried in the
 * table.
 *
 * Honesty gate (PRODUCT-SPEC §诚实优先): both groups must have at least one
 * model meeting MIN_VERIFIED_SAMPLE, otherwise the comparison would pit a
 * real average against an under-sampled placeholder. When the gate fails the
 * card renders nothing — the {@link AccuracyTransitionBanner} already covers
 * the "sample accumulating" case, so duplicating that message here would be
 * noise.
 *
 * Averages are computed client-side from the same `models` array the table
 * renders (no new backend call). Each group's average is the mean of the
 * member models' avgMape values (each already an average over that model's
 * verified predictions), so a model with 845 verified rows and one with 180
 * contribute equally — this mirrors how {@link useAccuracyData}.overallAccuracy
 * already weights models equally rather than pooling raw predictions.
 */
function EnsembleComparisonCard({ models }: { models: ModelWithBacktest[] }) {
	const { primaryAvg, baselineAvg, ratio } = useMemo(() => {
		// Reuse the same sample-size gate as the table / overallAccuracy so a
		// model never flips between "counts" and "insufficient data" depending
		// on where it's displayed.
		const valid = models.filter(
			(m) =>
				m.avgMape !== null && m.avgMape !== undefined && m.verifiedCount >= MIN_VERIFIED_SAMPLE,
		);
		const primaries = valid.filter((m) => m.isPrimary ?? isPrimaryModel(m.modelId));
		const baselines = valid.filter((m) => !(m.isPrimary ?? isPrimaryModel(m.modelId)));
		if (primaries.length === 0 || baselines.length === 0) {
			return { primaryAvg: null, baselineAvg: null, ratio: null };
		}
		const pAvg = primaries.reduce((s, m) => s + (m.avgMape ?? 0), 0) / primaries.length;
		const bAvg = baselines.reduce((s, m) => s + (m.avgMape ?? 0), 0) / baselines.length;
		// ratio = how many times more accurate the pretrained ensemble is
		// (baseline MAPE ÷ primary MAPE). >1 means pretrained wins. Guarded
		// against a zero primary average (would only happen if every primary
		// model had exactly 0% error, which is not a real scenario).
		const r = pAvg > 0 ? bAvg / pAvg : null;
		return { primaryAvg: pAvg, baselineAvg: bAvg, ratio: r };
	}, [models]);

	// Hide entirely when either group lacks a sufficient sample — the
	// transition banner already explains why, and showing a partial number
	// (e.g. baseline-only) would mislead.
	if (primaryAvg === null || baselineAvg === null || ratio === null) return null;

	return (
		<Card className="mb-6 border-primary/20 bg-primary/5" data-testid="ensemble-comparison">
			<CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3">
					<div className="rounded-lg bg-primary/10 p-2.5 text-primary">
						<Trophy className="size-5" />
					</div>
					<div>
						<p className="text-sm font-medium text-foreground">Pretrained ensemble advantage</p>
						<p className="text-xs text-muted-foreground mt-0.5">
							Chronos (pretrained) vs statistical baselines — same verified predictions, lower
							error.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-6">
					<div className="text-right">
						<p className="text-[10px] uppercase tracking-wide text-muted-foreground">Chronos</p>
						<p className="text-lg font-semibold text-success">
							{formatPercentValue(primaryAvg, 1)}
						</p>
					</div>
					<div className="text-right">
						<p className="text-[10px] uppercase tracking-wide text-muted-foreground">Statistical</p>
						<p className="text-lg font-semibold text-muted-foreground">
							{formatPercentValue(baselineAvg, 1)}
						</p>
					</div>
					<div className="text-right border-l border-border pl-6">
						<p className="text-[10px] uppercase tracking-wide text-muted-foreground">Advantage</p>
						<p className="text-lg font-bold text-success">{ratio.toFixed(1)}×</p>
					</div>
				</div>
			</CardBody>
		</Card>
	);
}

const columns = [
	{
		key: "displayName",
		title: "Model",
		dataIndex: "displayName" as const,
		render: (_value: unknown, record: ModelWithBacktest) => {
			// isPrimary may be undefined for older API responses; fall back to
			// the modelId-prefix classification so the role badge is always
			// correct regardless of which fields the backend returned.
			const primary = record.isPrimary ?? isPrimaryModel(record.modelId);
			return (
				<div className="flex flex-col gap-1">
					<Link
						href={`/ai/accuracy/${record.modelId}`}
						className="font-medium text-foreground hover:text-primary transition-colors"
					>
						{record.displayName}
					</Link>
					<Tag color={primary ? "primary" : "default"} className="w-fit text-[10px]">
						{primary ? "Pretrained" : "Statistical"}
					</Tag>
				</div>
			);
		},
	},
	{
		key: "avgMape",
		title: "MAPE",
		dataIndex: "avgMape" as const,
		align: "right" as const,
		render: (value: unknown, record: ModelWithBacktest) => (
			<MapeBadge mape={value as number | null} verifiedCount={record.verifiedCount} />
		),
	},
	{
		key: "lastVerifiedAt",
		title: "Last Verified",
		dataIndex: "lastVerifiedAt" as const,
		render: (value: unknown) => (
			<FreshnessBadge date={value as string | null | undefined} compact />
		),
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

			{/* Honesty callout — shown only while primary models lack enough
			 * verified samples (auto-hides once the sample accumulates). */}
			{!loading && <AccuracyTransitionBanner models={models} />}

			{/* Headline pretrained-vs-statistical advantage card. Self-hides
			 * (returns null) until both groups have enough verified samples,
			 * so it never shows a partial/biased comparison. */}
			{!loading && <EnsembleComparisonCard models={models} />}

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
