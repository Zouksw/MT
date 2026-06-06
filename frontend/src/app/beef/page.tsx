"use client";

import { Beef, DollarSign, Target, Warehouse } from "lucide-react";
import useSWR from "swr";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function beefFetcher(url: string) {
	const res = await fetch(`${API_BASE}${url}`, {
		headers: { "Content-Type": "application/json" },
		credentials: "include",
	});
	if (!res.ok) throw new Error(`${res.status}`);
	return res.json();
}

export default function BeefOverview() {
	const { data: pricesData, error: pricesErr } = useSWR("/api/beef/prices/latest", beefFetcher);
	const { data: killData } = useSWR("/api/beef/weekly-kill?weeks=4", beefFetcher);
	const { data: storageData } = useSWR("/api/beef/cold-storage?months=3", beefFetcher);
	const { data: cutsData } = useSWR("/api/beef/cuts", beefFetcher);

	const latestPrices = pricesData?.data?.prices ?? pricesData?.prices ?? [];
	const weeklyKills = killData?.data?.kills ?? killData?.kills ?? [];
	const coldStorage = storageData?.data?.coldStorage ?? storageData?.coldStorage ?? [];
	const cuts = cutsData?.data?.cuts ?? cutsData?.cuts ?? [];

	// Group cuts by primal
	const primalGroups: Record<string, typeof cuts> = {};
	for (const cut of cuts) {
		const key = cut.primal || "Other";
		if (!primalGroups[key]) primalGroups[key] = [];
		primalGroups[key].push(cut);
	}

	// Compute summary stats
	const avgPrice =
		latestPrices.length > 0
			? (
					latestPrices.reduce((s: number, p: { price: number }) => s + p.price, 0) /
					latestPrices.length
				).toFixed(2)
			: "--";
	const totalKills = weeklyKills.reduce(
		(s: number, k: { headCount: number }) => s + k.headCount,
		0,
	);
	const usStorage = coldStorage.find((s: { country: string }) => s.country === "US");

	return (
		<PageContainer>
			<PageHeader
				title="Beef Market Intelligence"
				description="Factory-level and cut-level beef trading data across global markets"
			/>

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

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
				{/* Latest Prices by Cut */}
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Latest Cut Prices</CardTitle>
					</CardHeader>
					<CardBody>
						{pricesErr && <p className="text-sm text-gray-400">Unable to load prices</p>}
						{latestPrices.length === 0 && !pricesErr && (
							<EmptyState
								type="data"
								title="No Price Data"
								description="Run scrapers to populate beef cut prices."
							/>
						)}
						<div className="overflow-x-auto">
							<table className="data-table">
								<thead>
									<tr>
										<th className="text-left">Cut</th>
										<th className="text-right">Price (USD/kg)</th>
										<th className="text-left">Source</th>
										<th className="text-left">Factory</th>
										<th className="text-left">Grade</th>
									</tr>
								</thead>
								<tbody>
									{latestPrices
										.slice(0, 20)
										.map(
											(p: {
												cutCode: string;
												price: number;
												source: string;
												grade?: string;
												factory?: { code: string; name: string; country: string };
											}) => (
												<tr key={`${p.cutCode}-${p.source}-${p.factory?.code}`}>
													<td>
														<a
															href={`/beef/cuts/${p.cutCode}`}
															className="text-blue-600 dark:text-blue-400 hover:underline"
														>
															{p.cutCode.replace(/_/g, " ")}
														</a>
													</td>
													<td className="text-right font-mono">{p.price.toFixed(2)}</td>
													<td className="text-gray-500 text-xs">{p.source}</td>
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
											className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
														{k.avgWeight?.toFixed(0) || "--"}
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
												<td className="text-right font-mono">{s.totalLbs.toFixed(1)}</td>
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
														<span className="ml-1 text-gray-400">({data.count})</span>
													</div>
													<div className="flex-1 relative h-6">
														<div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded" />
														<div
															className="absolute h-full bg-blue-200 dark:bg-blue-900/40 rounded"
															style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
														/>
														<div
															className="absolute w-1 h-full bg-blue-600 dark:bg-blue-400 rounded"
															style={{ left: `${avgPct}%` }}
														/>
													</div>
													<div className="w-32 text-xs text-right shrink-0">
														<span className="font-mono">${avg.toFixed(2)}</span>
														<span className="text-gray-400 ml-1">avg</span>
													</div>
												</div>
											);
										})}
									<div className="flex justify-between text-xs text-gray-400 mt-1">
										<span>${globalMin.toFixed(2)}</span>
										<span>${globalMax.toFixed(2)}</span>
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
