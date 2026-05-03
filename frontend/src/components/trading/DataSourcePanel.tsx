"use client";

import { BarChart3, CheckCircle, Database, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommoditySourceInfo } from "@/lib/market-data";

interface DataSourcePanelProps {
	priceSources: CommoditySourceInfo[];
	factorSources: { source: string; type: string; label: string; count: number }[];
	loading?: boolean;
}

const sourceColors: Record<string, string> = {
	usda_ams: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	fao: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	world_bank: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
	cme: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	fred: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	usda_psd: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
	china_mara: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
	china_customs: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

function tierBadge(count: number) {
	if (count >= 100) return { icon: CheckCircle, color: "text-green-500", label: "Rich" };
	if (count >= 20) return { icon: TrendingUp, color: "text-amber-500", label: "Moderate" };
	return { icon: BarChart3, color: "text-gray-400", label: "Limited" };
}

function fmtDate(d: string | null) {
	if (!d) return "—";
	return new Date(d).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export default function DataSourcePanel({
	priceSources,
	factorSources,
	loading,
}: DataSourcePanelProps) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>
						<div className="flex items-center gap-2">
							<Database className="size-4" />
							<span>Data Provenance</span>
						</div>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-12 bg-muted rounded animate-pulse" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (priceSources.length === 0 && factorSources.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>
						<div className="flex items-center gap-2">
							<Database className="size-4" />
							<span>Data Provenance</span>
						</div>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No data sources available for this commodity.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						<Database className="size-4" />
						<span>Data Provenance</span>
					</div>
				</CardTitle>
				<CardDescription>
					{priceSources.length} price source{priceSources.length !== 1 ? "s" : ""}
					{factorSources.length > 0 &&
						` · ${factorSources.length} market factor source${factorSources.length !== 1 ? "s" : ""}`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{/* Price data sources */}
				{priceSources.length > 0 && (
					<div className="space-y-3 mb-4">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Price Data
						</h4>
						{priceSources.map((src) => {
							const badge = tierBadge(src.priceCount);
							const BadgeIcon = badge.icon;
							return (
								<div
									key={src.id}
									className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50"
								>
									<div className="flex items-center gap-2 min-w-0">
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceColors[src.id] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}
										>
											{src.label}
										</span>
										<span className="text-xs text-muted-foreground">
											{src.priceCount.toLocaleString()} records
										</span>
									</div>
									<div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
										<BadgeIcon className={`size-3.5 ${badge.color}`} />
										<span>
											{fmtDate(src.dateRange.from)} — {fmtDate(src.dateRange.to)}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}

				{/* Market factor sources */}
				{factorSources.length > 0 && (
					<div className="space-y-3">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Market Factors
						</h4>
						{factorSources.map((f, i) => (
							<div
								key={`${f.source}-${f.type}-${i}`}
								className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50"
							>
								<div className="flex items-center gap-2 min-w-0">
									<span
										className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceColors[f.source] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}
									>
										{f.label}
									</span>
									<span className="text-xs text-muted-foreground capitalize">
										{f.type.replace(/_/g, " ")}
									</span>
								</div>
								<span className="text-xs text-muted-foreground shrink-0">{f.count} records</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
