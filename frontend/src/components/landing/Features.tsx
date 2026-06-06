"use client";

import type React from "react";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";

const features = [
	{
		title: "Cut-Level Pricing",
		description:
			"85+ standardized beef cuts — IMPS-coded, multilingual — priced at factory level across 16+ export plants in 5 countries.",
		details: ["85+ cuts", "IMPS/HS codes", "Factory-level"],
		span: "md:col-span-2",
		visual: "cuts",
	},
	{
		title: "AI Price Forecasting",
		description:
			"8 independent models — ARIMA, Holt-Winters, STL, Timer-XL, Chronos-2 — each producing price forecasts with confidence intervals and MAPE verification.",
		details: ["8 AI models", "Confidence intervals", "MAPE tracking"],
		span: "",
		visual: null,
		goldAccent: true,
	},
	{
		title: "Export Trade Flows",
		description:
			"Brazil, Uruguay, Australia, Argentina, US — export volumes, FOB prices, and destination analysis by HS code (0201/0202).",
		details: ["Volume tracking", "FOB pricing", "5 markets"],
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
			"Custom thresholds on any cut or market. Breakout and reversal detection via WebSocket with factor attribution.",
		details: ["Cut thresholds", "Trend alerts", "Factor context"],
		span: "",
		visual: null,
	},
];

const metrics = [
	{ value: "85+", label: "Beef Cuts" },
	{ value: "8", label: "AI Models" },
	{ value: "16+", label: "Export Factories" },
	{ value: "5", label: "Markets" },
];

function CutsVisual() {
	const cuts = [
		{ name: "Chuck Roll Choice", price: "$389", change: "+2.1%", up: true },
		{ name: "Ribeye Lip-On", price: "$613", change: "+0.9%", up: true },
		{ name: "Brisket Flat", price: "$295", change: "-0.5%", up: false },
		{ name: "Strip Loin", price: "$548", change: "+1.4%", up: true },
		{ name: "Outside Round", price: "$267", change: "-0.3%", up: false },
		{ name: "Short Plate", price: "$198", change: "+0.7%", up: true },
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
						<span className="text-xs font-mono text-gray-900 dark:text-white tabular-nums">
							{c.price}
						</span>
						<span
							className={`text-xs font-mono tabular-nums ${c.up ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
						>
							{c.change}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

function TradeVisual() {
	const flows = [
		{ origin: "🇧🇷 Brazil", dest: "🇨🇳 China", volume: "1.2Mt", trend: "+8%" },
		{ origin: "🇦🇺 Australia", dest: "🇯🇵 Japan", volume: "340kt", trend: "+3%" },
		{ origin: "🇺🇾 Uruguay", dest: "🇪🇺 EU", volume: "180kt", trend: "-2%" },
	];

	return (
		<div className="mt-4 space-y-2">
			{flows.map((f) => (
				<div
					key={`${f.origin}-${f.dest}`}
					className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-700/30"
				>
					<span className="text-xs text-muted-foreground">
						{f.origin} → {f.dest}
					</span>
					<div className="flex items-center gap-3">
						<span className="text-xs font-mono text-gray-900 dark:text-white tabular-nums">
							{f.volume}
						</span>
						<span className="text-xs font-mono text-green-600 dark:text-green-400 tabular-nums">
							{f.trend}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

export const Features: React.FC = () => {
	return (
		<section
			id="features"
			className="relative overflow-hidden bg-white dark:bg-[#0a0a0a] px-6 py-24 md:py-36 lg:py-48"
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
						// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
						<StaggerChild key={index}>
							<div
								className={`group rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08] bg-white dark:bg-[#111] p-5 md:p-7 text-center transition-all duration-300 hover:ring-black/[0.12] dark:hover:ring-white/[0.14] ${index === 0 ? "md:py-9" : ""}`}
							>
								<div className="font-mono text-2xl font-semibold text-[#B8860B] md:text-3xl tabular-nums">
									{metric.value}
								</div>
								<div className="mt-1 text-sm text-muted-foreground">{metric.label}</div>
							</div>
						</StaggerChild>
					))}
				</StaggerContainer>

				{/* Features Grid */}
				<StaggerContainer className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:gap-6 grid-flow-dense">
					{features.map((feature, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
						<StaggerChild key={index} className={feature.span}>
							<div
								className={`group rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08] bg-white dark:bg-[#111] p-5 md:p-6 transition-all duration-300 hover:ring-black/[0.12] dark:hover:ring-white/[0.14] h-full${feature.goldAccent ? " bg-[rgba(184,134,11,0.03)] dark:bg-[rgba(184,134,11,0.06)]" : ""}`}
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
									{feature.details.map((detail, idx) => (
										<span
											// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
											key={idx}
											className="bg-[#B8860B]/10 px-2.5 py-1 text-xs font-medium text-[#B8860B] rounded-full"
										>
											{detail}
										</span>
									))}
								</div>
							</div>
						</StaggerChild>
					))}
				</StaggerContainer>
			</div>
		</section>
	);
};

export default Features;
