"use client";

import { ArrowRight, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import type React from "react";
import { HexGrid } from "@/components/ui/GeometricArt";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";
import { usePublicHighlights } from "@/hooks/usePublicHighlights";
import { SITE_STATS } from "@/lib/site-stats";

/**
 * Static SVG sparkline over REAL series points from the public highlights
 * endpoint (batch 1). Replaces the old animated canvas that cycled a fake
 * DATA_STREAM — the landing page must never fabricate market data.
 */
function LiveSparkline({ points }: { points: number[] }) {
	if (points.length < 2) return null;
	const min = Math.min(...points);
	const max = Math.max(...points);
	const span = max - min || 1;
	const W = 100;
	const H = 40;
	const step = W / (points.length - 1);
	const coords = points.map(
		(v, i) => `${(i * step).toFixed(2)},${(H - ((v - min) / span) * (H - 6) - 3).toFixed(2)}`,
	);
	const last = coords[coords.length - 1].split(",");

	return (
		<svg
			viewBox={`0 0 ${W} ${H}`}
			preserveAspectRatio="none"
			className="w-full h-24 md:h-32"
			role="img"
			aria-label="Recent price trend"
		>
			<polyline
				points={coords.join(" ")}
				fill="none"
				stroke="rgba(139, 105, 20, 0.7)"
				strokeWidth="1.5"
				vectorEffect="non-scaling-stroke"
			/>
			<circle cx={last[0]} cy={last[1]} r="1.6" fill="rgba(139, 105, 20, 0.9)" />
		</svg>
	);
}

/** Honest panel body when the live feed is unavailable — no fabricated numbers. */
function MaintenancePanel() {
	return (
		<div className="rounded-2xl bg-background p-4 text-white">
			<div className="mb-3 flex items-center gap-1.5">
				<div className="size-2 rounded-full bg-white/20" />
				<div className="size-2 rounded-full bg-white/20" />
				<div className="size-2 rounded-full bg-white/20" />
			</div>
			<div className="flex h-64 flex-col items-center justify-center gap-2 rounded-md bg-white/5 px-4">
				<TrendingUp size={20} className="text-muted-foreground" />
				<p className="text-sm font-medium text-muted-foreground">Market data unavailable</p>
				<p className="text-xs text-gray-500">Live feed maintenance — no sample data shown.</p>
			</div>
		</div>
	);
}

const features = [
	{
		title: "Cut-Level Pricing",
		description: `${SITE_STATS.beefCuts} standardized beef cuts with factory-level pricing across US, Brazil, Australia, Uruguay, and Argentina`,
		span: "md:col-span-2",
	},
	{
		title: "AI Price Forecasting",
		description:
			"9-model forecast engine (pretrained Chronos + statistical baselines) with a quality-weighted consensus — every model's MAPE is auto-verified, and models verified worse than the naive baseline are eliminated from the vote",
		span: "",
	},
	{
		title: "Global Trade Flows",
		description:
			"Export volume and FOB pricing from Brazil, Uruguay, Australia — the world's largest beef exporters",
		span: "",
	},
];

export const Hero: React.FC = () => {
	const { live, loading } = usePublicHighlights();

	const dayUp = (live?.dayChangePct ?? 0) > 0;
	const updatedLabel = live?.latest?.date
		? new Date(live.latest.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
		: "";

	return (
		<section className="relative overflow-hidden bg-white dark:bg-background min-h-[100dvh] flex items-center">
			{/* HexGrid SVG background */}
			<HexGrid />

			<div className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:py-36 lg:py-48 w-full">
				{/* Asymmetric split: text left, dashboard right */}
				<div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-center">
					{/* Left: Text content (3/5) */}
					<div className="lg:col-span-3">
						<MotionReveal>
							<p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-primary">
								{`${SITE_STATS.beefCuts} beef cuts · ${SITE_STATS.aiModels} AI models · ${SITE_STATS.sourceCountries} export markets`}
							</p>
						</MotionReveal>

						<MotionReveal delay={0.1}>
							<h1 className="text-4xl sm:text-5xl lg:text-7xl tracking-tighter font-semibold text-gray-900 dark:text-white">
								Global Beef Trade
								<br />
								{/* Brand moment: gold gradient on dark only — light mode keeps the
								 * flat AA-safe primary (bright golds fail contrast on white) */}
								<span className="text-primary dark:bg-gradient-to-r dark:from-[#E3C566] dark:via-[#D4B04A] dark:to-[#A8821C] dark:bg-clip-text dark:text-transparent">
									Intelligence, Decoded
								</span>
							</h1>
						</MotionReveal>

						<MotionReveal delay={0.2}>
							<p className="mt-6 max-w-xl text-lg font-medium text-muted-foreground leading-relaxed">
								Factory-level cut pricing from{" "}
								<span className="font-mono text-primary">{SITE_STATS.factories} export plants</span>{" "}
								across {SITE_STATS.sourceCountries} countries. AI price forecasting, export flow
								tracking, and supply chain monitoring — all in one platform.
							</p>
						</MotionReveal>

						<MotionReveal delay={0.3}>
							<div className="mt-8 flex flex-wrap gap-4">
								<a
									href="/register"
									className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
								>
									Start Tracking Beef Prices
									<ArrowRight size={16} />
								</a>
								<a
									href="#features"
									className="inline-flex items-center gap-2 rounded-full border border-black/20 px-6 py-3 text-sm font-semibold text-black hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5 transition-colors"
								>
									See How It Works
								</a>
							</div>
						</MotionReveal>

						{/* Metrics bar */}
						<MotionReveal delay={0.4}>
							<div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground font-mono tabular-nums">
								<div className="flex items-center gap-2">
									<span className="text-primary font-semibold text-lg">{SITE_STATS.beefCuts}</span>
									<span>Beef Cuts Tracked</span>
								</div>
								<div className="w-px h-4 bg-muted" />
								<div className="flex items-center gap-2">
									<span className="text-primary font-semibold text-lg">{SITE_STATS.aiModels}</span>
									<span>Forecast Models</span>
								</div>
								<div className="w-px h-4 bg-muted" />
								<div className="flex items-center gap-2">
									<span className="text-primary font-semibold text-lg">
										{SITE_STATS.sourceCountries}
									</span>
									<span>Export Markets</span>
								</div>
							</div>
						</MotionReveal>
					</div>

					{/* Right: Live market panel (2/5) — real whitelisted series from the
					 * public highlights endpoint. Previously this panel showed hardcoded
					 * sample prices + a fake sparkline + a fabricated "78% consensus"
					 * signal (batch 1 honesty fix). */}
					<div className="lg:col-span-2">
						<MotionReveal delay={0.3}>
							{loading ? (
								<div className="rounded-2xl bg-background p-4 text-white">
									<div className="mb-3 flex items-center gap-1.5">
										<div className="size-2 rounded-full bg-white/20" />
										<div className="size-2 rounded-full bg-white/20" />
										<div className="size-2 rounded-full bg-white/20" />
									</div>
									<div className="h-64 animate-pulse rounded-md bg-white/5" />
								</div>
							) : !live ? (
								<MaintenancePanel />
							) : (
								<div className="rounded-2xl bg-background p-4 text-white">
									{/* Window chrome — 3 dots */}
									<div className="mb-3 flex items-center gap-1.5">
										<div className="size-2 rounded-full bg-white/20" />
										<div className="size-2 rounded-full bg-white/20" />
										<div className="size-2 rounded-full bg-white/20" />
									</div>

									{/* Header bar */}
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<TrendingUp size={16} className="text-primary" />
											<span className="text-sm font-medium text-muted-foreground">{live.name}</span>
										</div>
										<div className="flex items-center gap-2">
											<div className="size-1.5 rounded-full bg-success" />
											<span className="text-xs text-muted-foreground font-medium">
												Live · {updatedLabel}
											</span>
										</div>
									</div>

									{/* Latest value + day change. Rendered WITHOUT a "$" prefix: the
									 * raw series value plus its stored unit and source series id
									 * stay traceable — the unit's real-world denomination is
									 * under verification (KNOWN-ISSUES, 2026-08-23), so the panel
									 * must not over-assert currency semantics. Day-change % and
									 * the sparkline are unit-invariant. */}
									<div className="mb-3 flex items-baseline justify-between px-3 py-2.5 rounded-md bg-white/5">
										<div className="flex items-baseline gap-2">
											<span className="text-2xl font-mono font-semibold tabular-nums">
												{live.latest?.close.toFixed(2)}
											</span>
											<span className="text-xs text-gray-500">{live.unit}</span>
										</div>
										{live.dayChangePct !== null &&
											live.dayChangePct !== undefined &&
											live.dayChangePct !== 0 && (
												<span
													className={`flex items-center gap-1 text-xs font-mono tabular-nums ${dayUp ? "text-success" : "text-destructive"}`}
												>
													{dayUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
													{dayUp ? "+" : ""}
													{live.dayChangePct.toFixed(2)}%
												</span>
											)}
									</div>

									{/* Real sparkline */}
									<LiveSparkline points={(live.series ?? []).map((p) => p.close)} />

									{/* Series provenance bar — replaces the fabricated
									 * "AI Consensus · Price Up · 78%" signal. */}
									<div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-md bg-white/5">
										<Gauge size={14} className="text-primary" />
										<span className="text-xs font-medium text-muted-foreground">Daily series</span>
										<span className="ml-auto text-xs text-gray-500 font-mono tabular-nums">
											{live.seriesId ? `${live.seriesId} · ` : ""}
											{live.series?.length ?? 0} pts · {live.latest?.source}
										</span>
									</div>
								</div>
							)}
						</MotionReveal>
					</div>
				</div>

				{/* Bento Feature Cards — outline style */}
				<StaggerContainer className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
					{features.map((feature, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
						<StaggerChild key={i} className={`${feature.span}`}>
							<div className="group relative rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08] bg-white dark:bg-gray-950 p-6 transition-all duration-300 hover:ring-black/[0.12] dark:hover:ring-[#A8821C]/30 dark:hover:shadow-[0_8px_32px_-16px_rgba(0,0,0,0.6)]">
								<div className="relative z-10">
									<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
										{feature.title}
									</h3>
									<p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
								</div>
							</div>
						</StaggerChild>
					))}
				</StaggerContainer>
			</div>
		</section>
	);
};

export default Hero;
