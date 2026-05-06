"use client";

import {
	Buildings,
	CalendarBlank,
	ChartBar,
	Globe,
	Lightning,
	ShieldCheck,
	Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";
import { ShimmerCard } from "@/components/ui/ShimmerCard";

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
			{/* Navigation */}
			<nav className="border-b border-black/5 dark:border-white/10 bg-white dark:bg-[#0a0a0a] sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<Link href="/" className="flex items-center gap-2">
							<div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-md flex items-center justify-center">
								<span className="text-white dark:text-gray-900 font-semibold text-lg">T</span>
							</div>
							<span className="text-h4 font-display font-semibold text-foreground">MT</span>
						</Link>
						<div className="hidden md:flex items-center gap-8">
							<Link
								href="/"
								className="text-body text-muted-foreground hover:text-primary transition-colors"
							>
								Home
							</Link>
							<a
								href="/pricing"
								className="text-body text-muted-foreground hover:text-primary transition-colors"
							>
								Pricing
							</a>
							<Link href="/dashboard">
								<Button variant="primary" size="sm">
									Sign In
								</Button>
							</Link>
						</div>
					</div>
				</div>
			</nav>

			{/* Hero Section — left-aligned */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8">
				<div className="max-w-5xl mx-auto">
					<MotionReveal>
						<div className="inline-flex items-center gap-2 rounded-full bg-[#B8860B]/10 outline outline-[#B8860B]/20 px-4 py-1.5 text-sm font-medium text-[#B8860B] mb-6">
							About Us
						</div>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<h1
							className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground tracking-tight"
							style={{ letterSpacing: "-0.04em" }}
						>
							Commodity Intelligence,
							<br />
							<span className="text-gray-900 dark:text-white">Backed by Data</span>
						</h1>
					</MotionReveal>
					<MotionReveal delay={0.2}>
						<p className="text-body-lg text-muted-foreground leading-relaxed max-w-2xl mt-6">
							MT provides commodity market intelligence through real-time data, multi-factor
							analysis, and AI-driven price signals. We help analysts and institutions make sense of
							complex, interconnected commodity markets.
						</p>
					</MotionReveal>
				</div>
			</section>

			{/* Stats Section — asymmetric grid */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#111]">
				<div className="max-w-5xl mx-auto">
					<StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
						{[
							{ number: "2024", label: "Founded", Icon: CalendarBlank },
							{ number: "487", label: "Enterprise Users", Icon: Buildings },
							{ number: "47", label: "Countries", Icon: Globe },
							{ number: "1.2B", label: "Data Points/Day", Icon: ChartBar },
						].map((stat, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							<StaggerChild key={idx}>
								<ShimmerCard
									className={`stagger-slide-up bg-white dark:bg-[#0a0a0a] rounded-xl p-6 text-center relative overflow-hidden group transition-all duration-200 ring-1 ring-black/[0.06] dark:ring-white/[0.08] ${idx === 0 ? "md:py-8" : ""}`}
								>
									<div className="absolute top-0 left-0 right-0 h-0.5 bg-[#B8860B]" />
									<div className="flex justify-center mb-3">
										<div className="text-[#B8860B]">
											<stat.Icon size={22} weight="duotone" />
										</div>
									</div>
									<div className="text-3xl md:text-4xl font-display font-semibold text-[#B8860B] mb-2 tabular-nums">
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
									MT makes commodity market analysis transparent and accessible. We believe that
									understanding the factors behind price movements — from weather patterns to
									shipping costs — should not require a team of quants.
								</p>
							</MotionReveal>
							<MotionReveal delay={0.15}>
								<p className="text-body text-muted-foreground leading-relaxed">
									By running 7 independent AI models on each commodity, we provide not just
									predictions but a spectrum of signals with confidence scores. Our platform helps
									you understand what drives markets, not just where prices are heading.
								</p>
							</MotionReveal>
						</div>
						<div className="md:col-span-2">
							<MotionReveal delay={0.2}>
								<div className="rounded-xl p-8 bg-[#B8860B]/5 dark:bg-[#111] ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
									<div className="grid grid-cols-2 gap-8">
										{[
											{ value: "99.94%", label: "Platform Uptime" },
											{ value: "<1ms", label: "Query Latency" },
											{ value: "10M+", label: "Points per Second" },
											{ value: "24/7", label: "Expert Support" },
										].map((stat, idx) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
											<div key={idx} className="text-center">
												<div className="text-2xl font-display font-semibold text-[#B8860B] mb-1 tabular-nums">
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
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#111]">
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
									"We filter market chaos into actionable signals. Every feature we ship must help users make better decisions, not just display more data.",
								Icon: ShieldCheck,
								span: "md:col-span-2",
							},
							{
								number: "02",
								title: "Transparent Models",
								description:
									"Every AI prediction comes with confidence scores, model comparison, and factor attribution. We never ask users to trust a black box.",
								Icon: Lightning,
								span: "",
							},
							{
								number: "03",
								title: "User-Driven Development",
								description:
									"We build what analysts and traders actually need, not what looks impressive in a demo. Our roadmap is shaped by the people who use the platform daily.",
								Icon: Users,
								span: "",
							},
						].map((value, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							<StaggerChild key={idx} className={value.span}>
								<div
									className={`relative bg-white dark:bg-[#0a0a0a] rounded-xl p-8 group transition-all duration-300 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full`}
								>
									<div className="absolute top-4 right-4 text-7xl font-display font-semibold text-gray-100 dark:text-gray-700/50 select-none leading-none">
										{value.number}
									</div>
									<div className="relative z-10">
										<div
											className="mb-4 text-[#B8860B] transition-transform duration-200 group-hover:scale-110"
										>
											<value.Icon size={24} weight="duotone" />
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

			{/* Team Section — asymmetric layout */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<div className="mb-12 max-w-2xl">
						<MotionReveal>
							<h2
								className="text-h1 font-display text-foreground mb-4"
								style={{ letterSpacing: "-0.04em" }}
							>
								Leadership Team
							</h2>
						</MotionReveal>
						<MotionReveal delay={0.1}>
							<p className="text-body-lg text-muted-foreground">
								Experienced operators from commodity markets, AI research, and platform engineering
							</p>
						</MotionReveal>
					</div>

					<StaggerContainer className="grid grid-cols-1 md:grid-cols-5 md:grid-rows-2 gap-6">
						{/* CEO — featured card, spans left 3 cols and 2 rows */}
						<StaggerChild className="md:col-span-3 md:row-span-2">
							<div className="bg-white dark:bg-[#0a0a0a] rounded-2xl overflow-hidden group transition-all duration-300 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full flex flex-col md:flex-row">
								<div className="md:w-2/5 bg-gray-50 dark:bg-[#111] flex items-center justify-center p-8 md:p-12">
									<div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.08] transition-transform duration-200 group-hover:scale-105">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										{/* biome-ignore lint/performance/noImgElement: external placeholder images */}
										<img
											src="https://picsum.photos/seed/marcus-chen/200/200"
											alt="Marcus Chen"
											width={200}
											height={200}
											className="w-full h-full object-cover"
										/>
									</div>
								</div>
								<div className="md:w-3/5 px-8 py-8 md:px-10 md:py-12 flex flex-col justify-center">
									<h3 className="text-h2 font-display font-semibold text-foreground mb-1">
										Marcus Chen
									</h3>
									<p className="text-body font-medium text-[#B8860B] mb-4">CEO & Co-Founder</p>
									<p className="text-body text-muted-foreground leading-relaxed">
										Former head of commodity analytics at a top-5 agricultural trading firm. 12
										years of experience bridging quantitative analysis with commercial strategy.
									</p>
								</div>
							</div>
						</StaggerChild>

						{/* CTO — stacked on right */}
						<StaggerChild className="md:col-span-2">
							<div className="bg-white dark:bg-[#0a0a0a] rounded-2xl overflow-hidden group transition-all duration-300 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full flex items-start gap-5 p-6">
								<div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.08] transition-transform duration-200 group-hover:scale-105">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									{/* biome-ignore lint/performance/noImgElement: external placeholder images */}
									<img
										src="https://picsum.photos/seed/elena-vasquez/200/200"
										alt="Elena Vasquez"
										width={200}
										height={200}
										className="w-full h-full object-cover"
									/>
								</div>
								<div className="min-w-0">
									<h3 className="text-h4 font-display font-semibold text-foreground mb-0.5">
										Elena Vasquez
									</h3>
									<p className="text-body-sm font-medium text-[#B8860B] mb-2">CTO & Co-Founder</p>
									<p className="text-body-sm text-muted-foreground leading-relaxed">
										PhD in time-series forecasting from ETH Zurich. Previously built ML
										infrastructure at a Series-C climate analytics startup serving 200+ enterprise
										clients.
									</p>
								</div>
							</div>
						</StaggerChild>

						{/* VP of Engineering — stacked on right */}
						<StaggerChild className="md:col-span-2">
							<div className="bg-white dark:bg-[#0a0a0a] rounded-2xl overflow-hidden group transition-all duration-300 ring-1 ring-black/[0.06] dark:ring-white/[0.08] h-full flex items-start gap-5 p-6">
								<div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.08] transition-transform duration-200 group-hover:scale-105">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									{/* biome-ignore lint/performance/noImgElement: external placeholder images */}
									<img
										src="https://picsum.photos/seed/david-okonkwo/200/200"
										alt="David Okonkwo"
										width={200}
										height={200}
										className="w-full h-full object-cover"
									/>
								</div>
								<div className="min-w-0">
									<h3 className="text-h4 font-display font-semibold text-foreground mb-0.5">
										David Okonkwo
									</h3>
									<p className="text-body-sm font-medium text-[#B8860B] mb-2">VP of Engineering</p>
									<p className="text-body-sm text-muted-foreground leading-relaxed">
										Former principal engineer at Bloomberg, responsible for real-time data pipeline
										architecture handling 500k+ events per second across 40 markets.
									</p>
								</div>
							</div>
						</StaggerChild>
					</StaggerContainer>
				</div>
			</section>

			{/* CTA Section — dark bg with accent text */}
			<section className="relative py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gray-900 dark:bg-[#111]">
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
							Join analysts from 47 countries using MT to decode commodity markets
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
