"use client";

import {
	Building,
	Calendar,
	ChartColumn,
	Database,
	Globe,
	ShieldCheck,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { MarketingNav } from "@/components/landing/MarketingNav";
import { Button } from "@/components/ui";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";
import { ShimmerCard } from "@/components/ui/ShimmerCard";
import { SITE_STATS } from "@/lib/site-stats";

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-white dark:bg-background">
			{/* Navigation */}
			<MarketingNav
				links={[
					{ label: "Home", href: "/" },
					{ label: "Pricing", href: "/pricing" },
				]}
			/>

			{/* Hero Section — left-aligned */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8">
				<div className="max-w-5xl mx-auto">
					<MotionReveal>
						<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 outline outline-primary/20 px-4 py-1.5 text-sm font-medium text-primary mb-6">
							About Us
						</div>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<h1
							className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground tracking-tight"
							style={{ letterSpacing: "-0.04em" }}
						>
							Beef Trade Intelligence,
							<br />
							<span className="text-gray-900 dark:text-white">Backed by Data</span>
						</h1>
					</MotionReveal>
					<MotionReveal delay={0.2}>
						<p className="text-body-lg text-muted-foreground leading-relaxed max-w-2xl mt-6">
							MT provides beef trade price intelligence through real-time cut-level data, origin
							analysis, and AI-driven price forecasting. We help importers, distributors, and
							analysts make sense of global beef markets — from factory-level pricing to export
							flows.
						</p>
					</MotionReveal>
				</div>
			</section>

			{/* Stats Section — asymmetric grid */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950">
				<div className="max-w-5xl mx-auto">
					<StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
						{[
							{ number: `${SITE_STATS.beefCuts}+`, label: "Beef Cuts", Icon: ChartColumn },
							{ number: `${SITE_STATS.sourceCountries}`, label: "Source Countries", Icon: Globe },
							{ number: `${SITE_STATS.aiModels}`, label: "AI Models", Icon: TrendingUp },
							{ number: `${SITE_STATS.dataSources}+`, label: "Data Sources", Icon: Database },
						].map((stat, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							<StaggerChild key={idx}>
								<ShimmerCard
									className={`stagger-slide-up bg-white dark:bg-background rounded-xl p-6 text-center relative overflow-hidden group transition-all duration-200 ring-1 ring-black/[0.06] dark:ring-white/[0.08] ${idx === 0 ? "md:py-8" : ""}`}
								>
									<div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
									<div className="flex justify-center mb-3">
										<div className="text-primary">
											<stat.Icon size={22} />
										</div>
									</div>
									<div className="text-3xl md:text-4xl font-display font-semibold text-primary mb-2 tabular-nums">
										{stat.number}
									</div>
									<div className="text-body-sm text-muted-foreground font-medium">{stat.label}</div>
								</ShimmerCard>
							</StaggerChild>
						))}
					</StaggerContainer>
				</div>
			</section>

			{/* Mission Section — asymmetric split */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<div className="grid grid-cols-1 md:grid-cols-5 gap-12 lg:gap-16 items-center">
						<div className="md:col-span-3">
							<MotionReveal>
								<h2
									className="text-h1 font-display text-foreground mb-6"
									style={{ letterSpacing: "-0.04em" }}
								>
									Our Mission
								</h2>
							</MotionReveal>
							<MotionReveal delay={0.1}>
								<p className="text-body text-muted-foreground mb-4 leading-relaxed">
									MT makes beef trade price analysis transparent and accessible. We believe that
									understanding the factors behind cut-level price movements — from export supply to
									currency shifts — should not require a team of quants.
								</p>
							</MotionReveal>
							<MotionReveal delay={0.15}>
								<p className="text-body text-muted-foreground leading-relaxed">
									By running {SITE_STATS.aiModels} pretrained Chronos models alongside statistical
									baselines on each cut, we provide not just predictions but a spectrum of signals
									with confidence scores. Every forecast is logged and back-checked against actual
									prices via MAPE accuracy tracking — so you know how reliable each model truly is.
								</p>
							</MotionReveal>
						</div>
						<div className="md:col-span-2">
							<MotionReveal delay={0.2}>
								<div className="rounded-xl p-8 bg-primary/5 dark:bg-gray-950 ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
									<div className="grid grid-cols-2 gap-8">
										{[
											{ value: `${SITE_STATS.beefCuts}+`, label: "Beef Cuts" },
											{ value: `${SITE_STATS.aiModels}`, label: "AI Models" },
											{ value: `${SITE_STATS.sourceCountries}`, label: "Source Countries" },
											{ value: `${SITE_STATS.dataSources}+`, label: "Data Sources" },
										].map((stat, idx) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
											<div key={idx} className="text-center">
												<div className="text-2xl font-display font-semibold text-primary mb-1 tabular-nums">
													{stat.value}
												</div>
												<div className="text-body-sm text-muted-foreground">{stat.label}</div>
											</div>
										))}
									</div>
								</div>
							</MotionReveal>
						</div>
					</div>
				</div>
			</section>

			{/* Values Section — bento grid */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950">
				<div className="max-w-7xl mx-auto">
					<div className="mb-12 max-w-2xl">
						<MotionReveal>
							<h2
								className="text-h1 font-display text-foreground mb-4"
								style={{ letterSpacing: "-0.04em" }}
							>
								Core Values
							</h2>
						</MotionReveal>
						<MotionReveal delay={0.1}>
							<p className="text-body-lg text-muted-foreground">
								The principles that guide everything we build
							</p>
						</MotionReveal>
					</div>

					<StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-6">
						{[
							{
								number: "01",
								title: "Signal Over Noise",
								description:
									"Every feature answers a question: What moved? Why? What next? If a feature doesn't help answer one of those, it doesn't ship.",
								Icon: ShieldCheck,
								span: "md:col-span-2",
							},
							{
								number: "02",
								title: "Transparent Models",
								description:
									"Every signal shows which model generated it, the confidence interval, the MAPE accuracy score, and which factors are driving the prediction. No blind trust required.",
								Icon: Zap,
								span: "",
							},
							{
								number: "03",
								title: "User-Driven Development",
								description:
									"Feature requests from active users get prioritized. The backtest comparison tool, correlation heatmap, and beef cut detail pages all came from user feedback.",
								Icon: Users,
								span: "",
							},
						].map((value, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							<StaggerChild key={idx} className={value.span}>
								<div
									className={`relative bg-white dark:bg-background rounded-xl p-8 group transition-all duration-300 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full`}
								>
									<div className="absolute top-4 right-4 text-7xl font-display font-semibold text-gray-100 dark:text-gray-700/50 select-none leading-none">
										{value.number}
									</div>
									<div className="relative z-10">
										<div className="mb-4 text-primary transition-transform duration-200 group-hover:scale-110">
											<value.Icon size={24} />
										</div>
										<h3 className="text-h4 font-display font-semibold text-foreground mb-3">
											{value.title}
										</h3>
										<p className="text-body text-muted-foreground leading-relaxed">
											{value.description}
										</p>
									</div>
								</div>
							</StaggerChild>
						))}
					</StaggerContainer>
				</div>
			</section>

			{/* Data & Methodology — factual, no fabricated people */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<div className="mb-12 max-w-2xl">
						<MotionReveal>
							<h2
								className="text-h1 font-display text-foreground mb-4"
								style={{ letterSpacing: "-0.04em" }}
							>
								Data &amp; Methodology
							</h2>
						</MotionReveal>
						<MotionReveal delay={0.1}>
							<p className="text-body-lg text-muted-foreground">
								How we collect, structure, and predict on beef trade data.
							</p>
						</MotionReveal>
					</div>

					<StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<StaggerChild>
							<div className="bg-white dark:bg-background rounded-2xl p-8 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full">
								<h3 className="text-h4 font-display font-semibold text-foreground mb-3">
									Source-first collection
								</h3>
								<p className="text-body text-muted-foreground leading-relaxed">
									Prices are ingested directly from official sources — USDA, CEPEA, MLA, INAC,
									ABARES, World Bank — on tiered schedules (hourly to daily). No manual price entry
									for live data; every number is traceable to its source and timestamp.
								</p>
							</div>
						</StaggerChild>
						<StaggerChild>
							<div className="bg-white dark:bg-background rounded-2xl p-8 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full">
								<h3 className="text-h4 font-display font-semibold text-foreground mb-3">
									Pretrained models, not black-box AI
								</h3>
								<p className="text-body text-muted-foreground leading-relaxed">
									Predictions use interpretable statistical models (ARIMA, Holt-Winters, Exponential
									Smoothing, STL, Naive baseline). Every forecast ships with a 95% confidence
									interval and is auto-verified against actuals via MAPE once the horizon elapses.
								</p>
							</div>
						</StaggerChild>
						<StaggerChild>
							<div className="bg-white dark:bg-background rounded-2xl p-8 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full">
								<h3 className="text-h4 font-display font-semibold text-foreground mb-3">
									Honest about coverage
								</h3>
								<p className="text-body text-muted-foreground leading-relaxed">
									We surface real coverage rates, not marketing numbers. When a data source is
									unconfigured or a commodity lacks sufficient price history, the UI shows an honest
									empty state rather than fabricated values.
								</p>
							</div>
						</StaggerChild>
					</StaggerContainer>
				</div>
			</section>

			{/* CTA Section — dark bg with accent text */}
			<section className="relative py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gray-900 dark:bg-gray-950">
				<div className="relative z-10 max-w-4xl mx-auto text-center">
					<MotionReveal>
						<h2
							className="text-h1 font-display text-white mb-6"
							style={{ letterSpacing: "-0.04em" }}
						>
							Start Analyzing Today
						</h2>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<p className="text-body-lg text-gray-300 mb-10">
							{SITE_STATS.beefCuts}+ beef cuts. {SITE_STATS.aiModels} AI prediction models.{" "}
							{SITE_STATS.sourceCountries} source countries. Get started free.
						</p>
					</MotionReveal>
					<MotionReveal delay={0.2}>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Link href="/dashboard">
								<Button
									className="bg-black hover:bg-gray-800 text-white border-0 rounded-full"
									size="lg"
								>
									Get Started Free
								</Button>
							</Link>
							<Button
								variant="ghost"
								size="lg"
								className="!text-white !border-white/30 hover:!bg-white/10 rounded-full"
							>
								Contact Us
							</Button>
						</div>
					</MotionReveal>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-black/5 dark:border-white/10 bg-white dark:bg-gray-900">
				<div className="max-w-7xl mx-auto text-center">
					<p className="text-body-sm text-muted-foreground">&copy; 2026 MT. All rights reserved.</p>
				</div>
			</footer>
		</div>
	);
}
