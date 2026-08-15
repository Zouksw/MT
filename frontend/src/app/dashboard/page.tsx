"use client";

import {
	Beef,
	Bell,
	Database,
	Globe,
	Lock,
	Newspaper,
	Sparkles,
	TrendingDown,
	TrendingUp,
	User,
	Warehouse,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import { CutForecastCell } from "@/components/beef/CutForecastCell";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatCard, type TrendIndicator } from "@/components/ui/StatCard";
import { useAuth } from "@/contexts/auth";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCompact, formatPrice } from "@/lib/format";
import { useIsMobile } from "@/lib/responsive-utils";
import { getCachedUser } from "@/utils/auth";

const ForecastTrendChart = dynamic(
	() =>
		import("@/components/dashboard/ForecastTrendChart").then((mod) => ({
			default: mod.ForecastTrendChart,
		})),
	{ loading: () => <div className="bg-muted animate-pulse rounded-lg" style={{ height: 300 }} /> },
);
const AlertDistributionChart = dynamic(
	() =>
		import("@/components/dashboard/AlertDistributionChart").then((mod) => ({
			default: mod.AlertDistributionChart,
		})),
	{ loading: () => <div className="bg-muted animate-pulse rounded-lg" style={{ height: 300 }} /> },
);

// Module-level icon instances — StatCard is React.memo, so passing inline
// JSX (<Globe className="size-5" />) on every render creates a new React
// element reference and defeats the shallow comparison, causing all 6 cards
// to re-render (and re-run useAnimatedCounter) on every parent render. These
// icons are static, so hoisting them to module scope keeps their reference
// stable across renders.
const IMPORTED_ICON = <Globe className="size-5" />;
const DOMESTIC_ICON = <Beef className="size-5" />;
const FACTORY_ICON = <Warehouse className="size-5" />;
const RECORDS_ICON = <TrendingUp className="size-5" />;
const DATASET_ICON = <Database className="size-5" />;
const ALERT_ICON = <Bell className="size-5" />;

/**
 * AI 7-day prediction hero card (PRODUCT-SPEC §5.1).
 *
 * Surfaces the headline cut's consensus: direction arrow + predicted change +
 * confidence + model agreement. Direction drives the color (green up / red
 * down / muted flat) — the only place direction is allowed to set color per
 * the dashboard design rule. Shows an honest empty state ("Awaiting signal")
 * when no cut is forecastable (no price data / no token) instead of a fake
 * arrow.
 */
function AIPredictionCard({
	summary,
	loading,
}: {
	summary: {
		direction: "up" | "down" | "flat";
		changePct: number;
		confidence: number;
		modelsAgree: number;
		totalModels: number;
		cutName: string;
	} | null;
	loading: boolean;
}) {
	if (loading) {
		return (
			<div className="rounded-xl border bg-card p-5 animate-pulse h-[112px]" aria-busy="true" />
		);
	}
	if (!summary) {
		return (
			<div className="rounded-xl border bg-card p-5">
				<div className="flex items-center gap-2 mb-1 text-muted-foreground">
					<Sparkles className="size-4" />
					<span className="text-sm font-medium">AI 7日预测</span>
				</div>
				<div className="text-2xl font-display font-semibold text-muted-foreground">
					Awaiting signal
				</div>
				<p className="text-xs text-muted-foreground mt-1">
					Forecasts appear once price data is available.
				</p>
			</div>
		);
	}
	const up = summary.direction === "up";
	const down = summary.direction === "down";
	const color = up ? "#16A34A" : down ? "#DC2626" : "#8B6914";
	const Arrow = up ? TrendingUp : down ? TrendingDown : Sparkles;
	const sign = up ? "+" : down ? "−" : "";
	return (
		<div className="rounded-xl border bg-card p-5">
			<div className="flex items-center gap-2 mb-1 text-muted-foreground">
				<Sparkles className="size-4" />
				<span className="text-sm font-medium">AI 7日预测</span>
				<span className="text-xs text-muted-foreground/70">· {summary.cutName}</span>
			</div>
			<div className="flex items-end gap-2">
				<Arrow className="size-7" style={{ color }} />
				<span
					className="text-3xl font-display font-semibold tabular-nums leading-none"
					style={{ color, fontVariantNumeric: "tabular-nums" }}
				>
					{sign}
					{Math.abs(summary.changePct).toFixed(1)}%
				</span>
			</div>
			<p className="text-xs text-muted-foreground mt-1.5">
				置信度 {(summary.confidence * 100).toFixed(0)}% · 模型 {summary.modelsAgree}/
				{summary.totalModels}
			</p>
		</div>
	);
}

