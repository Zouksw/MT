"use client";

import { Beef, Bell, Database, Lock, TrendingUp, User, Warehouse } from "lucide-react";
import dynamic from "next/dynamic";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatCard } from "@/components/ui/StatCard";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCompact, formatPercent, formatPrice, formatPriceRange } from "@/lib/format";
import { useIsMobile } from "@/lib/responsive-utils";
import { getAuthToken, getCachedUser } from "@/utils/auth";

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

export default function DashboardPage() {
	const { stats, loading, error, manualRetry } = useDashboardStats();
	const user = getCachedUser();
	const isMobile = useIsMobile();
	const isAuthenticated = !!getAuthToken();

	const beef = stats?.beef;
	const hasBeefPrices = beef != null && beef.avgPrice != null;

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
								<img src={user.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
							) : (
								<User className={isMobile ? "size-[18px]" : "size-[22px]"} />
							)}
						</div>
					</div>

					{/* KPI HERO — beef average price (the product's core number).
					 * When price data exists, lead with the live avg + range.
					 * When data is sparse, fall back to coverage rate so the hero is never empty/faked. */}
					<div className="mb-4 md:mb-6 rounded-xl border bg-card p-5 sm:p-6">
						{hasBeefPrices ? (
							<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
								<div>
									<div className="flex items-center gap-2 mb-1 text-muted-foreground">
										<Beef className="size-4" />
										<span className="text-sm font-medium">Beef Average Price</span>
									</div>
									<div
										className="text-4xl sm:text-5xl font-display font-semibold tracking-tight tabular-nums"
										style={{ color: "#8B6914" }}
									>
										{formatPrice(beef?.avgPrice ?? null, false)}
										<span className="text-lg font-normal text-muted-foreground">/kg</span>
									</div>
									{beef?.minPrice != null && beef?.maxPrice != null && (
										<p className="text-sm text-muted-foreground mt-1">
											Range {formatPriceRange(beef.minPrice, beef.maxPrice)}
										</p>
									)}
								</div>
								<div className="flex items-center gap-6 sm:gap-8">
									{beef?.coverage != null && (
										<div>
											<div className="text-xs text-muted-foreground mb-0.5">Coverage</div>
											<div
												className="text-xl font-display font-semibold tabular-nums"
												style={{ fontVariantNumeric: "tabular-nums" }}
											>
												{formatPercent(beef.coverage)}
											</div>
										</div>
									)}
									<div>
										<div className="text-xs text-muted-foreground mb-0.5">Tracked Cuts</div>
										<div
											className="text-xl font-display font-semibold tabular-nums"
											style={{ fontVariantNumeric: "tabular-nums" }}
										>
											{beef?.cuts ?? 0}
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
									<Database className="size-6 text-muted-foreground" />
								</div>
								<div>
									<div className="font-medium text-foreground">Beef price board warming up</div>
									<p className="text-sm text-muted-foreground">
										{beef?.cuts ?? 0} cuts registered — latest prices will appear here once
										ingested.
									</p>
								</div>
							</div>
						)}
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
							icon={<Warehouse className="size-5" />}
							variant="info"
							loading={loading}
						/>
						<StatCard
							title="Price Records"
							value={formatCompact(stats?.beef?.prices ?? 0)}
							icon={<TrendingUp className="size-5" />}
							variant="primary"
							loading={loading}
						/>
						<StatCard
							title="Datasets"
							value={stats?.datasets?.total ?? 0}
							icon={<Database className="size-5" />}
							variant="info"
							loading={loading}
						/>
						<StatCard
							title="Alerts"
							value={stats?.alerts?.total || 0}
							icon={<Bell className="size-5" />}
							trend={
								stats?.alerts?.trend
									? { value: Math.abs(stats.alerts.trend), isPositive: stats.alerts.trend < 0 }
									: undefined
							}
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
