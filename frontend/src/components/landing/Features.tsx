"use client";

import type React from "react";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";
import { SITE_STATS } from "@/lib/site-stats";

interface Feature {
	title: string;
	description: string;
	details: string[];
	span: string;
	visual: "cuts" | "trade" | null;
	goldAccent?: boolean;
	/** Optional public cross-entry (track record, landing-cost tool). */
	href?: string;
	hrefLabel?: string;
}

const features: Feature[] = [
	{
		title: "Cut-Level Pricing",
		description: `${SITE_STATS.beefCuts} standardized beef cuts — IMPS-coded, multilingual — priced at factory level across ${SITE_STATS.factories} export plants in ${SITE_STATS.sourceCountries} countries.`,
		details: [`${SITE_STATS.beefCuts} cuts`, "IMPS/HS codes", "Factory-level"],
		span: "md:col-span-2",
		visual: "cuts",
	},
	{
		title: "AI Price Forecasting",
		description: `${SITE_STATS.aiModels}-model consensus engine — pretrained Chronos and statistical baselines (ARIMA, STL, Holt-Winters) run on every forecast. The vote is quality-weighted by verified MAPE; models worse than the naive baseline are eliminated. Every forecast carries confidence intervals and is auto-verified.`,
		details: [
			"Quality-weighted consensus",
			"Chronos + statistical models",
			"MAPE auto-verification",
		],
		span: "",
		visual: null,
		goldAccent: true,
		href: "/ai/track-record",
		hrefLabel: "See the public track record →",
	},
	{
		title: "Landing Cost Calculator",
		description:
			"FX × benchmark × duty → landed RMB/kg. Build your own import cost reference from whitelisted live series (weekly US 90CL import benchmark, IMF monthly beef, CME cattle) plus your own tariff, freight, and loss assumptions — every input dated and traceable. Free, no account required.",
		details: ["Public tool", "Weekly 90CL benchmark", "Traceable inputs"],
		span: "md:col-span-2",
		visual: null,
		href: "/tools/landing-cost",
		hrefLabel: "Open the calculator →",
	},
	{
		title: "Export Trade Flows",
		description:
			"Brazil, Uruguay, Australia, Argentina, US — export volumes, FOB prices, and destination analysis by HS code (0201/0202).",
		details: ["Volume tracking", "FOB pricing", `${SITE_STATS.sourceCountries} markets`],
		span: "md:col-span-2",
		visual: "trade",
	},
	{
		title: "Supply Chain Monitor",
		description:
			"Weekly slaughter data, cold storage inventory, and herd statistics — the fundamentals behind price movements.",
		details: ["Slaughter data", "Cold storage", "Herd stats"],
		span: "",
		visual: null,
	},
	{
		title: "Correlation Analysis",
		description:
			"FX rates, feed costs, shipping indices, and weather — correlated with beef cut prices via Pearson coefficient.",
		details: ["FX correlation", "Feed costs", "Shipping rates"],
		span: "",
		visual: null,
	},
	{
		title: "Price Alerts",
		description:
			"Custom thresholds on any cut or market. Breakout and reversal detection with factor attribution, refreshed every few minutes.",
		details: ["Cut thresholds", "Trend alerts", "Factor context"],
		span: "",
		visual: null,
	},
];

const metrics = [
	{ value: String(SITE_STATS.beefCuts), label: "Beef Cuts" },
	{ value: String(SITE_STATS.aiModels), label: "AI Models" },
	{ value: String(SITE_STATS.factories), label: "Export Factories" },
	{ value: String(SITE_STATS.sourceCountries), label: "Markets" },
];

