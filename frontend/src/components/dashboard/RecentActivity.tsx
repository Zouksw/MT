"use client";

import { Bell, ChevronRight, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Tag } from "@/components/ui/Tag";
import type { Alert, Forecast } from "@/types/api";

interface RecentActivityProps {
	recentAlerts?: Alert[];
	recentForecasts?: Forecast[];
	loading?: boolean;
}

function getSeverityVariant(severity: string): "error" | "warning" | "primary" | "default" {
	switch (severity?.toLowerCase()) {
		case "critical":
			return "error";
		case "high":
			return "warning";
		case "medium":
			return "primary";
		default:
			return "default";
	}
}

export const RecentActivity = React.memo<RecentActivityProps>(
	function RecentActivity({ recentAlerts = [], recentForecasts = [], loading = false }) {
		const router = useRouter();
		const [activeTab, setActiveTab] = useState<"alerts" | "forecasts">("alerts");

		const alertsItems = recentAlerts.slice(0, 5).map((alert: Alert) => ({
			id: alert.id,
			title: alert.message || "Alert",
			severity: alert.severity,
			time: alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "Recently",
		}));

		const forecastsItems = recentForecasts.slice(0, 5).map((forecast: Forecast) => ({
			id: forecast.id,
			title: `Forecast for ${forecast.timeseriesId || "Time Series"}`,
			status: forecast.model?.status || "completed",
			description: `Model: ${forecast.model?.name || "N/A"}`,
			time: forecast.createdAt ? new Date(forecast.createdAt).toLocaleString() : "Recently",
		}));

		if (loading) {
			return (
				<div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 p-4 h-full">
					<div className="animate-pulse">
						<div className="h-5 bg-muted rounded w-32 mb-4" />
						<div className="space-y-3">
							{[1, 2, 3].map((i) => (
								<div key={i} className="h-10 bg-muted rounded" />
							))}
						</div>
					</div>
				</div>
			);
		}

		return (
			<div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 p-4 h-full">
				<div className="flex items-center justify-between mb-4">
					<h5 className="text-base font-semibold m-0">Recent Activity</h5>
					<button
						type="button"
						className="text-sm text-amber-600 hover:opacity-70 flex items-center gap-1"
						onClick={() => router.push(activeTab === "alerts" ? "/alerts" : "/forecasts")}
					>
						View All <ChevronRight className="size-3" />
					</button>
				</div>

				<div className="flex gap-1 mb-4 border-b border">
					<button
						onClick={() => setActiveTab("alerts")}
						className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "alerts" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}
					>
						Alerts
					</button>
					<button
						onClick={() => setActiveTab("forecasts")}
						className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "forecasts" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}
					>
						Forecasts
					</button>
				</div>

				{activeTab === "alerts" ? (
					alertsItems.length === 0 ? (
						<p className="text-sm text-gray-400 text-center py-6">No recent alerts</p>
					) : (
						<div className="space-y-1">
							{alertsItems.map((item, i) => (
								<div
									key={item.id}
									className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors stagger-slide-up"
									style={{ animationDelay: `${i * 50}ms` }}
									onClick={() => router.push(`/alerts/show/${item.id}`)}
								>
									<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-gray-700/50">
										<Bell className="size-4 text-amber-600" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="text-sm truncate max-w-48">{item.title}</span>
											<Tag color={getSeverityVariant(item.severity)}>{item.severity || "INFO"}</Tag>
										</div>
										<span className="text-xs text-gray-400">{item.time}</span>
									</div>
								</div>
							))}
						</div>
					)
				) : forecastsItems.length === 0 ? (
					<p className="text-sm text-gray-400 text-center py-6">No recent forecasts</p>
				) : (
					<div className="space-y-1">
						{forecastsItems.map((item, i) => (
							<div
								key={item.id}
								className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors stagger-slide-up"
								style={{ animationDelay: `${i * 50}ms` }}
								onClick={() => router.push("/forecasts")}
							>
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
									<Zap className="size-4 text-purple-500" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-sm truncate max-w-48">{item.title}</span>
										<Tag color="primary">{item.status}</Tag>
									</div>
									<span className="text-xs text-gray-400">
										{item.description} · {item.time}
									</span>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		);
	},
	(prevProps, nextProps) =>
		prevProps.recentAlerts === nextProps.recentAlerts &&
		prevProps.recentForecasts === nextProps.recentForecasts &&
		prevProps.loading === nextProps.loading,
);

RecentActivity.displayName = "RecentActivity";
export default RecentActivity;
