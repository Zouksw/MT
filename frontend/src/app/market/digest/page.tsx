"use client";

/**
 * Public Chinese market digest (IMPROVEMENT-PLAN v3.3.0 batch 1, promoted
 * from v3.0.0 batch B). The SEO long-tail acquisition surface: every number
 * is auto-aggregated from whitelisted international series (IMF beef
 * benchmark / CME cattle futures / FX) via GET /api/market/public/digest —
 * zero human editorial input, zero "analyst insight" copy, honest degrade
 * when a series is stale or down. Companion surfaces: the landing-cost
 * calculator and the public prediction track record.
 */

import { ArrowRight, BadgeCheck, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { type DigestSeries, useMarketDigest } from "@/hooks/useMarketDigest";

const CATEGORY_LABELS: Record<string, string> = {
	beef_cuts: "牛肉基准",
	proteins: "蛋白基准",
	futures: "牲畜期货",
	forex: "汇率",
};

/** Display order: benchmark & cattle futures first, FX last. */
const CATEGORY_ORDER = ["beef_cuts", "proteins", "futures", "forex"];

/** Human-readable staleness window per cadence — must mirror the backend's
 * cadence.ts (7 daily / 21 weekly / 90 monthly, plus FX publication overrides)
 * so the 数据滞后 badge is self-explaining instead of reading as arbitrary. */
const STALE_WINDOW_NOTE: Record<string, string> = {
	daily: "日度序列 · 超过 7 天未更新标注滞后（汇率类为 14 天）",
	weekly: "周度序列 · 超过 21 天未更新标注滞后",
	monthly: "月度序列 · 超过 90 天未更新标注滞后",
};

function fmtDate(iso: string | null | undefined) {
	if (!iso) return "—";
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("zh-CN");
}

function fmtChange(v: number | null | undefined) {
	if (v === null || v === undefined || !Number.isFinite(v)) return null;
	const up = v > 0;
	return (
		<span
			className={`inline-flex items-center gap-1 font-mono tabular-nums ${
				up ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground"
			}`}
		>
			{up ? <TrendingUp size={14} /> : v < 0 ? <TrendingDown size={14} /> : null}
			{up ? "+" : ""}
			{v.toFixed(2)}%
		</span>
	);
}

function SeriesCard({ entry }: { entry: DigestSeries }) {
	const label = entry.nameCn || entry.name || entry.slug;
	const unitLabel = entry.unit === "rate" ? "" : ` ${entry.unit ?? ""}`;
	const wow = entry.interval === "monthly" ? null : (entry.wowChangePct ?? null);
	const mom =
		entry.interval === "monthly"
			? (entry.momChangePct ?? entry.prevPointChangePct ?? null)
			: (entry.prevPointChangePct ?? null);

	if (entry.status !== "ok" || !entry.latest) {
		return (
			<Card>
				<CardBody className="space-y-1.5">
					<div className="flex items-center justify-between">
						<span className="font-medium">{label}</span>
						<span className="text-xs text-muted-foreground">
							{CATEGORY_LABELS[entry.category ?? ""] ?? ""}
						</span>
					</div>
					<p className="text-sm text-muted-foreground">
						{entry.status === "no_data" ? "数据源维护中" : "暂不可用"}
					</p>
				</CardBody>
			</Card>
		);
	}

	return (
		<Card>
			<CardBody className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium">{label}</span>
					<span className="flex items-center gap-1.5">
						{entry.stale && (
							<span
								className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400"
								title={STALE_WINDOW_NOTE[entry.interval ?? "daily"]}
							>
								数据滞后
							</span>
						)}
						<span className="text-xs text-muted-foreground">
							{CATEGORY_LABELS[entry.category ?? ""] ?? ""}
						</span>
					</span>
				</div>
				<div className="flex items-baseline gap-2">
					<span className="font-mono text-2xl tabular-nums">{entry.latest.close}</span>
					<span className="text-xs text-muted-foreground">{unitLabel.trim()}</span>
					<span className="ml-auto text-xs text-muted-foreground">
						{fmtDate(entry.latest.date)}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
					{wow !== null && (
						<span className="flex items-center gap-1">
							<span className="text-muted-foreground">本周</span>
							{fmtChange(wow)}
						</span>
					)}
					{mom !== null ? (
						<span className="flex items-center gap-1">
							<span className="text-muted-foreground">
								{entry.interval === "monthly" ? "环比" : "较上期"}
							</span>
							{fmtChange(mom)}
						</span>
					) : (
						/* A single-point series (first publication) has no prior point —
						   saying so beats a bare "—". */
						<span className="text-muted-foreground">首期，暂无对比</span>
					)}
				</div>
				{entry.seriesId && (
					<p className="text-xs text-muted-foreground">
						源：{entry.latest.source} · {entry.seriesId}
					</p>
				)}
			</CardBody>
		</Card>
	);
}

export default function MarketDigestPage() {
	const { digest, loading, error, retry } = useMarketDigest();

	const okCount = digest?.series.filter((s) => s.status === "ok").length ?? 0;
	const ordered = [...(digest?.series ?? [])].sort(
		(a, b) => CATEGORY_ORDER.indexOf(a.category ?? "") - CATEGORY_ORDER.indexOf(b.category ?? ""),
	);

	return (
		<PageContainer>
			<PageHeader
				title="今日牛肉国际行情"
				description="全球牛肉基准、活牛期货与主要汇率——国际公开源序列自动聚合，每日更新，全部数字可溯源"
				breadcrumbs={[{ label: "首页", href: "/landing" }, { label: "行情摘要" }]}
			/>

			{error && <ErrorDisplay error={error} />}

			{loading ? (
				<div className="h-40 animate-pulse rounded-lg bg-muted" />
			) : (
				<div className="space-y-6">
					{digest && (
						<p className="text-sm text-muted-foreground">
							{digest.generatedAt
								? `聚合时间 ${new Date(digest.generatedAt).toLocaleString("zh-CN")} · ${okCount}/${digest.series.length} 条序列在线`
								: ""}
						</p>
					)}

					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{ordered.map((entry) => (
							<SeriesCard key={entry.slug} entry={entry} />
						))}
					</div>

					{/* Companion acquisition surfaces — same real-data discipline. */}
					<div className="grid gap-4 sm:grid-cols-2">
						<Link
							href="/tools/landing-cost"
							className="group rounded-lg border p-4 transition-colors hover:border-primary/50"
						>
							<div className="flex items-center gap-2 font-medium">
								<Gauge className="h-4 w-4 text-primary" />
								进口到岸成本怎么算？
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								以上游基准价 × 汇率，加上你自己的关税/运费参数，得出 RMB/kg 到岸参考区间。
							</p>
							<span className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
								打开计算器{" "}
								<ArrowRight
									size={14}
									className="transition-transform group-hover:translate-x-0.5"
								/>
							</span>
						</Link>
						<Link
							href="/ai/track-record"
							className="group rounded-lg border p-4 transition-colors hover:border-primary/50"
						>
							<div className="flex items-center gap-2 font-medium">
								<BadgeCheck className="h-4 w-4 text-primary" />
								预测准不准？看对错档案
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								每条预测带时间戳留档，实际值到期自动回填——滚动准确率公开可查。
							</p>
							<span className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
								查看战绩{" "}
								<ArrowRight
									size={14}
									className="transition-transform group-hover:translate-x-0.5"
								/>
							</span>
						</Link>
					</div>

					<p className="text-xs text-muted-foreground">
						数据说明：本页全部数字来自国际公开数据源（IMF / CME /
						FRED），由平台自动聚合，无人工编辑； 序列断流或滞后时如实标注，不提供任何"分析师观点"。
					</p>

					{error && (
						<button
							type="button"
							onClick={() => retry()}
							className="text-sm text-primary underline"
						>
							重试
						</button>
					)}
				</div>
			)}

			{/* Feedback — deliberately OUTSIDE the data-loaded branch: when the
			    data is broken or stale is exactly when feedback matters most. */}
			<p className="text-xs text-muted-foreground">
				数据有误或建议改进？
				<a
					href="https://github.com/Zouksw/MT/issues"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline"
				>
					反馈到项目仓库
				</a>
			</p>
		</PageContainer>
	);
}
