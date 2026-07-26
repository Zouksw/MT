"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";
import { SITE_STATS } from "@/lib/site-stats";

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
	const [value, setValue] = useState(0);
	const ref = useRef<HTMLSpanElement>(null);
	const hasAnimated = useRef(false);

	useEffect(() => {
		if (hasAnimated.current) return;
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReducedMotion) {
			setValue(target);
			return;
		}

		hasAnimated.current = true;
		const duration = 1200;
		const start = performance.now();

		function animate(now: number) {
			const elapsed = now - start;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			setValue(Math.round(target * eased));
			if (progress < 1) requestAnimationFrame(animate);
		}

		requestAnimationFrame(animate);
	}, [target]);

	return (
		<span
			ref={ref}
			className="font-mono text-2xl md:text-3xl font-semibold text-primary tabular-nums"
		>
			{value}
			{suffix}
		</span>
	);
}

// Single source of truth: site-stats.ts. Never hardcode these numbers —
// an inconsistent claim is the most credibility-damaging bug on a marketing page.
const stats = [
	{ numericValue: SITE_STATS.beefCuts, suffix: "", label: "Beef Cuts" },
	{ numericValue: SITE_STATS.aiModels, suffix: "", label: "AI price models" },
	{ numericValue: SITE_STATS.factories, suffix: "", label: "Export factories" },
	{ numericValue: SITE_STATS.sourceCountries, suffix: "", label: "Beef markets covered" },
];

export const SocialProof: React.FC = () => {
	return (
		<section className="py-12 shadow-[0_-1px_0_0_rgba(0,0,0,0.05),0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_-1px_0_0_rgba(255,255,255,0.08),0_1px_0_0_rgba(255,255,255,0.08)] bg-white dark:bg-background">
			<div className="max-w-6xl mx-auto px-6">
				<StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
					{stats.map((stat, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
						<StaggerChild key={i} className="text-center">
							<div className="mb-1">
								<AnimatedNumber target={stat.numericValue} suffix={stat.suffix} />
							</div>
							<p className="text-sm text-muted-foreground">{stat.label}</p>
						</StaggerChild>
					))}
				</StaggerContainer>
			</div>
		</section>
	);
};

export default SocialProof;
