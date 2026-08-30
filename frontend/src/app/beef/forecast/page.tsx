"use client";

import { ArrowRight, CalendarClock, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BeefBacktestSection from "@/components/ai/BeefBacktestSection";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBeefMonthlyConsensus } from "@/hooks/useBeefMonthlyConsensus";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Beef forecast center (IMPROVEMENT-PLAN v3.1.0 批5) — the user-visible face
 * of the beef monthly prediction chain: 下月共识卡 (quality-weighted
 * consensus over the IMF PBEEFUSDM benchmark, horizon=1 MONTH), the rolling
 * backtest evidence (批1), an honest verification timeline (nothing here
 * claims unverified skill), and the upstream futures panel (live/feeder
 * cattle — the leading indicators 批3 will test).
 *
 * Login-gated like the rest of /beef (middleware PUBLIC_PATHS excludes it);
 * the public trust surface stays on /ai/track-record.
 */

interface UpstreamQuote {
	slug: string;
	name: string;
	unit: string;
	close: number | null;
	date: string | null;
}

const UPSTREAM_SLUGS = ["live_cattle_cme", "feeder_cattle_cme"] as const;

function useUpstreamQuotes() {
	const [quotes, setQuotes] = useState<UpstreamQuote[]>([]);
	const [error, setError] = useState<Error | null>(null);

	const load = useCallback(async () => {
		try {
			const results = await Promise.allSettled(
				UPSTREAM_SLUGS.map((slug) =>
					apiFetch<{
						data: {
							commodity: { slug: string; name: string; unit: string };
							price: { close: number | string | null; date: string } | null;
						};
					}>(`/api/market/commodities/${slug}/latest`),
				),
			);
			setQuotes(
				results.map((r, i) => {
					const slug = UPSTREAM_SLUGS[i];
					if (r.status !== "fulfilled" || !r.value.data) {
						return { slug, name: slug, unit: "", close: null, date: null };
					}
					const { commodity, price } = r.value.data;
					return {
						slug,
						name: commodity?.name ?? slug,
						unit: commodity?.unit ?? "",
						close: price?.close != null ? Number(price.close) : null,
						date: price?.date ?? null,
					};
				}),
			);
		} catch (e) {
			setError(e instanceof Error ? e : new Error("Failed to fetch upstream quotes"));
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	return { quotes, error };
}

function ConsensusCard({
	consensus,
	loading,
}: {
	consensus: ReturnType<typeof useBeefMonthlyConsensus>["consensus"];
	loading: boolean;
}) {
	if (loading) {
		return (
			<Card>
				<CardBody className="animate-pulse" aria-busy="true">
					<div className="h-24" />
				</CardBody>
			</Card>
		);
	}
	if (!consensus) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="size-4" /> 下月共识 · 牛肉基准
					</CardTitle>
				</CardHeader>
				<CardBody>
					<div className="text-2xl font-display font-semibold text-muted-foreground">
						暂无共识信号
					</div>
					<p className="text-xs text-muted-foreground mt-1">
						IMF 月度基准数据就绪后自动生成（数据缺失或未登录时不显示假数字）。
					</p>
				</CardBody>
			</Card>
		);
	}
	const up = consensus.direction === "up";
	const down = consensus.direction === "down";
	const color = up ? "#16A34A" : down ? "#DC2626" : "#8B6914";
	const Arrow = up ? TrendingUp : down ? TrendingDown : Sparkles;
	const sign = up ? "+" : down ? "−" : "";
	const unitLabel = consensus.horizonUnit === "month" ? "个月" : "天";
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="size-4" /> 下月共识 · 牛肉基准（IMF PBEEFUSDM）
				</CardTitle>
				<span className="text-xs text-muted-foreground">
					H = {consensus.horizon} {unitLabel}
				</span>
			</CardHeader>
			<CardBody>
				<div className="flex items-end gap-3">
					<Arrow className="size-8" style={{ color }} />
					<span
						className="text-4xl font-display font-semibold tabular-nums leading-none"
						style={{ color }}
					>
						{sign}
						{Math.abs(consensus.predictedChange).toFixed(1)}%
					</span>
					<span className="text-sm text-muted-foreground pb-1">
						{consensus.currentPrice.toFixed(2)} → {consensus.predictedPrice.toFixed(2)} USD
					</span>
				</div>
				<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
					<div>
						模型分歧区间
						<div className="text-sm text-foreground tabular-nums">
							{consensus.rangeLower.toFixed(2)} – {consensus.rangeUpper.toFixed(2)}
						</div>
					</div>
					<div>
						置信度
						<div className="text-sm text-foreground tabular-nums">
							{(consensus.confidence * 100).toFixed(0)}%
						</div>
					</div>
					<div>
						模型一致
						<div className="text-sm text-foreground tabular-nums">
							{consensus.modelsAgree}/{consensus.availableModels}
						</div>
					</div>
				</div>
				<p className="mt-3 text-xs text-muted-foreground">
					质量加权共识（7 模型，naive 淘汰线 + 按序列路由）。校准 90% 区间待首批滚动验证（2026-09
					起）成熟后接入——在此之前不显示未经校准的区间数字。
				</p>
			</CardBody>
		</Card>
	);
}

