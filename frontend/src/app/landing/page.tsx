"use client";

import { List, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { MotionReveal } from "@/components/ui/MotionReveal";

const Hero = dynamic(() => import("@/components/landing/Hero"), {
	loading: () => (
		<div className="min-h-[100dvh] flex items-center justify-center bg-white dark:bg-gray-900">
			<div className="w-full max-w-6xl mx-auto px-6 py-24">
				<div className="skeleton h-8 w-48 mb-6" />
				<div className="skeleton h-14 w-3/4 mb-4" />
				<div className="skeleton h-14 w-1/2 mb-8" />
				<div className="skeleton h-6 w-2/3 mb-12" />
				<div className="skeleton h-12 w-40 rounded-md" />
			</div>
		</div>
	),
	ssr: true,
});
const Features = dynamic(() => import("@/components/landing/Features"), {
	loading: () => (
		<div className="py-24 px-6">
			<div className="max-w-6xl mx-auto">
				<div className="skeleton h-8 w-32 mb-4" />
				<div className="skeleton h-10 w-64 mb-8" />
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[0, 1, 2, 3].map((i) => (
						<div key={i} className="skeleton h-32 rounded-lg" />
					))}
				</div>
			</div>
		</div>
	),
});
const GettingStarted = dynamic(() => import("@/components/landing/GettingStarted"), {
	loading: () => (
		<div className="py-24 px-6">
			<div className="max-w-6xl mx-auto space-y-4">
				{[0, 1, 2, 3].map((i) => (
					<div key={i} className="skeleton h-20 rounded-lg" />
				))}
			</div>
		</div>
	),
});
const FAQ = dynamic(() => import("@/components/landing/FAQ"), {
	loading: () => (
		<div className="py-24 px-6">
			<div className="max-w-5xl mx-auto">
				<div className="skeleton h-8 w-32 mb-4" />
				<div className="skeleton h-10 w-64 mb-8" />
				<div className="skeleton h-48 rounded-lg" />
			</div>
		</div>
	),
});
const SocialProof = dynamic(() => import("@/components/landing/SocialProof"), {
	loading: () => (
		<div className="py-12 border-y border-black/5 dark:border-white/10">
			<div className="max-w-6xl mx-auto px-6 grid grid-cols-4 gap-8">
				{[0, 1, 2, 3].map((i) => (
					<div key={i} className="skeleton h-12 rounded" />
				))}
			</div>
		</div>
	),
});

const NAV_LINKS = [
	{ label: "Features", href: "#features" },
	{ label: "FAQ", href: "#faq" },
];

export default function LandingPage() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<div className="overflow-x-hidden w-full max-w-full">
			{/* Navigation — clean top border bar */}
			<header className="fixed top-0 left-0 right-0 z-50 border-b border-black/5 dark:border-white/10 bg-white dark:bg-background">
				<div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
					{/* Logo */}
					<a href="/" className="flex items-center gap-2.5">
						<div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-md flex items-center justify-center">
							<span className="text-white dark:text-gray-900 font-semibold text-base">T</span>
						</div>
						<span className="text-base font-display font-semibold text-gray-900 dark:text-white tracking-tight">
							MT
						</span>
					</a>

					{/* Desktop links */}
					<div className="hidden md:flex items-center gap-6">
						{NAV_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="text-sm text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
							>
								{link.label}
							</a>
						))}
						<a
							href="/register"
							className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
						>
							Get Started
						</a>
					</div>

					{/* Mobile hamburger */}
					<button
						type="button"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						className="flex md:hidden items-center justify-center min-w-[44px] min-h-[44px] text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
					>
						{mobileMenuOpen ? <X size={24} /> : <List size={24} />}
					</button>
				</div>

				{/* Mobile slide-down menu */}
				{mobileMenuOpen && (
					<div className="md:hidden border-t border-black/5 dark:border-white/10 bg-white dark:bg-background px-4 py-4 space-y-1">
						{NAV_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								onClick={() => setMobileMenuOpen(false)}
								className="block px-3 py-2.5 text-sm text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
							>
								{link.label}
							</a>
						))}
						<a
							href="/register"
							onClick={() => setMobileMenuOpen(false)}
							className="block rounded-full bg-black px-4 py-2 text-center text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors mt-2"
						>
							Get Started
						</a>
					</div>
				)}
			</header>

			{/* Hero Section */}
			<Hero />

			{/* Social Proof Marquee */}
			<SocialProof />

			{/* Features Section */}
			<Features />

			{/* Getting Started Section */}
			<GettingStarted />

			{/* FAQ Section */}
			<FAQ />

			{/* CTA Section — clean white, no gradients */}
			<section className="bg-white dark:bg-background border-t border-black/5 dark:border-white/10">
				<div className="px-6 py-24 md:py-36 lg:py-48">
					<MotionReveal className="text-center max-w-[700px] mx-auto">
						<h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
							Start receiving signals today
						</h1>
						<div className="mt-8">
							<a
								href="/register"
								className="rounded-full bg-black px-8 py-3 text-base font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
							>
								Create free account
							</a>
						</div>
						<p className="text-sm text-muted-foreground mt-5">
							Free tier includes beef cut pricing from 5 markets. Upgrade for AI forecasts.
						</p>
					</MotionReveal>
				</div>
			</section>

			{/* Footer — shared marketing footer (brand + links + copyright) */}
			<MarketingFooter />
		</div>
	);
}
