"use client";

import { ChartLineUp, Flask, Globe, Lightning } from "@phosphor-icons/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";

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
			className="font-mono text-2xl md:text-3xl font-semibold text-[#B8860B] tabular-nums"
		>
			{value}
			{suffix}
		</span>
	);
}

const stats = [
	{
		icon: <Flask size={22} weight="duotone" />,
		numericValue: 108,
		suffix: "",
		label: "Commodities",
	},
	{
		icon: <Lightning size={22} weight="duotone" />,
		numericValue: 7,
		suffix: "",
		label: "AI signal models",
	},
	{
		icon: <ChartLineUp size={22} weight="duotone" />,
		numericValue: 18,
		suffix: "",
		label: "Data ingestion modules",
	},
	{
		icon: <Globe size={22} weight="duotone" />,
		numericValue: 131,
		suffix: "",
		label: "Market factors tracked",
	},
];

export const SocialProof: React.FC = () => {
	return (
		<section className="py-12 shadow-[0_-1px_0_0_rgba(0,0,0,0.05),0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_-1px_0_0_rgba(255,255,255,0.08),0_1px_0_0_rgba(255,255,255,0.08)] bg-white dark:bg-[#0a0a0a]">
			<div className="max-w-6xl mx-auto px-6">
				<StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
					{stats.map((stat, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
						<StaggerChild key={i} className="text-center">
							<div className="flex items-center justify-center gap-2 mb-1">
								<span className="text-muted-foreground">{stat.icon}</span>
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
