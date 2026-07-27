"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { formatPrice, formatSignedPercent } from "@/lib/format";
import { tokenManager } from "@/lib/tokenManager";

/**
 * CutForecastSection — the per-cut AI forecast panel.
 *
 * Consumes the dual-backend endpoint GET /api/beef/forecasts/:cutCode (which
 * forecasts a beef CUT via the cut:{factoryId}:{cutCode} virtual series, not
 * the old commodity-slug path). This is layer 1 of the frontend integration:
 * the natural landing point because cutCode is already in scope on the detail
 * page. See docs/PROJECT-STATE-AND-VISION-2026-07-26-v2.md §3.1.
 *
 * Honesty: when forecastable:false, renders a clear reason (data stale or
 * insufficient) instead of fabricating a prediction. Never hides the
 * "can't forecast" state.
 */

type Direction = "up" | "down" | "flat";

interface ModelForecast {
	modelId: string;
	direction: Direction;
	predictedChange: number;
	predictedPrice: number;
	confidence: number;
	status: "available" | "unavailable";
}

interface Forecast {
	direction: Direction;
	confidence: number;
	modelsAgree: number;
	totalModels: number;
	availableModels: number;
	predictedChange: number;
	predictedPrice: number;
	horizon: number;
	range: { lower: number; upper: number };
	distribution: { up: number; down: number; flat: number };
	bestModel?: string;
	individualForecasts: ModelForecast[];
}

