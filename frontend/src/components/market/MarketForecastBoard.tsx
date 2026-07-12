"use client";

import { ArrowDownRight, ArrowUpRight, Lock, Minus, Sparkles } from "lucide-react";
import { type ForecastPermission, useMarketForecasts } from "@/hooks/useMarketForecasts";
import { formatDecimal, formatPriceRange, formatSignedPercent } from "@/lib/format";

/**
 * Market Forecast Board — the product's signature AI-in-market-row experience.
 *
 * Renders beef commodities with their latest price alongside a 7-day AI forecast
 * (change % + confidence band), inline. This is where AINode-style prediction
 * meets the 牧集网-style market board: the forecast is not a subpage, it lives
 * next to the price.
 *
 * Color rule (enforced here): green = forecast up, red = forecast down ONLY.
 * The confidence band is neutral/foreground; permission/upgrade affordances use
 * primary (gold), never directional colors.
 */
export function MarketForecastBoard() {
	const { rows, loading, permission, horizon } = useMarketForecasts(7);

	const forecastable = rows.filter(
		(r) => r.latestPrice != null && r.forecastEnd != null && r.changePct != null,
	);
	const pricedOnly = rows.filter((r) => r.latestPrice != null);

	return (
		<section className="rounded-xl border bg-card">
			<header className="flex items-center justify-between gap-3 px-5 py-4 border-b">
				<div className="flex items-center gap-2">
					<Sparkles className="size-4 text-primary" />
					<h2 className="text-h4 font-display font-semibold text-foreground">AI Price Forecast</h2>
					<span className="text-xs text-muted-foreground">{horizon}-day outlook</span>
				</div>
				<PermissionBadge permission={permission} />
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
								<th className="px-5 py-2 font-medium text-right">95% Band</th>
							</tr>
						</thead>
						<tbody>
							{forecastable.map((r) => {
								const up = (r.changePct ?? 0) > 0.05;
								const down = (r.changePct ?? 0) < -0.05;
								const changeColor = up
									? "text-green-600 dark:text-green-400"
									: down
										? "text-red-600 dark:text-red-400"
										: "text-muted-foreground";
								const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
								return (
									<tr key={r.slug} className="border-b last:border-0 hover:bg-muted/40">
										<td className="px-5 py-3">
											<a
												href={`/beef/cuts/${r.slug}`}
												className="font-medium text-foreground hover:text-primary"
											>
												{r.name}
											</a>
											{r.nameCn && (
												<span className="ml-2 text-xs text-muted-foreground">{r.nameCn}</span>
											)}
										</td>
										<td
											className="px-3 py-3 text-right font-mono tabular-nums text-foreground"
											style={{ fontVariantNumeric: "tabular-nums" }}
										>
											{formatDecimal(r.latestPrice, 2)}
										</td>
										<td
											className="px-3 py-3 text-right font-mono tabular-nums text-foreground"
											style={{ fontVariantNumeric: "tabular-nums" }}
										>
											{formatDecimal(r.forecastEnd, 2)}
										</td>
										<td className={`px-3 py-3 text-right font-medium tabular-nums ${changeColor}`}>
											<span className="inline-flex items-center justify-end gap-0.5">
												<Arrow className="size-3.5" />
												{formatSignedPercent(r.changePct, 1)}
											</span>
										</td>
										<td
											className="px-5 py-3 text-right font-mono tabular-nums text-xs text-muted-foreground"
											style={{ fontVariantNumeric: "tabular-nums" }}
										>
											{r.lowerBound != null && r.upperBound != null
												? formatPriceRange(r.lowerBound, r.upperBound, false)
												: "--"}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : pricedOnly.length > 0 ? (
				// Prices exist but no forecasts returned — likely permission or model issue.
				<div className="p-5">
					<PermissionMessage permission={permission} />
				</div>
			) : (
				<div className="p-8 text-center text-sm text-muted-foreground">
					No beef commodities with price history yet. Forecasts will appear here once price data is
					ingested.
				</div>
			)}
		</section>
	);
}

function PermissionBadge({ permission }: { permission: ForecastPermission }) {
	if (permission === "allowed") {
		return (
			<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
				<span className="inline-block size-1.5 rounded-full bg-primary" />
				AI active
			</span>
		);
	}
	if (permission === "loading") {
		return <span className="text-xs text-muted-foreground">Loading…</span>;
	}
	return (
		<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
			<Lock className="size-3" />
			{permission === "no-token" ? "Sign in for forecast" : "Pro feature"}
		</span>
	);
}

function PermissionMessage({ permission }: { permission: ForecastPermission }) {
	if (permission === "no-token") {
		return (
			<p className="text-sm text-muted-foreground">
				<a href="/login" className="text-primary hover:underline">
					Sign in
				</a>{" "}
				to see AI price forecasts for these cuts.
			</p>
		);
	}
	if (permission === "denied") {
		return (
			<p className="text-sm text-muted-foreground">
				AI forecasts are a Pro feature.{" "}
				<a href="/pricing" className="text-primary hover:underline">
					Upgrade
				</a>{" "}
				to unlock 7-day price predictions.
			</p>
		);
	}
	return (
		<p className="text-sm text-muted-foreground">Forecasts unavailable for these cuts right now.</p>
	);
}

export default MarketForecastBoard;
