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
			"MT is a beef trade analytics platform. We track 85+ standardized beef cuts across 16+ export factories in 5 major beef-producing countries (US, Brazil, Australia, Uruguay, Argentina). 8 independent AI models generate price forecasts with confidence intervals. Multi-factor correlation analysis ties FX rates, feed costs, and shipping to cut-level pricing.",
	},
	{
		question: "How does the AI price forecasting work?",
		answer:
			"Eight models run independently on each beef commodity: ARIMA, Holt-Winters, Exponential Smoothing, Naive, STL decomposition, Timer-XL (LSTM), Sundial (Transformer), and Chronos-2. Each produces a price forecast, a directional signal (up/down/stable), and a confidence score. Accuracy is tracked via rolling MAPE across 30/60/90-day windows.",
	},
	{
		question: "What beef cuts are covered?",
		answer:
			"85+ standardized cuts organized by primal: Chuck, Rib, Loin, Round, Brisket, Shank, Plate/Flank, and Offal. Each cut has IMPS codes, HS codes, and multilingual names (English, Chinese, Spanish, Portuguese). Pricing is tracked at factory level — you can compare the same cut across different plants and origins.",
	},
	{
		question: "What export markets do you cover?",
		answer:
			"Brazil (SECEX data — HS 0201/0202 export volumes and FOB prices by destination), Uruguay (INAC — cut-level export pricing), Australia (MLA — EYCI index, slaughter, export cuts), Argentina (INDEC — production and export), and the US (USDA AMS — boxed beef cutout, cut-level pricing). Cold storage and weekly slaughter data are also tracked.",
	},
	{
		question: "Is this a trading platform?",
		answer:
			"No. MT is an information and analytics platform. We provide cut-level pricing data, export flow analysis, and AI-generated price forecasts to inform your buying and sourcing decisions. We do not execute trades, manage accounts, or handle funds.",
	},
	{
		question: "Can I set up price alerts?",
		answer:
			"Yes. Custom price thresholds on any of the 85+ beef cuts. Breakout and trend reversal detection via WebSocket — alerts arrive in under 50ms. Severity levels (info/warning/critical) with factor attribution so you see what's driving the price move.",
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
						<p className="mt-4 text-lg text-muted-foreground">Beef trade analytics, explained</p>
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
