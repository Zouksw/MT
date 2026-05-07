"use client";

import {
	ChartBar,
	ChartLineUp,
	Flask,
	Lightning,
	Users,
	WarningCircle,
} from "@phosphor-icons/react";
import type React from "react";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";

const _signalModels = [
	{ name: "ARIMA", signal: "Buy", confidence: 84, color: "bg-green-500" },
	{ name: "HoltWinters", signal: "Buy", confidence: 79, color: "bg-green-500" },
	{ name: "Exponential", signal: "Hold", confidence: 62, color: "bg-amber-500" },
	{ name: "STL", signal: "Buy", confidence: 71, color: "bg-green-500" },
];

const correlationData = [
	{ pair: "Oil / CAD", value: 0.87 },
	{ pair: "Gold / USD", value: -0.72 },
	{ pair: "Wheat / Weather", value: 0.64 },
	{ pair: "Copper / CNY", value: 0.58 },
];

const features = [
	{
		icon: <ChartLineUp size={28} weight="duotone" />,
		title: "Multi-Factor Analysis",
		description:
			"131 market factors — weather, FX, tariffs, freight indices — correlated with commodity prices via Pearson coefficient.",
		details: ["Weather data", "Forex rates", "Shipping indices"],
		span: "md:col-span-2",
		visual: "factors",
	},
	{
		icon: <Lightning size={28} weight="duotone" />,
		title: "AI Signal Engine",
		description:
			"Seven independent models — ARIMA, Holt-Winters, STL, Timer-XL — each producing buy/sell signals with confidence intervals and MAPE verification.",
		details: ["7 AI models", "Signal confidence", "MAPE tracking"],
		span: "",
		visual: null,
		goldAccent: true,
	},
	{
		icon: <Flask size={28} weight="duotone" />,
		title: "55+ Commodities",
		description:
			"108 commodities across 13 categories — beef cuts to brent crude. OHLCV candlestick data with multi-source overlay.",
		details: ["Beef & livestock", "Grains & oilseeds", "Energy & metals"],
		span: "md:col-span-2",
		visual: "commodities",
	},
	{
		icon: <WarningCircle size={28} weight="duotone" />,
		title: "Price Alerts",
		description:
			"Custom price thresholds with breakout and reversal detection. WebSocket-powered alerts avg 47ms latency.",
		details: ["Price thresholds", "Trend alerts", "Severity levels"],
		span: "",
		visual: null,
	},
	{
		icon: <ChartBar size={28} weight="duotone" />,
		title: "Seasonality & Correlation",
		description: "Monthly seasonality decomposition and Pearson cross-commodity correlation matrix with interactive heatmap.",
		details: ["Monthly patterns", "Correlation matrix", "Trend analysis"],
		span: "",
		visual: null,
	},
	{
		icon: <Users size={28} weight="duotone" />,
		title: "Backtest & Accuracy",
		description:
			"Backtest AI model accuracy with rolling MAPE windows. Compare model performance across 30/60/90-day horizons.",
		details: ["Rolling MAPE", "30/60/90 day windows", "Model comparison"],
		span: "",
		visual: null,
	},
];

const metrics = [
	{ value: "108", label: "Commodities", icon: <Flask size={22} weight="duotone" /> },
	{ value: "7", label: "AI Models", icon: <Lightning size={22} weight="duotone" /> },
	{ value: "18", label: "Data Sources", icon: <ChartLineUp size={22} weight="duotone" /> },
	{ value: "131", label: "Market Factors", icon: <ChartBar size={22} weight="duotone" /> },
];

function FactorVisual() {
	return (
		<div className="mt-4 space-y-2">
			{correlationData.map((item) => (
				<div key={item.pair} className="flex items-center gap-3">
					<span className="text-xs text-muted-foreground w-28 shrink-0">{item.pair}</span>
					<div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
						<div
							className="h-full rounded-full bg-[#B8860B]/50 transition-all duration-700"
							style={{ width: `${Math.abs(item.value) * 100}%` }}
						/>
					</div>
					<span
						className={`text-xs font-mono tabular-nums w-10 text-right ${item.value > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
					>
						{item.value > 0 ? "+" : ""}
						{item.value.toFixed(2)}
					</span>
				</div>
			))}
		</div>
	);
}

function CommoditiesVisual() {
	const commodities = [
		{ name: "Crude Oil WTI", price: "$78.42", change: "+1.23%", up: true },
		{ name: "Gold", price: "$2,341", change: "+0.41%", up: true },
		{ name: "Soybeans", price: "$1,187", change: "-0.67%", up: false },
		{ name: "Copper", price: "$4.28", change: "+0.89%", up: true },
		{ name: "Wheat", price: "$612.5", change: "-0.34%", up: false },
		{ name: "Natural Gas", price: "$2.84", change: "+2.17%", up: true },
	];

	return (
		<div className="mt-4 grid grid-cols-2 gap-2">
			{commodities.map((c) => (
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
							Data-first market analysis
						</h2>
					</MotionReveal>
					<MotionReveal delay={0.15}>
						<p className="mt-4 text-lg text-muted-foreground">
							Multi-factor correlation, 7 independent signal models, 131 market factors — not a dashboard, a signal engine.
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
								<div className="mx-auto mb-3 text-[#B8860B] md:h-12 md:w-12">
									{metric.icon}
								</div>
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
								<div className="mb-4 text-[#B8860B] transition-transform duration-200 group-hover:scale-105">
									{feature.icon}
								</div>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
									{feature.title}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									{feature.description}
								</p>

								{/* Visual data inside wide cards */}
								{feature.visual === "factors" && <FactorVisual />}
								{feature.visual === "commodities" && <CommoditiesVisual />}

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
