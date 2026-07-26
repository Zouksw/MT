"use client";

import { ArrowDownRight, ArrowUpRight, Lock, Minus, Sparkles } from "lucide-react";
import { useBeefCutForecasts } from "@/hooks/useBeefCutForecasts";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { beefFetcher } from "@/lib/beef";
import { formatDecimal, formatPrice, formatSignedPercent } from "@/lib/format";
import { tokenManager } from "@/lib/tokenManager";

/**
 * Market Forecast Board — the product's signature AI-in-market-row experience.
 *
 * Layer 3 of the frontend integration: this board now consumes CUT-level data
 * (BeefCutTaxonomy + BeefCutPrice + the dual-backend /api/beef/forecasts
 * batch), NOT the legacy commodity-slug path. The old implementation hit
 * /market/commodities + /signals/batch keyed by slug, which was disconnected
 * from the price table's cutCode rows AND linked to /beef/cuts/:slug (wrong —
 * slug is not a cutCode). This version keys everything by cutCode, so the
 * forecast, the latest price, and the cut-detail link are all consistent.
 *
 * PRODUCT-SPEC §5.3: the forecast lives next to the price, each row surfaces
 * the full multi-model consensus (direction / change / confidence / model
 * agreement / range), not a subpage.
 *
 * Honesty: cuts absent from the batch forecast map (stale/insufficient data)
 * are omitted from the board rather than shown with fabricated values. If the
 * whole map is empty (demo snapshot mode), the board shows an honest empty
 * state naming the activation path.
 */
export function MarketForecastBoard() {
	const hasToken = typeof window !== "undefined" && !!tokenManager.getToken();

	// Latest cut prices (same source as the price table) — gives us the cut
	// list + current price + display names. Reuse beefFetcher (cookie auth).
	const { data: pricesData, isLoading: pricesLoading } = useRetryableFetch(
		"/api/beef/prices/latest",
		beefFetcher,
	);
	// Batch cut-level forecasts — one fetch, all cuts.
	const { forecasts: cutForecasts, isLoading: forecastsLoading } = useBeefCutForecasts(7);

	const allPrices = (pricesData?.data?.prices ?? pricesData?.prices ?? []) as Array<{
		cutCode: string;
		price: number;
	}>;

	// One row per cutCode: latest price + forecast (if forecastable).
	// Cuts with no forecast in the batch map are forecastable:false — we keep
	// them in pricedOnly but exclude from the forecastable board.
	const seenCut = new Set<string>();
	const rows: Array<{
		cutCode: string;
		latestPrice: number | null;
		forecastEnd: number | null;
		changePct: number | null;
		direction: "up" | "down" | "flat" | null;
		confidence: number | null;
		modelsAgree: number | null;
		totalModels: number | null;
	}> = [];

	for (const p of allPrices) {
		if (seenCut.has(p.cutCode)) continue; // dedupe cutCodes (many factory rows)
		seenCut.add(p.cutCode);
		const fc = cutForecasts?.[p.cutCode];
		rows.push({
			cutCode: p.cutCode,
			latestPrice: p.price ?? null,
			forecastEnd: fc?.predictedPrice ?? null,
			changePct: fc?.predictedChange ?? null,
			direction: fc?.direction ?? null,
			confidence: fc?.confidence ?? null,
			modelsAgree: fc?.modelsAgree ?? null,
			totalModels: fc?.availableModels ?? null,
		});
	}

	const forecastable = rows.filter(
		(r) => r.latestPrice != null && r.forecastEnd != null && r.changePct != null,
	);
	const pricedOnly = rows.filter((r) => r.latestPrice != null);
	const loading = pricesLoading || (hasToken && forecastsLoading);

	return (
		<section className="rounded-xl border bg-card">
			<header className="flex items-center justify-between gap-3 px-5 py-4 border-b">
				<div className="flex items-center gap-2">
					<Sparkles className="size-4 text-primary" />
					<h2 className="text-h4 font-display font-semibold text-foreground">AI Price Forecast</h2>
					<span className="text-xs text-muted-foreground">
						7-day outlook · multi-model consensus
					</span>
				</div>
				<PermissionBadge hasToken={hasToken} loading={loading} />
			</header>

			{loading ? (
				<div className="p-5 space-y-2">
					{[0, 1, 2].map((i) => (
						<div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
					))}
				</div>
			) : forecastable.length > 0 ? (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left text-xs text-muted-foreground border-b">
								<th className="px-5 py-2 font-medium">Cut</th>
								<th className="px-3 py-2 font-medium text-right">Latest</th>
								<th className="px-3 py-2 font-medium text-right">7d Forecast</th>
								<th className="px-3 py-2 font-medium text-right">Change</th>
								<th className="px-3 py-2 font-medium text-right">Confidence</th>
								<th className="px-5 py-2 font-medium text-right">Models</th>
							</tr>
						</thead>
						<tbody>
							{forecastable.map((r) => {
								const up = (r.changePct ?? 0) > 0.05;
								const down = (r.changePct ?? 0) < -0.05;
								const changeColor = up
									? "text-success"
									: down
										? "text-destructive"
										: "text-muted-foreground";
								const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
								return (
									<tr key={r.cutCode} className="border-b last:border-0 hover:bg-muted/40">
										<td className="px-5 py-3">
											<a
												href={`/beef/cuts/${r.cutCode}`}
												className="font-medium text-foreground hover:text-primary"
											>
												{r.cutCode.replace(/_/g, " ")}
											</a>
										</td>
										<td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
											{formatPrice(r.latestPrice, false)}
										</td>
										<td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
											{formatDecimal(r.forecastEnd, 2)}
										</td>
										<td className={`px-3 py-3 text-right font-medium tabular-nums ${changeColor}`}>
											<span className="inline-flex items-center justify-end gap-0.5">
												<Arrow className="size-3.5" />
												{formatSignedPercent(r.changePct, 1)}
											</span>
										</td>
										<td className="px-3 py-3 text-right tabular-nums text-foreground">
											{r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "--"}
										</td>
										<td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground">
											{r.modelsAgree != null && r.totalModels != null
												? `${r.modelsAgree}/${r.totalModels}`
												: "--"}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : pricedOnly.length > 0 ? (
				<div className="p-5">
					<PermissionMessage hasToken={hasToken} />
				</div>
			) : (
				<div className="p-8 text-center text-sm text-muted-foreground">
					No beef cuts with fresh price data yet. Forecasts will appear here once a beef data source
					is activated (USDA MARS API, MLA API, or manual CSV import) — the honesty framework
					requires fresh, non-bridge data to forecast.
				</div>
			)}
		</section>
	);
}

function PermissionBadge({ hasToken, loading }: { hasToken: boolean; loading: boolean }) {
	if (loading) return <span className="text-xs text-muted-foreground">Loading…</span>;
	if (!hasToken) {
		return (
			<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
				<Lock className="size-3" />
				Sign in for forecast
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
			<span className="inline-block size-1.5 rounded-full bg-primary" />
			AI active
		</span>
	);
}

function PermissionMessage({ hasToken }: { hasToken: boolean }) {
	if (!hasToken) {
		return (
			<p className="text-sm text-muted-foreground">
				<a href="/login" className="text-primary hover:underline">
					Sign in
				</a>{" "}
				to see AI price forecasts for these cuts.
			</p>
		);
	}
	return (
		<p className="text-sm text-muted-foreground">
			No fresh cut-level data available for forecasting. Price data on this page is currently a
			snapshot — activate a beef data source (USDA MARS, MLA, or manual import) to enable real-time
			AI forecasts per cut.
		</p>
	);
}

export default MarketForecastBoard;
