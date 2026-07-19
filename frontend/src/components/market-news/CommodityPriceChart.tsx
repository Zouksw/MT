"use client";

import { TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { tokenManager } from "@/lib/tokenManager";

/**
 * Embedded commodity price chart for the news detail page.
 *
 * When an article has a related commodity (commoditySlug), this fetches its
 * 90-day daily price history from /api/market/commodities/:slug/price and
 * renders a compact area chart inline — closing the news↔price loop on the
 * same page (PRODUCT-SPEC implies news should link to price context, not
 * just a text link).
 *
 * Renders an honest "no price history" note when the commodity has no data,
 * rather than an empty chart. Fails silently (just toasts) — the news body
 * stays readable even if the price fetch breaks.
 */

// Dynamic recharts imports (ssr:false — recharts needs the DOM).
// biome-ignore lint/suspicious/noExplicitAny: recharts types are incompatible across dynamic() — same pattern as charts/PredictionChart.tsx.
const AreaChart = dynamic(() => import("recharts").then((mod) => ({ default: mod.AreaChart })), {
	ssr: false,
}) as React.ComponentType<any>;
const Area = dynamic(() => import("recharts").then((mod) => ({ default: mod.Area })), {
	ssr: false,
}) as React.ComponentType<any>;
const XAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.XAxis })), {
	ssr: false,
}) as React.ComponentType<any>;
const YAxis = dynamic(() => import("recharts").then((mod) => ({ default: mod.YAxis })), {
	ssr: false,
}) as React.ComponentType<any>;
const Tooltip = dynamic(() => import("recharts").then((mod) => ({ default: mod.Tooltip })), {
	ssr: false,
}) as React.ComponentType<any>;
const ResponsiveContainer = dynamic(
	() => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
	{ ssr: false },
	// biome-ignore lint/suspicious/noExplicitAny: third-party library type
) as React.ComponentType<any>;

interface PricePoint {
	date: string;
	close: number;
}

interface PriceHistoryResponse {
	success: boolean;
	data?: {
		commodity: { slug: string; name: string; unit?: string };
		prices: Array<{ date: string; close: number | { toNumber: () => number } }>;
	};
}

export function CommodityPriceChart({
	commoditySlug,
	commodityLabel,
}: {
	commoditySlug: string;
	commodityLabel?: string;
}) {
	const toast = useToast();
	const [points, setPoints] = useState<PricePoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [noData, setNoData] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			setNoData(false);
			try {
				const token = tokenManager.getToken();
				const res = await fetch(
					`/api/market/commodities/${encodeURIComponent(commoditySlug)}/price?interval=daily`,
					{ headers: token ? { Authorization: `Bearer ${token}` } : {} },
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = (await res.json()) as PriceHistoryResponse;
				if (cancelled) return;
				const raw = json.data?.prices ?? [];
				// Take the last 90 points (90-day window) and normalize Decimal → number.
				const normalized: PricePoint[] = raw.slice(-90).map((p) => ({
					date: p.date,
					close: typeof p.close === "number" ? p.close : (p.close?.toNumber?.() ?? 0),
				}));
				if (normalized.length === 0) {
					setNoData(true);
					setPoints([]);
				} else {
					setPoints(normalized);
				}
			} catch (err) {
				// Non-blocking — the news body stays readable.
				toast.showError(
					err instanceof Error
						? `Price chart unavailable: ${err.message}`
						: "Price chart unavailable",
				);
				if (!cancelled) setNoData(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [commoditySlug, toast]);

	const label = commodityLabel || commoditySlug.replace(/_/g, " ");
	const first = points[0]?.close;
	const last = points[points.length - 1]?.close;
	const changePct = first && last && first > 0 ? ((last - first) / first) * 100 : null;
	const up = (changePct ?? 0) > 0.05;
	const down = (changePct ?? 0) < -0.05;
	const changeColor = up ? "#16A34A" : down ? "#DC2626" : "var(--muted-foreground)";
	const strokeColor = up ? "#16A34A" : down ? "#DC2626" : "#8B6914";

	return (
		<div className="mt-8 rounded-xl border bg-card p-5">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<TrendingUp className="size-4 text-primary" />
					<h3 className="text-sm font-display font-semibold text-foreground">
						{label} · 90-day price
					</h3>
				</div>
				{changePct != null && (
					<span
						className="text-sm font-medium tabular-nums"
						style={{ color: changeColor, fontVariantNumeric: "tabular-nums" }}
					>
						{up ? "+" : down ? "−" : ""}
						{Math.abs(changePct).toFixed(1)}%
					</span>
				)}
			</div>

			{loading ? (
				<div className="h-40 rounded-lg bg-muted animate-pulse" />
			) : noData ? (
				<p className="text-sm text-muted-foreground text-center py-10">
					No price history available for {label}.
				</p>
			) : (
				<div className="h-40">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
							<defs>
								<linearGradient id="newsPriceGrad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
									<stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
								</linearGradient>
							</defs>
							<XAxis
								dataKey="date"
								tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
								tickFormatter={(d: string) => {
									const dt = new Date(d);
									return Number.isNaN(dt.getTime())
										? ""
										: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
								}}
								stroke="var(--border)"
								minTickGap={28}
							/>
							<YAxis
								tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
								stroke="var(--border)"
								domain={["auto", "auto"]}
								width={48}
							/>
							<Tooltip
								contentStyle={{
									fontSize: 12,
									borderRadius: 8,
									border: "1px solid var(--border)",
									background: "var(--popover)",
								}}
								labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
								formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "Close"]}
							/>
							<Area
								type="monotone"
								dataKey="close"
								stroke={strokeColor}
								strokeWidth={1.5}
								fill="url(#newsPriceGrad)"
								isAnimationActive={false}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			)}
		</div>
	);
}

export default CommodityPriceChart;
