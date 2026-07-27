"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CutForecastSection } from "@/components/beef/CutForecastSection";
import { CutPriceHistoryChart } from "@/components/beef/CutPriceHistoryChart";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { beefFetcher } from "@/lib/beef";
import { formatPrice, formatPriceRange } from "@/lib/format";

type PricePoint = {
	date: string;
	price: number;
	source: string;
	grade?: string;
	factory?: { code: string; name: string; country: string };
};

/** Group key for the chart — controls the comparison dimension. */
type GroupBy = "source" | "factory";

export default function CutDetail() {
	const params = useParams();
	const cutCode = params.cutCode as string;

	const { data: cutData } = useRetryableFetch(
		cutCode ? `/api/beef/cuts/${cutCode}` : null,
		beefFetcher,
	);
	const { data: priceData, error: priceErr } = useRetryableFetch(
		cutCode ? `/api/beef/prices/history/${cutCode}?days=90` : null,
		beefFetcher,
	);

	const cut = cutData?.data ?? cutData;
	const prices = (priceData?.data?.prices ?? priceData?.prices ?? []) as PricePoint[];

	const displayName = cut?.nameZh
		? `${cut.nameZh} (${cut.nameEn})`
		: cut?.nameEn || cutCode.replace(/_/g, " ");

	// Chart comparison dimension toggle: "by source" compares data origins /
	// countries (e.g. USDA-AMS vs MLA); "by factory" compares individual
	// producers within the same source. The backend already returns all
	// factories for the cut — no extra API call needed, just a different
	// grouping key. (PRODUCT-SPEC §5.2 产地对比 — both dimensions are useful.)
	const [groupBy, setGroupBy] = useState<GroupBy>("source");

	// Group prices into series for the chart. Switching the key re-derives the
	// series without refetching.
	const chartGroups = useMemo(() => {
		const groups: Record<string, PricePoint[]> = {};
		for (const p of prices) {
			const key =
				groupBy === "factory"
					? `${p.factory?.name || "Unknown"} (${p.factory?.country || "?"})`
					: `${p.source} (${p.factory?.country || "?"})`;
			if (!groups[key]) groups[key] = [];
			groups[key].push(p);
		}
		return groups;
	}, [prices, groupBy]);

	// bySource is still used by the per-source tables below (unchanged).
	const bySource: Record<string, PricePoint[]> = {};
	for (const p of prices) {
		const key = `${p.source} (${p.factory?.country || "?"})`;
		if (!bySource[key]) bySource[key] = [];
		bySource[key].push(p);
	}

	// Distinct factories count — shown in the toggle so the user knows how many
	// lines "by factory" will draw before committing to it.
	const factoryCount = useMemo(
		() => new Set(prices.map((p) => p.factory?.code).filter(Boolean)).size,
		[prices],
	);

	// Compute price range
	const allPrices = prices.map((p: { price: number }) => p.price);
	const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
	const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
	const latestPrice = allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0;

	return (
		<PageContainer>
			<PageHeader
				title={displayName}
				description={cut?.primal ? `Primal: ${cut.primal}` : cutCode}
			/>

			{/* Cut Info */}
			{cut && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<Card>
						<CardBody>
							<p className="text-xs text-gray-500">English</p>
							<p className="font-medium mt-1">{cut.nameEn || "--"}</p>
						</CardBody>
					</Card>
					<Card>
						<CardBody>
							<p className="text-xs text-gray-500">Chinese</p>
							<p className="font-medium mt-1">{cut.nameZh || "--"}</p>
						</CardBody>
					</Card>
					<Card>
						<CardBody>
							<p className="text-xs text-gray-500">Price Range (90d)</p>
							<p className="font-medium mt-1">
								{formatPriceRange(minPrice, maxPrice, false)}{" "}
								<span className="text-xs text-gray-400">USD/kg</span>
							</p>
						</CardBody>
					</Card>
					<Card>
						<CardBody>
							<p className="text-xs text-gray-500">Latest Price</p>
							<p className="text-2xl font-semibold mt-1">
								{formatPrice(latestPrice, false)}{" "}
								<span className="text-sm font-normal text-gray-400">USD/kg</span>
							</p>
						</CardBody>
					</Card>
				</div>
			)}

			{/* IMPS / HS Code info */}
			{cut && (cut.impsCode || cut.hsCode) && (
				<div className="flex gap-3 mb-4">
					{cut.impsCode && (
						<span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
							IMPS: {cut.impsCode}
						</span>
					)}
					{cut.hsCode && (
						<span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
							HS: {cut.hsCode}
						</span>
					)}
					{cut.subprimal && (
						<span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
							Subprimal: {cut.subprimal}
						</span>
					)}
				</div>
			)}

			{/* Price History Chart — multi-line chart (PRODUCT-SPEC §5.2 产地对比).
			    Two comparison dimensions: "by Source" (data origin / country)
			    or "by Factory" (individual producers). The backend already
			    returns all factories for the cut; switching just re-keys the
			    series, no refetch. */}
			{prices.length > 0 && (
				<Card className="mb-6">
					<CardHeader>
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<CardTitle>Price History (90d)</CardTitle>
							<div className="flex items-center gap-1 text-xs">
								<button
									type="button"
									onClick={() => setGroupBy("source")}
									className={`px-2 py-1 rounded transition-colors ${
										groupBy === "source"
											? "bg-primary text-primary-foreground"
											: "bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
									}`}
								>
									by Source
								</button>
								<button
									type="button"
									onClick={() => setGroupBy("factory")}
									className={`px-2 py-1 rounded transition-colors ${
										groupBy === "factory"
											? "bg-primary text-primary-foreground"
											: "bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
									}`}
									title={`${factoryCount} distinct factories`}
								>
									by Factory{factoryCount > 0 ? ` (${factoryCount})` : ""}
								</button>
							</div>
						</div>
					</CardHeader>
					<CardBody>
						<CutPriceHistoryChart bySource={chartGroups} />
					</CardBody>
				</Card>
			)}

			{/* AI Forecast — per-cut prediction (dual-backend, layer 1 integration).
			    Consumes /api/beef/forecasts/:cutCode; honest about forecastable:false. */}
			{cutCode && <CutForecastSection cutCode={cutCode} />}

			{/* Price History by Source */}
			{priceErr && <p className="text-sm text-destructive mb-4">Failed to load price history</p>}

			{Object.entries(bySource).map(([source, sourcePrices]) => {
				const spMin = Math.min(...sourcePrices.map((p: { price: number }) => p.price));
				const spMax = Math.max(...sourcePrices.map((p: { price: number }) => p.price));
				const range = spMax - spMin || 1;

				return (
					<Card key={source} className="mb-4">
						<CardHeader>
							<CardTitle className="text-sm">{source}</CardTitle>
						</CardHeader>
						<CardBody>
							<div className="overflow-x-auto">
								<table className="data-table">
									<thead>
										<tr>
											<th className="text-left">Date</th>
											<th className="text-left">Factory</th>
											<th className="text-right">Price</th>
											<th className="text-left">Grade</th>
											<th className="w-32">Range</th>
										</tr>
									</thead>
									<tbody>
										{sourcePrices.slice(-30).map(
											(
												p: {
													date: string;
													price: number;
													grade?: string;
													factory?: { code: string; name: string; country: string };
												},
												i: number,
											) => {
												const pct = ((p.price - spMin) / range) * 100;
												return (
													// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
													<tr key={`${p.date}-${p.factory?.code}-${i}`}>
														<td className="text-xs text-gray-500">
															{new Date(p.date).toLocaleDateString()}
														</td>
														<td className="text-xs">{p.factory ? `${p.factory.name}` : "--"}</td>
														<td className="text-right font-mono">{formatPrice(p.price, false)}</td>
														<td className="text-xs text-gray-500">{p.grade || "--"}</td>
														<td>
															<div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
																<div
																	className="bg-primary h-1.5 rounded-full"
																	style={{ width: `${Math.max(pct, 3)}%` }}
																/>
															</div>
														</td>
													</tr>
												);
											},
										)}
									</tbody>
								</table>
							</div>
						</CardBody>
					</Card>
				);
			})}

			{prices.length === 0 && !priceErr && (
				<p className="text-sm text-gray-400">No price history available for this cut.</p>
			)}
		</PageContainer>
	);
}
