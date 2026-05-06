"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";

export default function PricingPage() {
	const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

	const plans = [
		{
			name: "Free",
			description: "For individual analysts tracking commodity markets",
			price: { monthly: 0, yearly: 0 },
			features: [
				"55+ commodity prices",
				"5 watchlist items",
				"3 AI prediction models",
				"Basic charts & OHLCV data",
				"7-day price history",
			],
			cta: "Get Started Free",
			highlighted: false,
		},
		{
			name: "Professional",
			description: "For teams needing AI-driven commodity signals",
			price: { monthly: 49, yearly: 39 },
			features: [
				"All 55+ commodities",
				"7 AI signal models (ARIMA, HoltWinters, etc.)",
				"Multi-factor analysis (weather, forex, shipping)",
				"Price alerts & anomaly detection",
				"Email notifications",
				"30-day price history",
				"API access",
				"Custom dashboard",
			],
			cta: "Start Free Trial",
			highlighted: true,
		},
		{
			name: "Enterprise",
			description: "For institutions requiring custom deployments",
			price: { monthly: 199, yearly: 159 },
			features: [
				"Unlimited commodity data",
				"All AI models with priority inference",
				"Advanced correlation & seasonality",
				"Dedicated API endpoints",
				"Priority support & SLA",
				"Full price history",
				"Private deployment",
				"Custom model training",
				"Dedicated account manager",
			],
			cta: "Contact Sales",
			highlighted: false,
		},
	];

	const freePlan = plans[0];
	const proPlan = plans[1];
	const enterprisePlan = plans[2];

	return (
		<div className="min-h-screen bg-card">
			{/* Navigation */}
			<nav className="border-b border-black/5 dark:border-white/10 bg-card sticky top-0 z-50">
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
								href="/about"
								className="text-body text-muted-foreground hover:text-primary transition-colors"
							>
								About
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

			{/* Hero Section */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8">
				<div className="max-w-4xl mx-auto text-center">
					<MotionReveal>
						<h1 className="text-display text-foreground mb-6" style={{ letterSpacing: "-0.04em" }}>
							Simple, Transparent Pricing
						</h1>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<p className="text-body-lg text-muted-foreground mb-10">
							Choose the plan that fits your analysis needs. Upgrade or cancel anytime.
						</p>
					</MotionReveal>

					{/* Billing Toggle */}
					<MotionReveal delay={0.15}>
						<div className="inline-flex items-center gap-3 bg-muted rounded-full p-1">
							<button type="button"
								onClick={() => setBillingCycle("monthly")}
								className={`px-6 py-2 rounded-full text-body font-medium transition-all ${
									billingCycle === "monthly" ? "bg-black text-white" : "text-muted-foreground"
								}`}
							>
								Monthly
							</button>
							<button type="button"
								onClick={() => setBillingCycle("yearly")}
								className={`px-6 py-2 rounded-full text-body font-medium transition-all relative ${
									billingCycle === "yearly" ? "bg-black text-white" : "text-muted-foreground"
								}`}
							>
								Yearly
								<span className="absolute -top-1 -right-1 bg-[#B8860B]/10 text-[#B8860B] text-xs px-2 py-0.5 rounded-full">
									Save 20%
								</span>
							</button>
						</div>
					</MotionReveal>
				</div>
			</section>

			{/* Pricing Cards — Asymmetric Bento */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 bg-muted">
				<div className="max-w-7xl mx-auto">
					<StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8">
						{/* Professional — Full-width top row */}
						<StaggerChild className="md:col-span-2">
							<div className="relative rounded-2xl outline-2 outline-[#B8860B] bg-card p-8 md:p-10">
								<div className="absolute -top-3 left-8">
									<span className="bg-[#B8860B] text-white rounded-full px-3 py-0.5 text-xs font-medium">
										Most Popular
									</span>
								</div>
								<div className="flex flex-col md:flex-row md:items-start md:gap-12">
									<div className="flex-1 text-center md:text-left mb-8 md:mb-0">
										<h3 className="text-h3 font-display font-semibold text-foreground mb-2">
											{proPlan.name}
										</h3>
										<p className="text-body text-muted-foreground mb-6">{proPlan.description}</p>
										<div className="flex items-baseline justify-center md:justify-start gap-1">
											<span className="text-4xl font-display font-semibold text-foreground tabular-nums">
												${proPlan.price[billingCycle]}
											</span>
											<span className="text-body text-muted-foreground">/mo</span>
										</div>
										{billingCycle === "yearly" && proPlan.price.yearly > 0 && (
											<p className="text-body-sm text-muted-foreground mt-2">
												Billed ${proPlan.price.yearly * 12}/year
											</p>
										)}
										<Link href="/dashboard" className="inline-block mt-6">
											<Button
												size="lg"
												className="min-w-[200px] rounded-full bg-[#B8860B] text-white hover:bg-[#D4A030] border-0"
											>
												{proPlan.cta}
											</Button>
										</Link>
									</div>
									<ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
										{proPlan.features.map((feature, featureIdx) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
											<li key={featureIdx} className="flex items-start gap-3">
												<CheckCircle2 size={20} className="text-[#B8860B] flex-shrink-0 mt-0.5" />
												<span className="text-body text-muted-foreground">{feature}</span>
											</li>
										))}
									</ul>
								</div>
							</div>
						</StaggerChild>

						{/* Free — Bottom left */}
						<StaggerChild>
							<div className="rounded-2xl outline outline-black/5 dark:outline-white/10 bg-card p-8">
								<div className="text-center mb-6">
									<h3 className="text-h3 font-display font-semibold text-foreground mb-2">
										{freePlan.name}
									</h3>
									<p className="text-body text-muted-foreground mb-4">{freePlan.description}</p>
									<div className="flex items-baseline justify-center gap-1">
										<span className="text-4xl font-display font-semibold text-foreground tabular-nums">
											${freePlan.price[billingCycle]}
										</span>
										<span className="text-body text-muted-foreground">/mo</span>
									</div>
									{billingCycle === "yearly" && freePlan.price.yearly > 0 && (
										<p className="text-body-sm text-muted-foreground mt-2">
											Billed ${freePlan.price.yearly * 12}/year
										</p>
									)}
								</div>
								<Link href="/dashboard" className="block">
									<Button variant="secondary" size="lg" fullWidth className="mb-6 rounded-full">
										{freePlan.cta}
									</Button>
								</Link>
								<ul className="space-y-3">
									{freePlan.features.map((feature, featureIdx) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
										<li key={featureIdx} className="flex items-start gap-3">
											<CheckCircle2 size={20} className="text-[#B8860B] flex-shrink-0 mt-0.5" />
											<span className="text-body text-muted-foreground">{feature}</span>
										</li>
									))}
								</ul>
							</div>
						</StaggerChild>

						{/* Enterprise — Bottom right */}
						<StaggerChild>
							<div className="rounded-2xl outline outline-black/5 dark:outline-white/10 bg-card p-8">
								<div className="text-center mb-6">
									<h3 className="text-h3 font-display font-semibold text-foreground mb-2">
										{enterprisePlan.name}
									</h3>
									<p className="text-body text-muted-foreground mb-4">
										{enterprisePlan.description}
									</p>
									<div className="flex items-baseline justify-center gap-1">
										<span className="text-4xl font-display font-semibold text-foreground tabular-nums">
											${enterprisePlan.price[billingCycle]}
										</span>
										<span className="text-body text-muted-foreground">/mo</span>
									</div>
									{billingCycle === "yearly" && enterprisePlan.price.yearly > 0 && (
										<p className="text-body-sm text-muted-foreground mt-2">
											Billed ${enterprisePlan.price.yearly * 12}/year
										</p>
									)}
								</div>
								<Link href="/dashboard" className="block">
									<Button variant="secondary" size="lg" fullWidth className="mb-6 rounded-full">
										{enterprisePlan.cta}
									</Button>
								</Link>
								<ul className="space-y-3">
									{enterprisePlan.features.map((feature, featureIdx) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
										<li key={featureIdx} className="flex items-start gap-3">
											<CheckCircle2 size={20} className="text-[#B8860B] flex-shrink-0 mt-0.5" />
											<span className="text-body text-muted-foreground">{feature}</span>
										</li>
									))}
								</ul>
							</div>
						</StaggerChild>
					</StaggerContainer>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8">
				<div className="max-w-4xl mx-auto">
					<div className="text-center mb-16">
						<MotionReveal>
							<h2
								className="text-h1 font-display text-foreground mb-4"
								style={{ letterSpacing: "-0.04em" }}
							>
								Frequently Asked Questions
							</h2>
						</MotionReveal>
					</div>

					<StaggerContainer className="space-y-4">
						{[
							{
								q: "Can I cancel my subscription anytime?",
								a: "Yes, you can cancel anytime with no questions asked. You'll retain access until the end of your current billing period.",
							},
							{
								q: "Is the free plan really free?",
								a: "Yes, the free plan has no time limit. You get access to 55+ commodity prices and basic charts forever. Upgrade only when you need AI signals or advanced features.",
							},
							{
								q: "What payment methods do you accept?",
								a: "We accept all major credit cards and PayPal. Enterprise plans can also pay via bank transfer or invoice.",
							},
							{
								q: "Can I switch plans after signing up?",
								a: "Absolutely. You can upgrade or downgrade anytime from your account settings. Downgrades take effect at the end of your current billing cycle.",
							},
							{
								q: "What does the Enterprise plan include?",
								a: "Enterprise includes private deployment, custom AI model training, dedicated API endpoints, SLA guarantees, priority support, and a dedicated account manager.",
							},
						].map((faq, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							<StaggerChild key={idx}>
								<div className="bg-card rounded-lg p-6 outline outline-black/5 dark:outline-white/10 border-l-4 border-l-[#B8860B]">
									<h3 className="text-h4 font-display font-semibold text-foreground mb-2">
										{faq.q}
									</h3>
									<p className="text-body text-muted-foreground leading-relaxed">{faq.a}</p>
								</div>
							</StaggerChild>
						))}
					</StaggerContainer>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24 md:py-36 lg:py-48 px-4 sm:px-6 lg:px-8 bg-muted">
				<div className="max-w-4xl mx-auto text-center">
					<MotionReveal>
						<h2
							className="text-h1 font-display text-foreground mb-6"
							style={{ letterSpacing: "-0.04em" }}
						>
							Still Have Questions?
						</h2>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<p className="text-body-lg text-muted-foreground mb-10">
							Our team is here to help you find the right plan
						</p>
					</MotionReveal>
					<MotionReveal delay={0.15}>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Button
								size="lg"
								className="min-w-[160px] rounded-full bg-[#B8860B] text-white hover:bg-[#D4A030] border-0"
							>
								Contact Sales
							</Button>
							<Button variant="ghost" size="lg" className="min-w-[160px] rounded-full">
								View Documentation
							</Button>
						</div>
					</MotionReveal>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-black/5 dark:border-white/10">
				<div className="max-w-7xl mx-auto text-center">
					<p className="text-body-sm text-muted-foreground">&copy; 2026 MT. All rights reserved.</p>
				</div>
			</footer>
		</div>
	);
}
