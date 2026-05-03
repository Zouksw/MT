"use client";

import { ArrowLeft, House } from "@phosphor-icons/react";
import { FileSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrokenHex } from "@/components/ui/GeometricArt";
import { MotionReveal } from "@/components/ui/MotionReveal";

export default function NotFound() {
	const router = useRouter();

	return (
		<div className="min-h-[100dvh] flex items-center justify-center bg-white dark:bg-gray-950 px-6 relative overflow-hidden">
			<BrokenHex className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
			<MotionReveal className="relative z-10 max-w-[600px] text-center">
				{/* 404 Number */}
				<div className="text-[clamp(120px,20vw,200px)] font-black leading-none mb-[-20px] select-none text-gray-900/[0.06] dark:text-white/[0.06] font-display">
					404
				</div>

				{/* Icon */}
				<div className="w-[100px] h-[100px] rounded-3xl bg-muted flex items-center justify-center mx-auto mb-8 outline outline-black/6 dark:outline-white/10">
					<FileSearch size={48} className="text-primary" />
				</div>

				{/* Title */}
				<h1
					className="font-display text-[clamp(32px,5vw,48px)] font-semibold text-gray-900 dark:text-white mb-4 leading-tight"
					style={{ letterSpacing: "-0.03em" }}
				>
					Page Not Found
				</h1>

				{/* Description */}
				<p className="text-lg text-muted-foreground mb-10 leading-relaxed">
					Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been removed
					or is temporarily unavailable.
				</p>

				{/* Action Buttons */}
				<div className="flex gap-4 justify-center flex-wrap">
					<button
						onClick={() => router.push("/")}
						className="inline-flex items-center gap-2 h-12 px-8 py-3 text-base font-semibold rounded-full bg-black text-white hover:bg-gray-800 transition-colors"
					>
						<House size={18} weight="duotone" />
						Go Home
					</button>
					<button
						onClick={() => router.back()}
						className="inline-flex items-center gap-2 h-12 px-8 py-3 text-base font-semibold rounded-full border border-black/20 text-black hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5 transition-colors"
					>
						<ArrowLeft size={18} weight="duotone" />
						Go Back
					</button>
				</div>

				{/* Helpful Links */}
				<div className="mt-12">
					<p className="text-sm text-gray-400 mb-4">Or try these:</p>
					<div className="flex gap-6 justify-center flex-wrap">
						{[
							{ href: "/dashboard", label: "Dashboard" },
							{ href: "/timeseries", label: "Time Series" },
							{ href: "/alerts", label: "Alerts" },
							{ href: "/forecasts", label: "Forecasts" },
						].map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="text-sm text-primary hover:text-primary-hover transition-colors"
							>
								{link.label}
							</a>
						))}
					</div>
				</div>
			</MotionReveal>
		</div>
	);
}