interface ApiResponse {
	cutCode: string;
	forecastable: boolean;
	reason?: string;
	factoryId?: string;
	dataPoints?: number;
	currentPrice?: number;
	forecast?: Forecast;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Authenticated fetcher — the forecast endpoint requires login (non-public). */
async function forecastFetcher(url: string): Promise<{ data: ApiResponse }> {
	const token = tokenManager.getToken();
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${API_BASE}${url}`, { headers, credentials: "include" });
	if (!res.ok) throw new Error(`${res.status}`);
	return res.json();
}

const directionConfig: Record<
	Direction,
	{ icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
	up: { icon: TrendingUp, color: "text-success", label: "Up" },
	down: { icon: TrendingDown, color: "text-destructive", label: "Down" },
	flat: { icon: Minus, color: "text-warning", label: "Flat" },
};

const MODEL_LABELS: Record<string, string> = {
	chronos_tiny: "Chronos-T5-Tiny",
	chronos_mini: "Chronos-T5-Mini",
	chronos_base: "Chronos-T5-Base",
	arima: "ARIMA",
	holtwinters: "Holt-Winters",
	exponential_smoothing: "Exp. Smoothing",
	naive_forecaster: "Naive",
	stl_forecaster: "STL",
};

function confidenceTier(conf: number): { label: string; color: string } {
	if (conf >= 0.7) return { label: "High", color: "text-success" };
	if (conf >= 0.4) return { label: "Moderate", color: "text-warning" };
	return { label: "Low", color: "text-destructive" };
}

interface CutForecastSectionProps {
	cutCode: string;
	/** Forecast horizon in days (default 7 — the market view horizon). */
	horizon?: number;
}

export const CutForecastSection: React.FC<CutForecastSectionProps> = ({ cutCode, horizon = 7 }) => {
	const [showModels, setShowModels] = useState(false);
	const { data, error, isLoading } = useRetryableFetch(
		`/api/beef/forecasts/${cutCode}?horizon=${horizon}`,
		forecastFetcher,
	);

	const resp = data?.data;

	if (isLoading) {
		return (
			<Card className="mb-4">
				<CardHeader>
					<CardTitle className="text-sm">AI Forecast (7-day)</CardTitle>
				</CardHeader>
				<CardBody>
					<div className="h-16 bg-muted rounded animate-pulse" />
				</CardBody>
			</Card>
		);
	}

	// 401 (not logged in) — render a soft prompt rather than an error.
	if (error && String(error).includes("401")) {
		return (
			<Card className="mb-4">
				<CardHeader>
					<CardTitle className="text-sm">AI Forecast (7-day)</CardTitle>
				</CardHeader>
				<CardBody>
					<p className="text-xs text-muted-foreground">
						<a href="/login" className="text-primary hover:underline">
							Log in
						</a>{" "}
						to see the AI price forecast for this cut.
					</p>
				</CardBody>
			</Card>
		);
	}

	if (error || !resp) {
		return null; // silent fail — forecast is enhancement, not critical
	}

	// Honest "can't forecast" state.
	if (!resp.forecastable) {
		return (
			<Card className="mb-4">
				<CardHeader>
					<CardTitle className="text-sm">AI Forecast (7-day)</CardTitle>
				</CardHeader>
				<CardBody>
					<p className="text-xs text-muted-foreground">{resp.reason}</p>
				</CardBody>
			</Card>
		);
	}

	const f = resp.forecast!;
	const cfg = directionConfig[f.direction];
	const DirectionIcon = cfg.icon;
	const tier = confidenceTier(f.confidence);

	return (
		<Card className="mb-4">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">AI Forecast ({horizon}-day)</CardTitle>
					<span className="text-xs text-muted-foreground">
						Based on {resp.dataPoints} data points
					</span>
				</div>
			</CardHeader>
			<CardBody>
				{/* Consensus headline */}
				<div className="flex items-center gap-4 mb-4">
					<div className={`flex items-center gap-1.5 ${cfg.color}`}>
						<DirectionIcon className="size-6" />
						<span className="text-xl font-semibold">{cfg.label}</span>
					</div>
					<div className="flex-1">
						<div className="text-lg font-mono">
							<span className="text-muted-foreground">
								{formatPrice(resp.currentPrice ?? 0, false)}
							</span>
							<span className="mx-2 text-gray-400">→</span>
							<span className="font-semibold">{formatPrice(f.predictedPrice, false)}</span>
							<span className="ml-1 text-xs text-gray-400">USD/kg</span>
						</div>
						<div
							className={`text-sm ${f.predictedChange >= 0 ? "text-success" : "text-destructive"}`}
						>
							{formatSignedPercent(f.predictedChange)} over {horizon} days
						</div>
					</div>
				</div>

				{/* Stats grid */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
					<div>
						<p className="text-xs text-gray-500">Confidence</p>
						<p className={`text-sm font-medium ${tier.color}`}>
							{Math.round(f.confidence * 100)}% <span className="text-xs">({tier.label})</span>
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500">Models agree</p>
						<p className="text-sm font-medium">
							{f.modelsAgree}/{f.availableModels}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500">Range</p>
						<p className="text-sm font-mono">
							{formatPrice(f.range.lower, false)}–{formatPrice(f.range.upper, false)}
						</p>
					</div>
					<div>
						<p className="text-xs text-gray-500">Best model</p>
						<p className="text-sm font-medium">
							{f.bestModel ? (MODEL_LABELS[f.bestModel] ?? f.bestModel) : "--"}
						</p>
					</div>
				</div>

				{/* Distribution bar */}
				<div className="mb-4">
					<div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
						{f.distribution.up > 0 && (
							<div
								className="bg-success"
								style={{ width: `${(f.distribution.up / f.totalModels) * 100}%` }}
							/>
						)}
						{f.distribution.flat > 0 && (
							<div
								className="bg-warning"
								style={{ width: `${(f.distribution.flat / f.totalModels) * 100}%` }}
							/>
						)}
						{f.distribution.down > 0 && (
							<div
								className="bg-destructive"
								style={{ width: `${(f.distribution.down / f.totalModels) * 100}%` }}
							/>
						)}
					</div>
					<div className="flex justify-between text-xs text-gray-400 mt-1">
						<span className="text-success">▲ {f.distribution.up}</span>
						<span className="text-warning">◆ {f.distribution.flat}</span>
						<span className="text-destructive">▼ {f.distribution.down}</span>
					</div>
				</div>

				{/* Per-model breakdown (collapsible) */}
				<button
					type="button"
					onClick={() => setShowModels((v) => !v)}
					className="text-xs text-primary hover:underline"
				>
					{showModels ? "Hide" : "Show"} {f.availableModels} model details
				</button>
				{showModels && (
					<div className="mt-3 space-y-1.5">
						{f.individualForecasts.map((m) => {
							const mc = directionConfig[m.direction];
							const MIcon = mc.icon;
							return (
								<div
									key={m.modelId}
									className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0"
								>
									<span className="text-gray-600 dark:text-gray-400">
										{MODEL_LABELS[m.modelId] ?? m.modelId}
									</span>
									<div className="flex items-center gap-3">
										{m.status === "unavailable" ? (
											<span className="text-gray-400">unavailable</span>
										) : (
											<>
												<span className={`flex items-center gap-1 ${mc.color}`}>
													<MIcon className="size-3" />
													{formatSignedPercent(m.predictedChange)}
												</span>
												<span className="text-gray-400 font-mono w-10 text-right">
													{Math.round(m.confidence * 100)}%
												</span>
											</>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardBody>
		</Card>
	);
};

export default CutForecastSection;
