"use client";

import {
	Activity,
	ChevronDown,
	ChevronRight,
	CloudSun,
	DollarSign,
	FileText,
	Ship,
	ThermometerSun,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FactorItem {
	id: string;
	type: string;
	region: string | null;
	date: string;
	value: number;
	unit: string;
	source: string;
	metadata: Record<string, unknown> | null;
}

interface MarketFactorsPanelProps {
	factors: FactorItem[];
	loading?: boolean;
}

const FACTOR_GROUPS: Record<string, { label: string; icon: typeof CloudSun; color: string }> = {
	supply_demand: { label: "Supply & Demand", icon: TrendingUp, color: "text-emerald-500" },
	economic: { label: "Economic Indicators", icon: DollarSign, color: "text-blue-500" },
	exchange_rate: { label: "Exchange Rates", icon: DollarSign, color: "text-amber-500" },
	weather: { label: "Weather", icon: CloudSun, color: "text-cyan-500" },
	shipping_cost: { label: "Shipping Costs", icon: Ship, color: "text-purple-500" },
	tariff: { label: "Tariffs & Trade", icon: FileText, color: "text-orange-500" },
	policy: { label: "Policy & Regulation", icon: FileText, color: "text-rose-500" },
	production: { label: "Production Data", icon: ThermometerSun, color: "text-green-500" },
};

const SOURCE_LABELS: Record<string, string> = {
	usda_ams: "USDA AMS",
	fao: "FAO",
	world_bank: "World Bank",
	cme: "CME",
	fred: "FRED",
	usda_psd: "USDA PSD",
	abares: "ABARES",
	seed: "System",
};

function FactorGroup({
	label,
	icon: Icon,
	color,
	factors,
}: {
	label: string;
	icon: typeof CloudSun;
	color: string;
	factors: FactorItem[];
}) {
	const [expanded, setExpanded] = useState(false);
	const latest = factors[0];

	if (!latest) return null;

	const trend =
		factors.length >= 2
			? (((latest.value - factors[1].value) / factors[1].value) * 100).toFixed(1)
			: null;

	return (
		<div className="border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
			<button
				type="button"
				className="w-full flex items-center justify-between p-3 text-left cursor-pointer"
				onClick={() => setExpanded(!expanded)}
			>
				<div className="flex items-center gap-2">
					<Icon className={`size-4 ${color}`} />
					<span className="text-sm font-medium">{label}</span>
					<span className="text-xs text-muted-foreground">({factors.length})</span>
				</div>
				<div className="flex items-center gap-3">
					<div className="text-right">
						<span className="text-sm font-semibold">{Number(latest.value).toLocaleString()}</span>
						<span className="text-xs text-muted-foreground ml-1">{latest.unit}</span>
						{trend && (
							<span
								className={`text-xs ml-2 ${Number(trend) >= 0 ? "text-green-500" : "text-red-500"}`}
							>
								{Number(trend) >= 0 ? "+" : ""}
								{trend}%
							</span>
						)}
					</div>
					{expanded ? (
						<ChevronDown className="size-4 text-muted-foreground" />
					) : (
						<ChevronRight className="size-4 text-muted-foreground" />
					)}
				</div>
			</button>
			{expanded && (
				<div className="px-3 pb-3 space-y-1.5">
					{factors.map((f) => {
						const sourceLabel = SOURCE_LABELS[f.source] || f.source;
						return (
							<div
								key={f.id}
								className="flex items-center justify-between text-xs text-muted-foreground py-1 border-t border-muted"
							>
								<div className="flex items-center gap-2">
									<span>
										{new Date(f.date).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
									</span>
									{f.region && (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{f.region}</span>
									)}
								</div>
								<div className="flex items-center gap-2">
									<span className="font-medium text-foreground">
										{Number(f.value).toLocaleString()} {f.unit}
									</span>
									<span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80">
										{sourceLabel}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

export default function MarketFactorsPanel({ factors, loading }: MarketFactorsPanelProps) {
	const grouped = useMemo(() => {
		const map = new Map<string, FactorItem[]>();
		for (const f of factors) {
			const type = f.type;
			if (!map.has(type)) map.set(type, []);
			map.get(type)!.push(f);
		}
		// Sort each group by date desc
		for (const [, items] of map) {
			items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		}
		return map;
	}, [factors]);

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>
						<div className="flex items-center gap-2">
							<Activity className="size-4" />
							<span>Market Factors</span>
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

	if (factors.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						<Activity className="size-4" />
						<span>Market Factors</span>
					</div>
				</CardTitle>
				<CardDescription>
					{factors.length} factor{factors.length !== 1 ? "s" : ""} across {grouped.size} categories
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{Object.entries(FACTOR_GROUPS).map(([type, config]) => {
						const items = grouped.get(type);
						if (!items || items.length === 0) return null;
						return (
							<FactorGroup
								key={type}
								label={config.label}
								icon={config.icon}
								color={config.color}
								factors={items}
							/>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
