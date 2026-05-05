"use client";

import { Activity, Bell, Database, Lock, Star, TrendingUp, User } from "lucide-react";
import dynamic from "next/dynamic";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatCard } from "@/components/ui/StatCard";
import { useDashboardStats } from "@/hooks/useDashboardStats";
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

	const statCards = [
		{
			title: "Datasets",
			value: stats?.datasets.total || 0,
			icon: <Database className="size-5" />,
			trend: stats?.datasets.trend
				? { value: Math.abs(stats.datasets.trend), isPositive: stats.datasets.trend > 0 }
				: undefined,
			variant: "primary" as const,
		},
		{
			title: "Time Series",
			value: stats?.timeseries.total || 0,
			icon: <Activity className="size-5" />,
			trend: stats?.timeseries.trend
				? { value: Math.abs(stats.timeseries.trend), isPositive: stats.timeseries.trend > 0 }
				: undefined,
			variant: "success" as const,
		},
		{
			title: "Forecasts",
			value: stats?.forecasts.total || 0,
			icon: <TrendingUp className="size-5" />,
			trend: stats?.forecasts.trend
				? { value: Math.abs(stats.forecasts.trend), isPositive: stats.forecasts.trend > 0 }
				: undefined,
			variant: "warning" as const,
		},
		{
			title: "Alerts",
			value: stats?.alerts?.total || 0,
			icon: <Bell className="size-5" />,
			trend: stats?.alerts?.trend
				? { value: Math.abs(stats.alerts.trend), isPositive: stats.alerts.trend < 0 }
				: undefined,
			variant: ((stats?.alerts?.total || 0) > 0 ? "error" : "default") as "error" | "default",
		},
	];

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
						Access your commodity watchlist, AI signals, and market analysis.
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
							<div className="flex items-center gap-3 mb-1">
								<h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
									Welcome back, {user?.name || "User"}!
								</h1>
								<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
									<span className="inline-flex rounded-full h-2 w-2 bg-green-500" />
									<span className="text-xs font-medium text-green-700 dark:text-green-400">
										Healthy
									</span>
								</div>
							</div>
							<p className="text-body text-muted-foreground">
								Here&apos;s what&apos;s happening with your MT account.
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

					<div
						className={`grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6`}
						aria-live="polite"
						aria-atomic="true"
					>
						{statCards.map((stat, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							<StatCard key={index} {...stat} loading={loading} />
						))}
					</div>

					<div className={`grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6`}>
						<div className="lg:col-span-2">
							<ForecastTrendChart loading={loading} />
						</div>
						<div>
							<AlertDistributionChart data={stats?.alerts.bySeverity} loading={loading} />
						</div>
					</div>

					<div className={`grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4`}>
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

					{stats?.aiModels && (
						<div className={isMobile ? "mt-4" : "mt-6"}>
							<div className="rounded-lg p-5 sm:p-6 text-white relative overflow-hidden bg-[#171717]">
								<div
									className="absolute top-4 right-12 w-16 h-16 rounded-full bg-white/5"
									style={{ animation: "float 6s ease-in-out infinite" }}
								/>
								<div
									className="absolute bottom-6 right-32 w-8 h-8 rounded-full bg-white/5"
									style={{ animation: "float 8s ease-in-out 2s infinite" }}
								/>
								<div
									className="absolute top-8 left-1/2 w-6 h-6 rounded-full bg-white/5"
									style={{ animation: "float 7s ease-in-out 1s infinite" }}
								/>

								<div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
									<div>
										<div className="flex items-center gap-2 mb-1">
											<Star width={18} height={18} fill="white" fillOpacity={0.8} stroke="none" />
											<h3 className="text-h4 font-display font-semibold text-white mb-0">
												AI Models Status
											</h3>
										</div>
										<p className="text-body text-white/85">
											<span className="font-mono tabular-nums">{stats.aiModels.active}</span> of{" "}
											<span className="font-mono tabular-nums">{stats.aiModels.total}</span> models
											active
										</p>
									</div>
									<div className="text-right flex items-center gap-4">
										<div className="hidden sm:flex items-center gap-1.5">
											{Array.from({ length: stats.aiModels.total }).map((_, i) => (
												<div
													// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
													key={i}
													className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
														i < stats.aiModels.active
															? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]"
															: "bg-white/20"
													}`}
												/>
											))}
										</div>
										<div>
											<div className="text-4xl font-display font-mono tabular-nums font-semibold leading-none data-text">
												{stats.aiModels.active}
											</div>
											<p className="text-body-sm text-white/85 mt-1">Active Models</p>
										</div>
									</div>
								</div>
								<div className="relative mt-4 h-1.5 rounded-full bg-white/20 overflow-hidden">
									<div
										className="h-full rounded-full bg-white/80 transition-all duration-700 ease-out"
										style={{
											width: `${stats.aiModels.total > 0 ? (stats.aiModels.active / stats.aiModels.total) * 100 : 0}%`,
										}}
									/>
									<div className="absolute inset-0 shimmer-slide" />
								</div>
							</div>
						</div>
					)}
				</LoadingState>
			)}
		</PageContainer>
	);
}