export default function DashboardPage() {
	const { stats, loading, error, manualRetry } = useDashboardStats();
	const { status, user: authUser, logout } = useAuth();
	const isMobile = useIsMobile();
	// Session truth from AuthContext (cookie-verified on mount). The old
	// `!!getAuthToken()` read only the in-memory token, so a page refresh
	// rendered the signed-out prompt forever despite a valid cookie session.
	const isAuthenticated = status === "authenticated";
	// Profile from the context (fresh from /auth/me); cached user is only a
	// pre-hydration fallback for the first paint.
	const cached = getCachedUser();
	const user = authUser ?? (cached ? { ...cached, name: cached.name ?? null } : null);
	const handleLogout = useCallback(() => void logout(), [logout]);

	const beef = stats?.beef;

	// Memoize the trend objects passed to StatCard — they depend only on the
	// beef trend % values, but constructing them inline in JSX creates a new
	// object each render and defeats StatCard's React.memo shallow compare.
	const importedTrend = useMemo<TrendIndicator | undefined>(
		() =>
			beef?.importedTrendPct == null
				? undefined
				: { value: Math.abs(beef.importedTrendPct), isPositive: beef.importedTrendPct >= 0 },
		[beef?.importedTrendPct],
	);
	const domesticTrend = useMemo<TrendIndicator | undefined>(
		() =>
			beef?.domesticTrendPct == null
				? undefined
				: { value: Math.abs(beef.domesticTrendPct), isPositive: beef.domesticTrendPct >= 0 },
		[beef?.domesticTrendPct],
	);
	const alertsTrend = useMemo<TrendIndicator | undefined>(
		() =>
			stats?.alerts?.trend == null
				? undefined
				: { value: Math.abs(stats.alerts.trend), isPositive: stats.alerts.trend < 0 },
		[stats?.alerts?.trend],
	);

	return (
		<PageContainer>
			{error && <ErrorDisplay error={error} retry={manualRetry} context="Dashboard" />}

			{!isAuthenticated && (
				<div className="flex flex-col items-center justify-center py-20 text-center">
					<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
						<Lock className="size-7 text-primary" />
					</div>
					<h2 className="text-h2 font-display font-semibold text-foreground mb-2">
						Sign in to your dashboard
					</h2>
					<p className="text-body text-muted-foreground mb-6 max-w-md">
						Track beef cut prices across global markets, AI price forecasts, and export trade flows.
					</p>
					<a href="/login">
						<Button variant="primary" size="lg">
							Sign In
						</Button>
					</a>
				</div>
			)}

			{isAuthenticated && (
				<LoadingState loading={loading} timeout={15000}>
					<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
						<div>
							<h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground mb-1">
								Welcome back, {user?.name || "User"}
							</h1>
							<p className="text-body text-muted-foreground">
								Beef trade analytics at a glance — live prices, AI signals, and market movements.
							</p>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={handleLogout}
								className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-primary/40"
							>
								Sign out
							</button>
							<div
								className="flex items-center justify-center border-2 border-primary rounded-2xl bg-primary/10 text-primary overflow-hidden"
								style={{
									width: isMobile ? 40 : 48,
									height: isMobile ? 40 : 48,
									minWidth: isMobile ? 40 : 48,
								}}
							>
								{user?.avatar ? (
									// biome-ignore lint/performance/noImgElement: dynamic user avatar from unknown domain
									<img
										src={user.avatar}
										alt=""
										className="w-full h-full object-cover rounded-2xl"
									/>
								) : (
									<User className={isMobile ? "size-[18px]" : "size-[22px]"} />
								)}
							</div>
						</div>
					</div>

					{/* KPI HERO — three headline cards per PRODUCT-SPEC §5.1:
					 * 进口均价 (imported avg) / 国产均价 (domestic avg) / AI 7日预测.
					 * Each surfaces an honest "--" when its data source is empty rather
					 * than fabricating a number. The AI card's directional color comes
					 * from the consensus direction (green up / red down / muted flat). */}
					<div
						className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6"
						aria-live="polite"
						aria-atomic="true"
					>
						<StatCard
							title="进口均价 (Imported)"
							value={formatPrice(beef?.importedAvg ?? null, false)}
							suffix="/kg"
							icon={IMPORTED_ICON}
							variant="primary"
							loading={loading}
							// Day-over-day % change in the imported average (round-57).
							// Mirrors the spec §5.1 mockup's ↓1.2%/↑0.5% trend badge. Null
							// (no prior day) hides the badge — honest absence, not a fake 0.
							trend={importedTrend}
						/>
						<StatCard
							title="国产均价 (Domestic)"
							value={formatPrice(beef?.domesticAvg ?? null, false)}
							suffix="/kg"
							icon={DOMESTIC_ICON}
							variant="info"
							loading={loading}
							trend={domesticTrend}
						/>
						<AIPredictionCard summary={stats?.aiSummary ?? null} loading={loading} />
					</div>

					{/* 行情总览 — hot cuts table + news strip (PRODUCT-SPEC §5.1).
					 * Two-column on lg: left = top-priced cuts with origin; right = latest
					 * market news. Collapses to stacked on smaller screens. */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
						<div className="lg:col-span-2 rounded-xl border bg-card">
							<div className="flex items-center justify-between px-5 py-4 border-b">
								<h2 className="text-h4 font-display font-semibold text-foreground">热门部位价格</h2>
								<a href="/beef" className="text-xs text-primary hover:underline">
									全部 →
								</a>
							</div>
							{(beef?.hotCuts?.length ?? 0) > 0 ? (
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="text-left text-xs text-muted-foreground border-b">
												<th className="px-5 py-2 font-medium">部位 Cut</th>
												<th className="px-3 py-2 font-medium text-left">产地</th>
												<th className="px-5 py-2 font-medium text-right">今日价</th>
												<th className="px-5 py-2 font-medium text-left">7d Forecast</th>
											</tr>
										</thead>
										<tbody>
											{beef?.hotCuts?.map((c) => (
												<tr key={c.cutCode} className="border-b last:border-0 hover:bg-muted/40">
													<td className="px-5 py-3">
														<a
															href={`/beef/cuts/${c.cutCode}`}
															className="font-medium text-foreground hover:text-primary"
														>
															{c.cutCode.replace(/_/g, " ")}
														</a>
													</td>
													<td className="px-3 py-3 text-muted-foreground">{c.country}</td>
													<td
														className="px-5 py-3 text-right font-mono tabular-nums text-foreground"
														style={{ fontVariantNumeric: "tabular-nums" }}
													>
														{formatPrice(c.price, false)}
													</td>
													<td className="px-5 py-3">
														<CutForecastCell forecast={c.forecast} />
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<div className="p-8 text-center text-sm text-muted-foreground">
									No beef cut prices yet. The hot-cuts table will populate once price data is
									ingested.
								</div>
							)}
						</div>

						{/* 最新市场动态 — latest 5 news items (PRODUCT-SPEC §5.1). */}
						<div className="rounded-xl border bg-card">
							<div className="flex items-center justify-between px-5 py-4 border-b">
								<div className="flex items-center gap-2">
									<Newspaper className="size-4 text-primary" />
									<h2 className="text-h4 font-display font-semibold text-foreground">
										最新市场动态
									</h2>
								</div>
								<a href="/market-news" className="text-xs text-primary hover:underline">
									更多 →
								</a>
							</div>
							{(stats?.recentNews?.length ?? 0) > 0 ? (
								<ul className="divide-y">
									{stats?.recentNews?.map((n) => (
										<li key={n.id}>
											<a
												href={`/market-news/show/${n.id}`}
												className="block px-5 py-3 hover:bg-muted/40 transition-colors"
											>
												<div className="text-sm font-medium text-foreground line-clamp-2">
													{n.title}
												</div>
												<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
													<span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
														{n.category}
													</span>
													<span>{n.source}</span>
												</div>
											</a>
										</li>
									))}
								</ul>
							) : (
								<div className="p-8 text-center text-sm text-muted-foreground">
									No market news yet.
								</div>
							)}
						</div>
					</div>

					{/* Supporting stats — inventory + alerts.
					 * DESIGN RULE: success/error variants are reserved for market direction.
					 * Counts use primary/info/neutral; only the Alerts card flips to error when active. */}
					<div
						className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6"
						aria-live="polite"
						aria-atomic="true"
					>
						<StatCard
							title="Factories"
							value={stats?.beef?.factories ?? 0}
							icon={FACTORY_ICON}
							variant="info"
							loading={loading}
						/>
						<StatCard
							title="Price Records"
							value={formatCompact(stats?.beef?.prices ?? 0)}
							icon={RECORDS_ICON}
							variant="primary"
							loading={loading}
						/>
						<StatCard
							title="Datasets"
							value={stats?.datasets?.total ?? 0}
							icon={DATASET_ICON}
							variant="info"
							loading={loading}
						/>
						<StatCard
							title="Alerts"
							value={stats?.alerts?.total || 0}
							icon={ALERT_ICON}
							trend={alertsTrend}
							variant={
								((stats?.alerts?.total || 0) > 0 ? "error" : "default") as "error" | "default"
							}
							loading={loading}
						/>
					</div>

					<div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6`}>
						<div className="lg:col-span-2">
							<ForecastTrendChart loading={loading} />
						</div>
						<div>
							<AlertDistributionChart data={stats?.alerts.bySeverity} loading={loading} />
						</div>
					</div>

					<div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4`}>
						<div className="lg:col-span-2">
							<RecentActivity
								recentAlerts={stats?.recentAlerts}
								recentForecasts={stats?.recentForecasts}
								loading={loading}
							/>
						</div>
						<div>
							<QuickActions />
						</div>
					</div>

					{/* AI models — real count only. Previously this was a hardcoded "8/8"
					 * fake. Now sourced from the models registry; the panel is hidden when
					 * no models exist rather than fabricating activity. */}
					{stats?.aiModels && stats.aiModels.total > 0 && (
						<div className={isMobile ? "mt-4" : "mt-6"}>
							<div className="rounded-lg p-5 sm:p-6 relative overflow-hidden border bg-card">
								<div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
									<div>
										<div className="flex items-center gap-2 mb-1">
											<TrendingUp className="size-[18px]" style={{ color: "#8B6914" }} />
											<h3 className="text-h4 font-display font-semibold text-foreground mb-0">
												AI Price Models
											</h3>
										</div>
										<p className="text-body text-muted-foreground">
											<span className="font-mono tabular-nums">{stats.aiModels.active}</span> of{" "}
											<span className="font-mono tabular-nums">{stats.aiModels.total}</span> models
											generating beef price forecasts
										</p>
									</div>
									<div className="flex items-center gap-4">
										<div className="hidden sm:flex items-center gap-1.5">
											{Array.from({ length: stats.aiModels.total }).map((_, i) => (
												<div
													// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
													key={i}
													className="w-2.5 h-2.5 rounded-full transition-all duration-300"
													style={{
														background: i < stats.aiModels.active ? "#8B6914" : "var(--muted)",
													}}
												/>
											))}
										</div>
										<div>
											<div
												className="text-4xl font-display font-mono tabular-nums font-semibold leading-none"
												style={{ color: "#8B6914" }}
											>
												{stats.aiModels.active}
											</div>
											<p className="text-body-sm text-muted-foreground mt-1">Active Models</p>
										</div>
									</div>
								</div>
								<div className="relative mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
									<div
										className="h-full rounded-full transition-all duration-700 ease-out"
										style={{
											width: `${stats.aiModels.total > 0 ? (stats.aiModels.active / stats.aiModels.total) * 100 : 0}%`,
											background: "#8B6914",
										}}
									/>
								</div>
							</div>
						</div>
					)}
				</LoadingState>
			)}
		</PageContainer>
	);
}