export default function BeefForecastPage() {
	const { consensus, loading, error, retry } = useBeefMonthlyConsensus(1);
	const { quotes } = useUpstreamQuotes();

	return (
		<PageContainer>
			<PageHeader
				title="牛肉价格预测"
				description="IMF 月度基准的下月 AI 共识、滚动回测证据、验证时间线与上游期货"
				breadcrumbs={[
					{ label: "Home", href: "/dashboard" },
					{ label: "牛肉行情", href: "/beef" },
					{ label: "AI 预测" },
				]}
			/>

			{error && <ErrorDisplay error={error} retry={retry} context="牛肉月度共识" />}

			<div className="mt-6 grid gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<ConsensusCard consensus={consensus} loading={loading} />
				</div>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CalendarClock className="size-4" /> 验证时间线（诚实预告）
						</CardTitle>
					</CardHeader>
					<CardBody className="text-xs leading-relaxed text-muted-foreground">
						<ul className="space-y-2">
							<li>
								<span className="font-medium text-foreground">2026-09 / 10</span>
								：首个 H=1 月度滚动验证到期 —— 预测 vs 实际的 MAPE 与方向命中自动入榜。
							</li>
							<li>
								<span className="font-medium text-foreground">2026-11</span>
								：H=3（下季度）验证到期；牛肉序列自身权重预计激活（≥20 条验证行门槛，180d 窗）。
							</li>
							<li>
								<span className="font-medium text-foreground">现在</span>
								：全部预测在下发时落库、可审计；公开对错记录见{" "}
								<Link
									href="/ai/track-record"
									className="inline-flex items-center gap-0.5 text-primary hover:underline"
								>
									track record <ArrowRight className="size-3" />
								</Link>
								。
							</li>
						</ul>
						<p className="mt-3 border-t border-black/5 pt-2 dark:border-white/10">
							回测（36 个月度起点 × 7 模型）显示月度基准的可预测上限就在 naive 附近 ——
							我们展示共识与证据，不承诺超额精度。
						</p>
					</CardBody>
				</Card>
			</div>

			{/* 上游面板：活牛 / 架子牛期货（日更，批 3 领先指标实验的候选） */}
			<Card className="mt-4">
				<CardHeader>
					<CardTitle>上游期货（日更）</CardTitle>
				</CardHeader>
				<CardBody className="grid gap-3 sm:grid-cols-2">
					{quotes.length === 0 && (
						<div className="text-xs text-muted-foreground animate-pulse">加载上游报价…</div>
					)}
					{quotes.map((q) => (
						<div
							key={q.slug}
							className="rounded-lg border bg-card p-3 flex items-center justify-between"
						>
							<div>
								<div className="text-sm font-medium text-foreground">{q.name}</div>
								<div className="text-xs text-muted-foreground">
									{q.date ? new Date(q.date).toLocaleDateString("zh-CN") : "—"}
									{q.unit ? ` · ${q.unit}` : ""}
								</div>
							</div>
							<div className="text-lg font-display font-semibold tabular-nums text-foreground">
								{q.close != null ? q.close.toFixed(2) : "—"}
							</div>
						</div>
					))}
				</CardBody>
			</Card>

			{/* 回测证据面板（批 1，与公开 track-record 同源） */}
			<div className="mt-4">
				<BeefBacktestSection />
			</div>

			{/* 相关工具（v3.2.0 批 3）：进口成本计算器（公开页，RMB/kg 到岸参考） */}
			<div className="mt-4">
				<Link
					href="/tools/landing-cost"
					className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				>
					进口成本计算器（到岸 RMB/kg 参考，公开页）
					<ArrowRight className="h-3 w-3" />
				</Link>
			</div>
		</PageContainer>
	);
}
