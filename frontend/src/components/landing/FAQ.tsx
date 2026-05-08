"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { MotionReveal } from "@/components/ui/MotionReveal";
import { SPRING_DEFAULTS } from "@/lib/motion";

interface FAQItem {
	question: string;
	answer: string;
}

const faqs: FAQItem[] = [
	{
		question: "What is MT?",
		answer:
			"MT is a commodity market analytics platform. 108 commodities across 13 categories. 131 market factors — weather, FX, tariffs, freight — correlated with price movements. 7 independent AI models generate buy/sell signals with confidence intervals.",
	},
	{
		question: "How does the AI signal engine work?",
		answer:
			"Seven models run independently on each commodity: ARIMA, Holt-Winters, Exponential Smoothing, Naive, STL decomposition, Timer-XL, and Sundial. Each produces a price forecast, a directional signal (buy/sell/hold), and a confidence score. Accuracy is tracked via rolling MAPE across 30/60/90-day windows.",
	},
	{
		question: "What commodities are covered?",
		answer:
			"108 commodities across 13 categories: beef cuts (34,960 cut-level prices from 21 factories), grains & oilseeds (corn, soybeans, wheat), energy (WTI, Brent, natural gas), metals (gold, silver, copper), soft commodities (coffee, sugar, cotton), and forex pairs. 18 data ingestion modules feed 229,000+ data points.",
	},
	{
		question: "What market factors do you analyze?",
		answer:
			"131 market factors across 5 categories: weather (temperature, rainfall, growing conditions), FX (12 currency pairs vs USD), tariffs (China/US/AU trade data), freight (Baltic Dry Index, container rates), and supply/demand (USDA, ABARES, FAO reports). Each factor's Pearson correlation with commodity prices is calculated and displayed.",
	},
	{
		question: "Is this a trading platform?",
		answer:
			"No. MT is an information and analytics platform. We provide data, analysis, and AI-generated signals to inform your decisions. We do not execute trades, manage accounts, or handle funds.",
	},
	{
		question: "Can I set up price alerts?",
		answer:
			"Yes. Custom price thresholds on any of the 108 commodities. Breakout and trend reversal detection via WebSocket — alerts arrive in under 50ms. Severity levels (info/warning/critical) with factor attribution so you see what triggered the move.",
	},
];

export default function FAQ() {
	const [selectedIndex, setSelectedIndex] = useState(0);

	return (
		<section id="faq" className="bg-white dark:bg-[#0a0a0a] px-6 py-20 md:py-28 lg:py-36">
			<div className="mx-auto max-w-5xl">
				{/* Header */}
				<div className="mb-12 md:mb-16">
					<MotionReveal>
						<span className="mb-4 inline-block rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-muted text-muted-foreground">
							FAQ
						</span>
					</MotionReveal>
					<MotionReveal delay={0.1}>
						<h2
							className="font-display text-3xl font-semibold text-gray-900 dark:text-white md:text-4xl"
							style={{ letterSpacing: "-0.04em" }}
						>
							Frequently Asked Questions
						</h2>
					</MotionReveal>
					<MotionReveal delay={0.15}>
						<p className="mt-4 text-lg text-muted-foreground">Technical and product details</p>
					</MotionReveal>
				</div>

				{/* Side-by-side layout */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
					{/* Left: Questions list */}
					<MotionReveal>
						<div className="space-y-1" role="tablist" aria-label="FAQ questions">
							{faqs.map((faq, index) => (
								<button
									type="button"
									// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
									key={index}
									role="tab"
									aria-selected={selectedIndex === index}
									onClick={() => setSelectedIndex(index)}
									className={`flex w-full items-center rounded-lg px-4 py-3 text-left transition-all duration-200 border-l-2 ${
										selectedIndex === index
											? "bg-[#B8860B]/5 border-l-[#B8860B] text-[#B8860B]"
											: "border-l-transparent text-foreground hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-l-gray-300"
									}`}
								>
									<span
										className={`text-sm font-medium ${selectedIndex === index ? "text-[#B8860B]" : ""}`}
									>
										{faq.question}
									</span>
								</button>
							))}
						</div>
					</MotionReveal>

					{/* Right: Selected answer */}
					<div className="min-h-[320px]">
						<AnimatePresence mode="wait">
							<motion.div
								key={selectedIndex}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -12 }}
								transition={SPRING_DEFAULTS}
								className="rounded-2xl outline outline-black/5 dark:outline-white/10 bg-white dark:bg-[#111] p-6 md:p-8"
							>
								<div className="flex items-center mb-4">
									<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
										{faqs[selectedIndex].question}
									</h3>
								</div>
								<p className="text-base leading-relaxed text-foreground">
									{faqs[selectedIndex].answer}
								</p>
							</motion.div>
						</AnimatePresence>
					</div>
				</div>

				{/* Contact CTA */}
				<MotionReveal className="mt-12 md:mt-16">
					<div className="rounded-2xl outline outline-black/5 dark:outline-white/10 p-8 text-center">
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
							Questions not answered here?
						</h3>
						<p className="mt-2 text-muted-foreground">
							Reach out at support@mt.io — we respond within 4 hours during market hours.
						</p>
					</div>
				</MotionReveal>
			</div>
		</section>
	);
}
