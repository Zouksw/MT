"use client";

import {
	Activity,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clock,
	Database,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SourceInfo {
	id: string;
	label: string;
	description: string;
	tier: string;
	status: "healthy" | "error" | "pending";
	lastRun: string | null;
	error: string | null;
	lastResult: { inserted: number; updated: number } | null;
}

interface FreshnessItem {
	source: string;
	successRate: number;
	lastRun: string | null;
	stale: boolean;
	lastInserted: number;
	lastUpdated: number;
	totalRuns: number;
}

interface IngestionLog {
	id: string;
	source: string;
	status: string;
	inserted: number;
	updated: number;
	errorMessage: string | null;
	durationMs: number;
	createdAt: string;
}

function timeAgo(date: string | null): string {
	if (!date) return "Never";
	const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}

function StatusDot({ status }: { status: string }) {
	if (status === "healthy")
		return <span className="inline-block w-2 h-2 rounded-full bg-green-500" />;
	if (status === "error") return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
	return <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />;
}

function TierBadge({ tier }: { tier: string }) {
	const colors: Record<string, string> = {
		"1": "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
		"2": "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
		"3": "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
		"4": "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
	};
	return (
		<span
			className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${colors[tier] || "bg-gray-100 text-gray-600"}`}
		>
			T{tier}
		</span>
	);
}

export default function DataSourcesPage() {
	const [sources, setSources] = useState<SourceInfo[]>([]);
	const [freshness, setFreshness] = useState<FreshnessItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState<string | null>(null);
	const [expandedSource, setExpandedSource] = useState<string | null>(null);
	const [historyLogs, setHistoryLogs] = useState<IngestionLog[]>([]);

	const getToken = useCallback(async () => {
		const { tokenManager } = await import("@/lib/tokenManager");
		return tokenManager.getToken();
	}, []);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const token = await getToken();
			const headers: Record<string, string> = {};
			if (token) headers.Authorization = `Bearer ${token}`;

			const [sourcesRes, freshnessRes] = await Promise.allSettled([
				fetch(`${API_BASE}/api/market/sources`, { headers }),
				fetch(`${API_BASE}/api/market/sources/freshness`, { headers }),
			]);

			if (sourcesRes.status === "fulfilled" && sourcesRes.value.ok) {
				const data = await sourcesRes.value.json();
				if (data.success) setSources(data.data.sources || []);
			}

			if (freshnessRes.status === "fulfilled" && freshnessRes.value.ok) {
				const data = await freshnessRes.value.json();
				if (data.success) setFreshness(data.data.freshness || []);
			}
		} catch {
			setError("Failed to load data source information");
		} finally {
			setLoading(false);
		}
	}, [getToken]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const refreshSource = async (sourceId: string) => {
		setRefreshing(sourceId);
		try {
			const token = await getToken();
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (token) headers.Authorization = `Bearer ${token}`;

			const res = await fetch(`${API_BASE}/api/market/sources/${sourceId}/refresh`, {
				method: "POST",
				headers,
			});
			const data = await res.json();
			if (data.success) {
				await fetchData();
			}
		} catch {
			// Refresh failed silently
		} finally {
			setRefreshing(null);
		}
	};

	const refreshAll = async () => {
		setRefreshing("__all__");
		try {
			const token = await getToken();
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (token) headers.Authorization = `Bearer ${token}`;

			await fetch(`${API_BASE}/api/market/sources/refresh-all`, {
				method: "POST",
				headers,
			});
			await fetchData();
		} catch {
			// Refresh failed silently
		} finally {
			setRefreshing(null);
		}
	};

	const loadHistory = async (sourceId: string) => {
		if (expandedSource === sourceId) {
			setExpandedSource(null);
			return;
		}
		setExpandedSource(sourceId);
		try {
			const token = await getToken();
			const headers: Record<string, string> = {};
			if (token) headers.Authorization = `Bearer ${token}`;

			const res = await fetch(`${API_BASE}/api/market/sources/${sourceId}/history?limit=10`, {
				headers,
			});
			const data = await res.json();
			if (data.success) setHistoryLogs(data.data.logs || []);
		} catch {
			setHistoryLogs([]);
		}
	};

	const freshnessMap = new Map(freshness.map((f) => [f.source, f]));
	const healthy = sources.filter((s) => s.status === "healthy").length;
	const staleSources = freshness.filter((f) => f.stale);
	const avgSuccessRate =
		freshness.length > 0
			? Math.round(freshness.reduce((sum, f) => sum + f.successRate, 0) / freshness.length)
			: 0;

	if (error) {
		return (
			<PageContainer>
				<PageHeader
					title="Data Sources"
					description="Monitor and manage data pipeline health"
					breadcrumbs={[
						{ label: "Home", href: "/dashboard" },
						{ label: "Settings", href: "/settings" },
						{ label: "Data Sources" },
					]}
				/>
				<ErrorDisplay error={error} retry={fetchData} context="data sources" />
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Data Sources"
				description="Monitor and manage data pipeline health"
				breadcrumbs={[
					{ label: "Home", href: "/dashboard" },
					{ label: "Settings", href: "/settings" },
					{ label: "Data Sources" },
				]}
				actions={
					<Button
						variant="primary"
						size="sm"
						onClick={refreshAll}
						disabled={refreshing === "__all__"}
					>
						{refreshing === "__all__" ? (
							<>
								<RefreshCw className="size-3.5 animate-spin mr-1.5" /> Refreshing...
							</>
						) : (
							<>
								<RefreshCw className="size-3.5 mr-1.5" /> Refresh All
							</>
						)}
					</Button>
				}
			/>

			<LoadingState loading={loading} skeletonType="stats">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<StatCard
						title="Total Sources"
						value={sources.length}
						icon={<Database className="size-5" />}
						variant="primary"
					/>
					<StatCard
						title="Healthy"
						value={healthy}
						icon={<CheckCircle className="size-5" />}
						variant="success"
					/>
					<StatCard
						title="Stale"
						value={staleSources.length}
						icon={<Clock className="size-5" />}
						variant={staleSources.length > 0 ? "warning" : "default"}
					/>
					<StatCard
						title="Avg Success Rate"
						value={`${avgSuccessRate}%`}
						icon={<Activity className="size-5" />}
						variant={avgSuccessRate >= 90 ? "success" : avgSuccessRate >= 70 ? "warning" : "error"}
					/>
				</div>
			</LoadingState>

			{/* Stale sources alert */}
			{staleSources.length > 0 && (
				<div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
					<div className="flex items-center gap-2">
						<Clock className="size-4 text-amber-600 dark:text-amber-400" />
						<span className="text-sm font-medium text-amber-800 dark:text-amber-300">
							{staleSources.length} source{staleSources.length > 1 ? "s" : ""} need attention:{" "}
							{staleSources.map((s) => s.source).join(", ")}
						</span>
					</div>
				</div>
			)}

			<LoadingState loading={loading} skeletonType="table">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">Source Status</CardTitle>
					</CardHeader>
					<CardBody className="p-0">
						<div className="divide-y divide-border">
							{sources.map((source) => {
								const fresh = freshnessMap.get(source.id);
								const isExpanded = expandedSource === source.id;
								const isRefreshing = refreshing === source.id;

								return (
									<div key={source.id}>
										<div className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
											<StatusDot status={source.status} />
											<TierBadge tier={source.tier} />
											<div className="flex-1 min-w-0">
												<div className="text-sm font-medium text-foreground">{source.label}</div>
												<div className="text-xs text-muted-foreground truncate">
													{source.description}
												</div>
											</div>
											<div className="flex items-center gap-4 text-xs text-muted-foreground">
												{fresh && (
													<span className="hidden sm:inline">{fresh.successRate}% success</span>
												)}
												<span className="w-20 text-right">{timeAgo(source.lastRun)}</span>
												{source.lastResult && (
													<span className="hidden md:inline text-[11px] w-24 text-right">
														+{source.lastResult.inserted} / ~{source.lastResult.updated}
													</span>
												)}
											</div>
											<div className="flex items-center gap-2">
												<button type="button"
													onClick={() => loadHistory(source.id)}
													className="p-1.5 rounded-md hover:bg-accent transition-colors"
													title="View history"
												>
													{isExpanded ? (
														<ChevronUp className="size-3.5 text-muted-foreground" />
													) : (
														<ChevronDown className="size-3.5 text-muted-foreground" />
													)}
												</button>
												<button type="button"
													onClick={() => refreshSource(source.id)}
													disabled={isRefreshing}
													className="p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
													title="Refresh source"
												>
													<RefreshCw
														className={`size-3.5 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`}
													/>
												</button>
											</div>
										</div>

										{isExpanded && (
											<div className="px-4 py-3 bg-muted/30 border-t border-border">
												{source.error && (
													<div className="mb-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-400">
														{source.error}
													</div>
												)}
												{historyLogs.length > 0 ? (
													<table className="w-full text-xs">
														<thead>
															<tr className="text-muted-foreground">
																<th className="text-left py-1 font-medium">Time</th>
																<th className="text-left py-1 font-medium">Status</th>
																<th className="text-right py-1 font-medium">Inserted</th>
																<th className="text-right py-1 font-medium">Updated</th>
																<th className="text-right py-1 font-medium">Duration</th>
															</tr>
														</thead>
														<tbody>
															{historyLogs.map((log) => (
																<tr key={log.id} className="border-t border-border/50">
																	<td className="py-1 text-muted-foreground">
																		{new Date(log.createdAt).toLocaleString()}
																	</td>
																	<td className="py-1">
																		{log.status === "success" ? (
																			<CheckCircle className="size-3 text-green-500 inline mr-1" />
																		) : (
																			<XCircle className="size-3 text-red-500 inline mr-1" />
																		)}
																		{log.status}
																	</td>
																	<td className="py-1 text-right">{log.inserted}</td>
																	<td className="py-1 text-right">{log.updated}</td>
																	<td className="py-1 text-right text-muted-foreground">
																		{log.durationMs > 0
																			? `${(log.durationMs / 1000).toFixed(1)}s`
																			: "--"}
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												) : (
													<p className="text-xs text-muted-foreground">
														No ingestion history available
													</p>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</CardBody>
				</Card>
			</LoadingState>
		</PageContainer>
	);
}
