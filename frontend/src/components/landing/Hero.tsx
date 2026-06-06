"use client";

import { ArrowRight, Gauge, TrendUp } from "@phosphor-icons/react";
import type React from "react";
import { useEffect, useRef } from "react";
import { HexGrid } from "@/components/ui/GeometricArt";
import { MotionReveal, StaggerChild, StaggerContainer } from "@/components/ui/MotionReveal";

const DATA_STREAM = [
	12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45, 42, 50, 48, 55, 52, 60, 58, 65, 62, 70, 68, 75,
	72, 80, 78, 85, 82, 90,
];

function MiniSparkline() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animRef = useRef<number>(0);
	const offsetRef = useRef(0);

	useEffect(() => {
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale(dpr, dpr);

		const W = rect.width;
		const H = rect.height;

		function draw() {
			if (!ctx) return;
			ctx.clearRect(0, 0, W, H);

			const offset = offsetRef.current;
			const visiblePoints = 60;
			const step = W / visiblePoints;

			const lines = [
				{ data: DATA_STREAM, color: "rgba(184, 134, 11, 0.5)", width: 2 },
				{
					data: DATA_STREAM.map((v) => v * 0.7 + 10),
					color: "rgba(184, 134, 11, 0.25)",
					width: 1.5,
				},
				{ data: DATA_STREAM.map((v) => v * 0.5 + 20), color: "rgba(184, 134, 11, 0.1)", width: 1 },
			];

			lines.forEach(({ data, color, width: lw }) => {
				ctx.beginPath();
				ctx.strokeStyle = color;
				ctx.lineWidth = lw;
				for (let i = 0; i < visiblePoints; i++) {
					const idx = Math.floor((i + offset) % data.length);
					const nextIdx = (idx + 1) % data.length;
					const progress = (i + offset) % 1;
					const value = data[idx] * (1 - progress) + data[nextIdx] * progress;
					const x = i * step;
					const y = H - (value / 100) * H * 0.8 - H * 0.1;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.stroke();
			});

			const lastIdx = Math.floor((visiblePoints - 1 + offset) % DATA_STREAM.length);
			const lastY = H - (DATA_STREAM[lastIdx] / 100) * H * 0.8 - H * 0.1;
			const lastX = (visiblePoints - 1) * step;
			ctx.beginPath();
			ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(184, 134, 11, 0.8)";
			ctx.fill();
			ctx.beginPath();
			ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(184, 134, 11, 0.15)";
			ctx.fill();

			if (prefersReducedMotion) return;
			offsetRef.current += 0.15;
			animRef.current = requestAnimationFrame(draw);
		}

		draw();
		return () => cancelAnimationFrame(animRef.current);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="w-full h-40 md:h-56 lg:h-72 opacity-80"
			style={{ display: "block" }}
		/>
	);
}

const features = [
	{
		title: "Cut-Level Pricing",
		description:
			"85+ standardized beef cuts with factory-level pricing across US, Brazil, Australia, Uruguay, and Argentina",
		span: "md:col-span-2",
	},
	{
		title: "8 AI Price Models",
		description:
			"ARIMA, Holt-Winters, STL, Timer-XL, Chronos-2 — each producing independent price forecasts with confidence intervals",
		span: "",
	},
	{
		title: "Global Trade Flows",
		description:
			"Export volume and FOB pricing from Brazil, Uruguay, Australia — the world's largest beef exporters",
		span: "",
	},
];

const priceItems = [
	{ name: "Chuck Roll Choice", price: "389.50", change: "+2.14%", up: true },
	{ name: "Ribeye Lip-On", price: "612.80", change: "+0.87%", up: true },
	{ name: "Brisket Flat", price: "295.25", change: "-0.53%", up: false },
];

export const Hero: React.FC = () => {
	return (
		<section className="relative overflow-hidden bg-white dark:bg-[#0a0a0a] min-h-[100dvh] flex items-center">
			{/* HexGrid SVG background */}
			<HexGrid />

			<div className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:py-36 lg:py-48 w-full">
				{/* Asymmetric split: text left, dashboard right */}
				<div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-center">
					{/* Left: Text content (3/5) */}
					<div className="lg:col-span-3">
						<MotionReveal>
							<p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-[#B8860B]">
								85+ beef cuts &middot; 8 AI models &middot; 5 export markets
							</p>
						</MotionReveal>

						<MotionReveal delay={0.1}>
							<h1 className="text-4xl sm:text-5xl lg:text-7xl tracking-tighter font-semibold text-gray-900 dark:text-white">
								Global Beef Trade
								<br />
								<span className="text-[#B8860B]">Intelligence, Decoded</span>
							</h1>
						</MotionReveal>

						<MotionReveal delay={0.2}>
							<p className="mt-6 max-w-xl text-lg font-medium text-muted-foreground leading-relaxed">
								Factory-level cut pricing from{" "}
								<span className="font-mono text-[#B8860B]">16+ export plants</span> across 5
								countries. AI price forecasting, export flow tracking, and supply chain monitoring —
								all in one platform.
							</p>
						</MotionReveal>

						<MotionReveal delay={0.3}>
							<div className="mt-8 flex flex-wrap gap-4">
								<a
									href="/register"
									className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
								>
									Start Tracking Beef Prices
									<ArrowRight size={16} weight="bold" />
								</a>
								<a
									href="#features"
									className="inline-flex items-center gap-2 rounded-full border border-black/20 px-6 py-3 text-sm font-semibold text-black hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5 transition-colors"
								>
									See How It Works
								</a>
							</div>
						</MotionReveal>

						{/* Metrics bar */}
						<MotionReveal delay={0.4}>
							<div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground font-mono tabular-nums">
								<div className="flex items-center gap-2">
									<span className="text-[#B8860B] font-semibold text-base">85+</span>
									<span>Beef Cuts Tracked</span>
								</div>
								<div className="w-px h-4 bg-muted" />
								<div className="flex items-center gap-2">
									<span className="text-[#B8860B] font-semibold text-base">8</span>
									<span>AI Price Models</span>
								</div>
								<div className="w-px h-4 bg-muted" />
								<div className="flex items-center gap-2">
									<span className="text-[#B8860B] font-semibold text-base">5</span>
									<span>Export Markets</span>
								</div>
							</div>
						</MotionReveal>
					</div>

					{/* Right: Dashboard mockup (2/5) — dark panel, Tailwind code panel style */}
					<div className="lg:col-span-2">
						<MotionReveal delay={0.3}>
							<div className="rounded-2xl bg-[#0a0a0a] p-4 text-white">
								{/* Window chrome — 3 dots */}
								<div className="mb-3 flex items-center gap-1.5">
									<div className="size-2 rounded-full bg-white/20" />
									<div className="size-2 rounded-full bg-white/20" />
									<div className="size-2 rounded-full bg-white/20" />
								</div>

								{/* Header bar */}
								<div className="mb-3 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<TrendUp size={16} weight="duotone" className="text-[#B8860B]" />
										<span className="text-sm font-medium text-gray-400">
											Chuck Roll Choice — USDA
										</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="size-1.5 rounded-full bg-green-500" />
										<span className="text-xs text-green-400 font-medium">Live</span>
									</div>
								</div>

								{/* Price tickers */}
								<div className="mb-3 space-y-1.5">
									{priceItems.map((item) => (
										<div
											key={item.name}
											className="flex items-center justify-between px-3 py-2 rounded-md bg-white/5"
										>
											<span className="text-xs font-medium text-gray-300">{item.name}</span>
											<div className="flex items-center gap-3">
												<span className="text-xs font-mono text-white tabular-nums">
													${item.price}
												</span>
												<span
													className={`text-xs font-mono tabular-nums ${item.up ? "text-green-400" : "text-red-400"}`}
												>
													{item.change}
												</span>
											</div>
										</div>
									))}
								</div>

								{/* Sparkline chart */}
								<MiniSparkline />

								{/* Signal bar */}
								<div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-md bg-white/5">
									<Gauge size={14} weight="duotone" className="text-[#B8860B]" />
									<span className="text-xs font-medium text-gray-400">AI Consensus</span>
									<span className="text-xs font-semibold text-green-400 ml-auto">Price Up</span>
									<span className="text-xs text-gray-500 font-mono tabular-nums">78%</span>
								</div>
							</div>
						</MotionReveal>
					</div>
				</div>

				{/* Bento Feature Cards — outline style */}
				<StaggerContainer className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
					{features.map((feature, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
						<StaggerChild key={i} className={`${feature.span}`}>
							<div className="group relative rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08] bg-white dark:bg-[#111] p-6 transition-all duration-300 hover:ring-black/[0.12] dark:hover:ring-white/[0.14]">
								<div className="relative z-10">
									<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
										{feature.title}
									</h3>
									<p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
								</div>
							</div>
						</StaggerChild>
					))}
				</StaggerContainer>
			</div>
		</section>
	);
};

export default Hero;
