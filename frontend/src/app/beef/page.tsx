"use client";

import { Beef, DollarSign, Search, Target, Upload, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { BeefFreshnessBadge } from "@/components/beef/BeefFreshnessBadge";
import { CutForecastCell } from "@/components/beef/CutForecastCell";
import { SnapshotBanner } from "@/components/beef/SnapshotBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { MarketForecastBoard } from "@/components/market/MarketForecastBoard";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { useBeefCutForecasts } from "@/hooks/useBeefCutForecasts";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { beefFetcher } from "@/lib/beef";
import { formatDecimal, formatPrice } from "@/lib/format";

export default function BeefOverview() {
	// All four beef endpoints are simple GETs with URL keys → use the shared
	// retryable fetcher (auto retry + backoff) rather than raw useSWR. This is
	// the R3 fetcher-pattern unification: every page-level GET in the app goes
	// through useRetryableFetch unless it has a specific reason not to.
	const {
		data: pricesData,
		error: pricesErr,
		isLoading: pricesLoading,
	} = useRetryableFetch("/api/beef/prices/latest", beefFetcher);
	const { data: killData, isLoading: killLoading } = useRetryableFetch(
		"/api/beef/weekly-kill?weeks=4",
		beefFetcher,
	);
	const { data: storageData, isLoading: storageLoading } = useRetryableFetch(
		"/api/beef/cold-storage?months=3",
		beefFetcher,
	);
	const { data: cutsData, isLoading: cutsLoading } = useRetryableFetch(
		"/api/beef/cuts",
		beefFetcher,
	);

	const latestPrices = pricesData?.data?.prices ?? pricesData?.prices ?? [];
	// Batch forecast summary — one fetch powers the per-row 7d-forecast column.
	// Null when unauth/error (column silently omits). Cuts absent from the map
	// are stale/insufficient → honest "—" cell, never a fabricated prediction.
	const { forecasts: cutForecasts } = useBeefCutForecasts(7);
	// Page-level freshness summary from backend (services/beefFreshness.ts).
	// allStale=true → render the demo-snapshot banner so we never silently pass
	// frozen seed data off as a live market.
	const priceFreshness = pricesData?.data?.freshness ?? pricesData?.freshness ?? null;
	const weeklyKills = killData?.data?.kills ?? killData?.kills ?? [];
	const coldStorage = storageData?.data?.coldStorage ?? storageData?.coldStorage ?? [];
	const cuts = cutsData?.data?.cuts ?? cutsData?.cuts ?? [];

	// ── Origin filter + search + sort (PRODUCT-SPEC IA 进口/国产 split) ──────────
	// Domestic = factory.country === "CN"; imported = everything else. "all"
	// shows both. Currently all factories are overseas, so "domestic" honestly
	// shows an empty state rather than fabricating CN data.
	type OriginFilter = "all" | "imported" | "domestic";
	const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
	const [search, setSearch] = useState("");
	type SortKey = "cutCode" | "price" | "source";
	const [sortKey, setSortKey] = useState<SortKey>("price");
	const [sortDesc, setSortDesc] = useState(true);

	const filteredPrices = useMemo(() => {
		let rows = latestPrices;
		if (originFilter !== "all") {
			rows = rows.filter((p: { factory?: { country?: string } }) => {
				const isDomestic = p.factory?.country === "CN";
				return originFilter === "domestic" ? isDomestic : !isDomestic;
			});
		}
		const q = search.trim().toLowerCase();
		if (q) {
			rows = rows.filter((p: { cutCode: string }) =>
				p.cutCode.replace(/_/g, " ").toLowerCase().includes(q),
			);
		}
		const sorted = [...rows].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
			if (sortKey === "price") {
				return ((a.price as number) ?? 0) - ((b.price as number) ?? 0);
			}
			if (sortKey === "source") {
				return String(a.source ?? "").localeCompare(String(b.source ?? ""));
			}
			return String(a.cutCode ?? "").localeCompare(String(b.cutCode ?? ""));
		});
		return sortDesc ? sorted.reverse() : sorted;
	}, [latestPrices, originFilter, search, sortKey, sortDesc]);

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDesc(!sortDesc);
		} else {
			setSortKey(key);
			setSortDesc(key === "price"); // price defaults desc, others asc
		}
	}

	// avgPrice reflects the active filter so the summary card tracks the view.
	const avgPrice =
		filteredPrices.length > 0
			? formatPrice(
					filteredPrices.reduce((s: number, p: { price: number }) => s + p.price, 0) /
						filteredPrices.length,
					false,
				)
			: "--";

	// Group cuts by primal
	const primalGroups: Record<string, typeof cuts> = {};
	for (const cut of cuts) {
		const key = cut.primal || "Other";
		if (!primalGroups[key]) primalGroups[key] = [];
		primalGroups[key].push(cut);
	}

	// Compute summary stats
	const totalKills = weeklyKills.reduce(
		(s: number, k: { headCount: number }) => s + k.headCount,
		0,
	);
	const usStorage = coldStorage.find((s: { country: string }) => s.country === "US");

	const isLoading = pricesLoading && killLoading && storageLoading && cutsLoading;
	const hasNoData =
		!isLoading && latestPrices.length === 0 && weeklyKills.length === 0 && coldStorage.length === 0;

	if (isLoading) {
		return (
			<PageContainer>
				<PageHeader
					title="Beef Market Intelligence"
					description="Factory-level and cut-level beef trading data across global markets"
				/>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
					))}
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div className="lg:col-span-2 h-64 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
					<div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
				</div>
			</PageContainer>
		);
	}

	if (hasNoData) {
		return (
			<PageContainer>
				<PageHeader
					title="Beef Market Intelligence"
					description="Factory-level and cut-level beef trading data across global markets"
				/>
				<EmptyState
					type="data"
					title="No Beef Price Data Available"
					description="Beef data sources require API key configuration. USDA MARS API provides US cut prices, MLA provides Australian livestock data. Contact your administrator to activate these sources."
				/>
				<div className="mt-4 flex justify-center">
					<a
						href="/beef/import"
						className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
					>
						<Upload className="size-4" />
						Import prices via CSV
					</a>
				</div>
				<p className="mt-2 text-center text-xs text-muted-foreground">
					Admins can upload real cut-level prices without an API key.
				</p>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Beef Market Intelligence"
				description="Factory-level and cut-level beef trading data across global markets"
				actions={
					<a
						href="/beef/import"
						className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
					>
						<Upload className="size-4" />
						Import Data
					</a>
				}
			/>

			{/* Honesty banner — shows only when no live data is present on the page. */}
			<SnapshotBanner freshness={priceFreshness} />

			{/* Summary Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<StatCard title="Avg Cut Price" value={avgPrice} icon={<DollarSign />} variant="primary" />
				<StatCard title="Tracked Cuts" value={cuts.length} icon={<Beef />} />
				<StatCard
					title="Weekly Slaughter"
					value={totalKills > 0 ? totalKills.toLocaleString() : "--"}
					icon={<Target />}
					variant="success"
				/>
				<StatCard
					title="US Cold Storage"
					value={usStorage ? `${usStorage.totalLbs} M lbs` : "--"}
					icon={<Warehouse />}
					variant="warning"
				/>
			</div>

			{/* AI forecast board — prediction woven into the market view (PRODUCT-SPEC core). */}
			<div className="mb-6">
				<MarketForecastBoard />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
				{/* Latest Prices by Cut */}
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Latest Cut Prices</CardTitle>
					</CardHeader>
					<CardBody>
						{pricesErr && <p className="text-sm text-muted-foreground">Unable to load prices</p>}
						{latestPrices.length === 0 && !pricesErr && (
							<EmptyState
								type="data"
								title="No Price Data"
								description="Run scrapers to populate beef cut prices."
							/>
						)}
						{latestPrices.length > 0 && (
							<div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
								{/* Origin filter — PRODUCT-SPEC IA 进口/国产 split */}
								<div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
									{(["all", "imported", "domestic"] as const).map((opt) => (
										<button
											key={opt}
											type="button"
											onClick={() => setOriginFilter(opt)}
											className={`px-3 py-1.5 font-medium capitalize transition-colors ${
												originFilter === opt
													? "bg-primary text-primary-foreground"
													: "text-muted-foreground hover:bg-muted"
											}`}
										>
											{opt}
										</button>
									))}
								</div>
								{/* Search box */}
								<div className="relative flex-1 max-w-xs">
									<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
									<input
										type="text"
										placeholder="Search cut…"
										aria-label="Search beef cuts"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
									/>
								</div>
								<span className="text-xs text-muted-foreground sm:ml-auto">
									{filteredPrices.length} of {latestPrices.length} rows
								</span>
							</div>
						)}
						{filteredPrices.length === 0 && latestPrices.length > 0 && !pricesErr && (
							<EmptyState
								type="data"
								title={originFilter === "domestic" ? "No Domestic (CN) Prices" : "No Matching Cuts"}
								description={
									originFilter === "domestic"
										? "No Chinese domestic factory data yet. Import CN prices via CSV to populate this view."
										: "Try a different search or filter."
								}
							/>
						)}
						{filteredPrices.length > 0 && (
							<div className="overflow-x-auto">
								<table className="data-table">
									<thead>
										<tr>
											<th className="text-left">
												<button
													type="button"
													onClick={() => toggleSort("cutCode")}
													className="inline-flex items-center gap-1 hover:text-primary"
												>
													Cut {sortKey === "cutCode" && (sortDesc ? "↓" : "↑")}
												</button>
											</th>
											<th className="text-right">
												<button
													type="button"
													onClick={() => toggleSort("price")}
													className="inline-flex items-center gap-1 hover:text-primary"
												>
													Price (USD/kg) {sortKey === "price" && (sortDesc ? "↓" : "↑")}
												</button>
											</th>
											<th className="text-left">7d Forecast</th>
											<th className="text-left">
												<button
													type="button"
													onClick={() => toggleSort("source")}
													className="inline-flex items-center gap-1 hover:text-primary"
												>
													Source {sortKey === "source" && (sortDesc ? "↓" : "↑")}
												</button>
											</th>
											<th className="text-left">Freshness</th>
											<th className="text-left">Factory</th>
											<th className="text-left">Grade</th>
										</tr>
									</thead>
									<tbody>
										{filteredPrices
											.slice(0, 50)
											.map(
												(p: {
													cutCode: string;
													price: number;
													source: string;
													freshness?: "live" | "proxy" | "snapshot";
													dataDate?: string | null;
													reason?: string;
													grade?: string;
													factory?: { code: string; name: string; country: string };
												}) => (
													<tr key={`${p.cutCode}-${p.source}-${p.factory?.code}`}>
														<td>
															<a
																href={`/beef/cuts/${p.cutCode}`}
																className="text-primary hover:underline"
															>
																{p.cutCode.replace(/_/g, " ")}
															</a>
														</td>
														<td className="text-right font-mono">{formatPrice(p.price, false)}</td>
														<td>
															<CutForecastCell forecast={cutForecasts?.[p.cutCode]} />
														</td>
														<td className="text-gray-500 text-xs">{p.source}</td>
														<td>
															<BeefFreshnessBadge
																freshness={p.freshness}
																dataDate={p.dataDate}
																reason={p.reason}
																compact
															/>
														</td>
														<td className="text-xs">
															{p.factory ? `${p.factory.name} (${p.factory.country})` : "--"}
														</td>
														<td className="text-xs text-gray-500">{p.grade || "--"}</td>
													</tr>
												),
											)}
									</tbody>
								</table>
							</div>
						)}
					</CardBody>
				</Card>

				{/* Cut Taxonomy by Primal */}
				<Card>
					<CardHeader>
						<CardTitle>Cut Categories</CardTitle>
					</CardHeader>
					<CardBody>
						{Object.entries(primalGroups).map(([primal, primalCuts]) => (
							<div key={primal} className="mb-4">
								<h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
									{primal}
								</h3>
								<div className="flex flex-wrap gap-1">
									{primalCuts.map((cut: { cutCode: string; nameZh?: string; nameEn: string }) => (
										<a
											key={cut.cutCode}
											href={`/beef/cuts/${cut.cutCode}`}
											className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary/10 hover:text-primary transition-colors"
										>
											{cut.nameZh || cut.nameEn}
										</a>
									))}
								</div>
							</div>
						))}
					</CardBody>
				</Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{/* Weekly Kill Data */}
				<Card>
					<CardHeader>
						<CardTitle>Weekly Slaughter by Country</CardTitle>
					</CardHeader>
					<CardBody>
						{weeklyKills.length === 0 ? (
							<EmptyState
								type="data"
								title="No Kill Data"
								description="Weekly slaughter data will appear here when available."
							/>
						) : (
							<div className="overflow-x-auto">
								<table className="data-table">
									<thead>
										<tr>
											<th className="text-left">Week</th>
											<th className="text-left">Country</th>
											<th className="text-right">Head Count</th>
											<th className="text-right">Avg Weight (kg)</th>
										</tr>
									</thead>
									<tbody>
										{weeklyKills.map(
											(k: {
												weekEnding: string;
												country: string;
												headCount: number;
												avgWeight?: number;
											}) => (
												<tr key={`${k.country}-${k.weekEnding}`}>
													<td className="text-xs text-gray-500">
														{new Date(k.weekEnding).toLocaleDateString()}
													</td>
													<td>{k.country}</td>
													<td className="text-right font-mono">{k.headCount.toLocaleString()}</td>
													<td className="text-right font-mono text-gray-500">
														{formatDecimal(k.avgWeight, 0) || "--"}
													</td>
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>
						)}
					</CardBody>
				</Card>

				{/* Cold Storage */}
				<Card>
					<CardHeader>
						<CardTitle>Cold Storage Stocks</CardTitle>
					</CardHeader>
					<CardBody>
						{coldStorage.length === 0 ? (
							<EmptyState
								type="data"
								title="No Cold Storage Data"
								description="Cold storage stock data will appear here when available."
							/>
						) : (
							<div className="overflow-x-auto">
								<table className="data-table">
									<thead>
										<tr>
											<th className="text-left">Date</th>
											<th className="text-left">Country</th>
											<th className="text-right">Total (M lbs)</th>
										</tr>
									</thead>
									<tbody>
										{coldStorage.map((s: { date: string; country: string; totalLbs: number }) => (
											<tr key={`${s.country}-${s.date}`}>
												<td className="text-xs text-gray-500">
													{new Date(s.date).toLocaleDateString()}
												</td>
												<td>{s.country}</td>
												<td className="text-right font-mono">{formatDecimal(s.totalLbs, 1)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</CardBody>
				</Card>
			</div>

			{/* Price Spread by Source */}
			{latestPrices.length > 0 && (
				<Card className="mt-6">
					<CardHeader>
						<CardTitle>Price Distribution by Source</CardTitle>
					</CardHeader>
					<CardBody>
						{(() => {
							// Group prices by source+country
							const sourceGroups: Record<string, { prices: number[]; count: number }> = {};
							for (const p of latestPrices) {
								const key = `${p.source} (${p.factory?.country || "?"})`;
								if (!sourceGroups[key]) sourceGroups[key] = { prices: [], count: 0 };
								sourceGroups[key].prices.push(p.price);
								sourceGroups[key].count++;
							}

							const allPrices = latestPrices.map((p: { price: number }) => p.price);
							const globalMin = Math.min(...allPrices);
							const globalMax = Math.max(...allPrices);
							const range = globalMax - globalMin || 1;

							return (
								<div className="space-y-3">
									{Object.entries(sourceGroups)
										.sort((a, b) => {
											const avgA = a[1].prices.reduce((s, v) => s + v, 0) / a[1].prices.length;
											const avgB = b[1].prices.reduce((s, v) => s + v, 0) / b[1].prices.length;
											return avgB - avgA;
										})
										.map(([source, data]) => {
											const avg = data.prices.reduce((s, v) => s + v, 0) / data.prices.length;
											const min = Math.min(...data.prices);
											const max = Math.max(...data.prices);
											const leftPct = ((min - globalMin) / range) * 100;
											const widthPct = Math.max(((max - min) / range) * 100, 2);
											const avgPct = ((avg - globalMin) / range) * 100;

											return (
												<div key={source} className="flex items-center gap-3">
													<div className="w-48 text-xs text-gray-600 dark:text-gray-400 truncate shrink-0">
														{source}
														<span className="ml-1 text-muted-foreground">({data.count})</span>
													</div>
													<div className="flex-1 relative h-6">
														<div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded" />
														<div
															className="absolute h-full bg-primary/30 rounded"
															style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
														/>
														<div
															className="absolute w-1 h-full bg-primary rounded"
															style={{ left: `${avgPct}%` }}
														/>
													</div>
													<div className="w-32 text-xs text-right shrink-0">
														<span className="font-mono">{formatPrice(avg, false)}</span>
														<span className="text-muted-foreground ml-1">avg</span>
													</div>
												</div>
											);
										})}
									<div className="flex justify-between text-xs text-muted-foreground mt-1">
										<span>{formatPrice(globalMin, false)}</span>
										<span>{formatPrice(globalMax, false)}</span>
									</div>
								</div>
							);
						})()}
					</CardBody>
				</Card>
			)}
		</PageContainer>
	);
}