function CutsVisual() {
	// Real rows from beef_cut_taxonomy (verified 2026-08-23) — coverage facts,
	// not fabricated prices (batch 1 honesty fix).
	const cuts = [
		{ name: "Chuck Roll", primal: "Chuck", imps: "116A" },
		{ name: "Ribeye Lip-On", primal: "Rib", imps: "112D" },
		{ name: "Brisket Point End", primal: "Brisket", imps: "120" },
		{ name: "Striploin", primal: "Loin", imps: "180" },
		{ name: "Flank Steak", primal: "Flank", imps: "193" },
		{ name: "Tenderloin", primal: "Loin", imps: "189A" },
	];

	return (
		<div className="mt-4 grid grid-cols-2 gap-2">
			{cuts.map((c) => (
				<div
					key={c.name}
					className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-700/30"
				>
					<span className="text-xs text-muted-foreground truncate">{c.name}</span>
					<div className="flex items-center gap-2">
						<span className="text-xs text-gray-500">{c.primal}</span>
						<span className="text-xs font-mono text-gray-900 dark:text-white tabular-nums">
							IMPS {c.imps}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

function TradeVisual() {
	// Real integration facts (which origin writes what) — the previous version
	// showed fabricated corridor volumes ("1.2Mt +8%").
	const flows = [
		{ origin: "🇺🇸 US", what: "USDA AMS carcass quotes" },
		{ origin: "🇧🇷 Brazil", what: "SECEX export data" },
		{ origin: "🇦🇺 Australia", what: "MLA NLRS cut pricing" },
	];

	return (
		<div className="mt-4 space-y-2">
			{flows.map((f) => (
				<div
					key={f.origin}
					className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-700/30"
				>
					<span className="text-xs text-muted-foreground">{f.origin}</span>
					<span className="ml-auto text-xs text-gray-500">{f.what}</span>
				</div>
			))}
		</div>
	);
}

export const Features: React.FC = () => {
	return (
		<section
			id="features"
			className="relative overflow-hidden bg-white dark:bg-background px-6 py-24 md:py-36 lg:py-48"
		>
			<div className="relative z-10 mx-auto max-w-6xl">
				{/* Header */}
				<div className="mb-12 md:mb-16 lg:mb-20 max-w-2xl">
					<MotionReveal>
						<span className="mb-4 block font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Features
						</span>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<h2
							className="font-display text-3xl font-semibold text-gray-900 dark:text-white md:text-4xl lg:text-5xl"
							style={{ letterSpacing: "-2.4px" }}
						>
							Beef trade analytics, end to end
						</h2>
					</MotionReveal>
					<MotionReveal delay={0.15}>
						<p className="mt-4 text-lg text-muted-foreground">
							Cut-level pricing, export flows, AI forecasting, supply chain monitoring —
							purpose-built for the global beef trade.
						</p>
					</MotionReveal>
				</div>

				{/* Metrics strip */}
				<StaggerContainer className="mb-16 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 lg:mb-20">
					{metrics.map((metric, index) => (
						<StaggerChild key={metric.label}>
							<div
								className={`group rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08] bg-white dark:bg-gray-950 p-5 md:p-7 text-center transition-all duration-300 hover:ring-black/[0.12] dark:hover:ring-white/[0.14] ${index === 0 ? "md:py-9" : ""}`}
							>
								<div className="font-mono text-2xl font-semibold text-primary md:text-3xl tabular-nums">
									{metric.value}
								</div>
								<div className="mt-1 text-sm text-muted-foreground">{metric.label}</div>
							</div>
						</StaggerChild>
					))}
				</StaggerContainer>

				{/* Features Grid */}
				<StaggerContainer className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:gap-6 grid-flow-dense">
					{features.map((feature) => (
						<StaggerChild key={feature.title} className={feature.span}>
							<div
								className={`group rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08] bg-white dark:bg-gray-950 p-5 md:p-6 transition-all duration-300 hover:ring-black/[0.12] dark:hover:ring-white/[0.14] h-full${feature.goldAccent ? " bg-[rgba(139, 105, 20,0.03)] dark:bg-[rgba(139, 105, 20,0.06)]" : ""}`}
							>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
									{feature.title}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									{feature.description}
								</p>

								{/* Visual data inside wide cards */}
								{feature.visual === "cuts" && <CutsVisual />}
								{feature.visual === "trade" && <TradeVisual />}

								<div className="mt-4 flex flex-wrap gap-2">
									{feature.details.map((detail) => (
										<span
											key={detail}
											className="bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary rounded-full"
										>
											{detail}
										</span>
									))}
								</div>

								{feature.href && feature.hrefLabel && (
									<a
										href={feature.href}
										className="mt-4 inline-block text-sm font-medium text-primary hover:underline underline-offset-2"
									>
										{feature.hrefLabel}
									</a>
								)}
							</div>
						</StaggerChild>
					))}
				</StaggerContainer>
			</div>
		</section>
	);
};

export default Features;
