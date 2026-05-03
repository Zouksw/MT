"use client";

import {
	ArrowRight,
	Brain,
	ChartLineUp,
	CheckCircle,
	GearSix,
	Lightning,
	RocketLaunch,
} from "@phosphor-icons/react";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";

const steps = [
	{
		number: 1,
		title: "Create Your Account",
		description:
			"Sign up free and customize your commodity watchlist. Choose the markets you care about.",
		icon: <RocketLaunch size={24} weight="duotone" />,
		preview: null,
	},
	{
		number: 2,
		title: "Explore Market Data",
		description:
			"Browse 55+ commodities with real-time prices, candlestick charts, and historical trends.",
		icon: <ChartLineUp size={24} weight="duotone" />,
		preview: (
			<div className="space-y-2 mt-3">
				{[
					{ name: "Crude Oil WTI", price: "$78.42", chg: "+1.23%", up: true },
					{ name: "Gold", price: "$2,341", chg: "+0.41%", up: true },
					{ name: "Natural Gas", price: "$2.84", chg: "+2.17%", up: true },
				].map((c) => (
					<div
						key={c.name}
						className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800/60"
					>
						<span className="text-xs text-muted-foreground">{c.name}</span>
						<div className="flex items-center gap-2">
							<span className="text-xs font-mono text-gray-900 dark:text-white tabular-nums">
								{c.price}
							</span>
							<span
								className={`text-xs font-mono tabular-nums ${c.up ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
							>
								{c.chg}
							</span>
						</div>
					</div>
				))}
			</div>
		),
	},
	{
		number: 3,
		title: "Set Up AI Signals",
		description:
			"Configure which AI models to follow, set price alerts, and customize your dashboard.",
		icon: <GearSix size={24} weight="duotone" />,
		preview: (
			<div className="mt-3 space-y-2">
				{[
					{ model: "ARIMA", signal: "Buy", conf: 84 },
					{ model: "HoltWinters", signal: "Buy", conf: 79 },
					{ model: "STL", signal: "Hold", conf: 62 },
				].map((s) => (
					<div
						key={s.model}
						className="flex items-center gap-3 px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800/60"
					>
						<span className="text-xs font-medium text-muted-foreground w-24">{s.model}</span>
						<div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
							<div className="h-full rounded-full bg-primary/50" style={{ width: `${s.conf}%` }} />
						</div>
						<span
							className={`text-xs font-mono tabular-nums ${s.signal === "Buy" ? "text-green-600 dark:text-green-400" : "text-amber-500"}`}
						>
							{s.signal} {s.conf}%
						</span>
					</div>
				))}
			</div>
		),
	},
	{
		number: 4,
		title: "Track & Decide",
		description:
			"Monitor AI-generated signals, compare model accuracy, and use multi-factor analysis.",
		icon: <Lightning size={24} weight="duotone" />,
		preview: (
			<div className="mt-3 flex items-center gap-3 px-3 py-3 rounded-md bg-gray-50 dark:bg-gray-800/60">
				<Brain size={20} weight="duotone" className="text-primary shrink-0" />
				<div className="flex-1">
					<div className="text-xs font-medium text-foreground">AI Consensus</div>
					<div className="text-xs text-muted-foreground">Strong Buy — 73% confidence</div>
				</div>
				<div className="text-sm font-semibold text-green-600 dark:text-green-400">+4.2%</div>
			</div>
		),
	},
];

const features = [
	"5-minute quick start",
	"Interactive commodity charts",
	"AI signal dashboard",
	"Sample commodity data",
	"Community leaderboard",
	"API documentation",
];

export default function GettingStarted() {
	return (
		<section className="relative overflow-hidden bg-white dark:bg-gray-900 px-6 py-24 md:py-36 lg:py-48">
			{/* Dot grid pattern */}
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
				style={{
					backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.5) 1px, transparent 1px)",
					backgroundSize: "24px 24px",
				}}
			/>

			<div className="relative z-10 mx-auto max-w-6xl">
				{/* Header */}
				<div className="mb-12 md:mb-16 lg:mb-20 max-w-2xl">
					<MotionReveal>
						<span className="mb-4 block text-sm font-medium text-muted-foreground tracking-wide">
							Quick start
						</span>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<h2
							className="font-display text-3xl font-semibold text-gray-900 dark:text-white md:text-4xl lg:text-5xl"
							style={{ letterSpacing: "-0.04em" }}
						>
							Get started in minutes
						</h2>
					</MotionReveal>
					<MotionReveal delay={0.15}>
						<p className="mt-4 text-lg text-muted-foreground">
							Start analyzing commodity markets with our AI-powered platform
						</p>
					</MotionReveal>
				</div>

				{/* Steps — vertical timeline with data previews */}
				<StaggerContainer className="relative mb-16">
					<div className="absolute left-6 top-0 bottom-0 w-px bg-muted hidden md:block" />

					<div className="space-y-6">
						{steps.map((step, index) => (
							<StaggerChild key={index}>
								<div className="flex gap-6 items-start">
									<div className="relative flex-shrink-0">
										<div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 dark:bg-white text-sm font-semibold text-white dark:text-gray-900">
											{step.number}
										</div>
									</div>

									<div className="flex-1 rounded-2xl outline outline-black/5 dark:outline-white/10 bg-white dark:bg-gray-950 p-5 md:p-6 transition-all duration-300 hover:outline-black/10 dark:hover:outline-white/15">
										<div className="flex items-center gap-3 mb-2">
											<div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900">
												{step.icon}
											</div>
											<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
												{step.title}
											</h3>
										</div>
										<p className="text-sm leading-relaxed text-muted-foreground ml-11">
											{step.description}
										</p>
										{step.preview}
									</div>
								</div>
							</StaggerChild>
						))}
					</div>
				</StaggerContainer>

				{/* Feature list */}
				<StaggerContainer className="mx-auto mb-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
					{features.map((feature, index) => (
						<StaggerChild key={index}>
							<div className="flex items-center gap-3 rounded-xl outline outline-black/5 dark:outline-white/10 px-5 py-4">
								<CheckCircle size={20} weight="fill" className="text-green-500 flex-shrink-0" />
								<span className="text-sm font-medium text-foreground">{feature}</span>
							</div>
						</StaggerChild>
					))}
				</StaggerContainer>

				{/* CTA */}
				<MotionReveal className="text-center">
					<a
						href="/register"
						className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
					>
						Start your free trial
						<ArrowRight size={16} weight="bold" />
					</a>
					<p className="mt-4 text-sm text-gray-400">
						Free to get started. No credit card required.
					</p>
				</MotionReveal>
			</div>
		</section>
	);
}
