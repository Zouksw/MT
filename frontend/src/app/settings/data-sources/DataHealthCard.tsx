"use client";

import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

/**
 * Actual data-flow health from getDataHealth (backend round-48). Surfaced
 * alongside the scraper-run freshness because the two can disagree: a scraper
 * can "run healthy" (ingestion log success) while writing 0 real price rows
 * (silent failure), and predictions can pile up unverifiable. This makes that
 * gap visible instead of letting healthy=18 hide freshSourceCount=2.
 *
 * `null`/optional fields when the backend couldn't compute them.
 */
export interface DataHealth {
	anyDataFlowing: boolean;
	freshSourceCount: number;
	registeredSourceCount: number;
	predictionBacklog: number;
	predictionVerified: number;
	predictionStale?: number;
	/** Predictions whose commodity data source died before the horizon
	 * elapsed — permanently unverifiable. Excluded from verificationRatio
	 * denominator. Tracked so operators can see the frozen-source backlog. */
	predictionUnverifiable?: number;
	verificationRatio: number;
	hasVerificationDebt: boolean;
}

/**
 * Data-flow health card. The headline metric is the GAP between
 * `scraperHealthy` (how many scrapers ran successfully — from ingestion logs)
 * and `dataHealth.freshSourceCount` (how many actually wrote ≥1 price row in
 * the last 3 days). A large gap means scrapers are "running" but producing
 * nothing — silent failures that an all-green board would otherwise hide.
 *
 * Also surfaces prediction verification debt: when verificationRatio is near
 * zero, predictions are generated faster than actuals arrive to verify them —
 * usually because the underlying price sources are dormant.
 */
export function DataHealthCard({
	dataHealth,
	scraperHealthy,
}: {
	dataHealth: DataHealth;
	scraperHealthy: number;
}) {
	const dh = dataHealth;
	const gap = scraperHealthy - dh.freshSourceCount;
	const ratioPct = Math.round(dh.verificationRatio * 100);
	// Red when no data flows at all; amber when the gap is large OR debt is high;
	// green only when data flows AND verification is healthy.
	const tone: "error" | "warning" | "success" = !dh.anyDataFlowing
		? "error"
		: gap > 1 || dh.hasVerificationDebt
			? "warning"
			: "success";
	const toneStyles = {
		error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
		warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
		success: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
	}[tone];
	const headline =
		tone === "error"
			? "No sources are writing fresh data"
			: tone === "warning"
				? `${gap > 0 ? `${gap} of ${scraperHealthy} healthy scrapers wrote no rows; ` : ""}prediction verification is behind`
				: "Data is flowing and predictions are verifying";
	return (
		<div className={`mb-4 p-4 rounded-lg border ${toneStyles}`}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-2">
					{tone === "error" ? (
						<XCircle className="size-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
					) : tone === "warning" ? (
						<AlertCircle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
					) : (
						<CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
					)}
					<div>
						<div className="text-sm font-medium text-foreground">{headline}</div>
						<div className="text-xs text-muted-foreground mt-0.5">
							Actual price-row writes in the last 3 days, not just scraper runs
						</div>
					</div>
				</div>
				<div className="flex items-center gap-4 text-sm">
					<div className="text-center">
						<div className="text-xl font-bold text-foreground">
							{dh.freshSourceCount}/{dh.registeredSourceCount || dh.freshSourceCount}
						</div>
						<div className="text-xs text-muted-foreground">fresh sources</div>
					</div>
					{gap > 0 && (
						<div className="text-center">
							<div className="text-xl font-bold text-amber-600 dark:text-amber-400">{gap}</div>
							<div className="text-xs text-muted-foreground">ran but wrote 0</div>
						</div>
					)}
					<div className="text-center">
						<div
							className={`text-xl font-bold ${dh.hasVerificationDebt ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
						>
							{ratioPct}%
						</div>
						<div className="text-xs text-muted-foreground">verified</div>
					</div>
				</div>
			</div>
			{/* Verification debt detail — only relevant when predictions exist. */}
			{(dh.predictionBacklog > 0 || dh.predictionVerified > 0) && (
				<div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
					<span>
						Prediction verification:{" "}
						<span className="font-medium text-foreground">{dh.predictionVerified}</span> verified /{" "}
						<span className="font-medium text-foreground">{dh.predictionBacklog}</span> awaiting
						actuals
					</span>
					{dh.predictionStale !== undefined && dh.predictionStale > 0 && (
						<span>
							<span className="font-medium text-foreground">{dh.predictionStale}</span> marked stale
							(polluted / unrecoverable)
						</span>
					)}
					{dh.predictionUnverifiable !== undefined && dh.predictionUnverifiable > 0 && (
						<span>
							<span className="font-medium text-foreground">{dh.predictionUnverifiable}</span>{" "}
							unverifiable (frozen source)
						</span>
					)}
				</div>
			)}
		</div>
	);
}
