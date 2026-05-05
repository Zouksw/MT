"use client";

import { ArrowUp, List, X } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useState } from "react";
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

const FOOTER_SECTIONS = [
	{
		title: "Product",
		links: [
			{ label: "Features", href: "#features" },
			{ label: "Pricing", href: "/pricing" },
			{ label: "About", href: "/about" },
		],
	},
	{
		title: "Support",
		links: [
			{ label: "FAQ", href: "#faq" },
			{ label: "Get Started", href: "/register" },
		],
	},
];

export default function LandingPage() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<div className="overflow-x-hidden w-full max-w-full">
			{/* Navigation — clean top border bar */}
			<header className="fixed top-0 left-0 right-0 z-50 border-b border-black/5 dark:border-white/10 bg-white dark:bg-gray-950">
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
					<button type="button"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						className="flex md:hidden items-center justify-center min-w-[44px] min-h-[44px] text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
					>
						{mobileMenuOpen ? <X size={24} /> : <List size={24} />}
					</button>
				</div>

				{/* Mobile slide-down menu */}
				{mobileMenuOpen && (
					<div className="md:hidden border-t border-black/5 dark:border-white/10 bg-white dark:bg-gray-950 px-4 py-4 space-y-1">
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
			<section className="bg-white dark:bg-gray-950 border-t border-black/5 dark:border-white/10">
				<div className="px-6 py-24 md:py-36 lg:py-48">
					<MotionReveal className="text-center max-w-[700px] mx-auto">
						<h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
							Ready to get started?
						</h2>
						<div className="mt-8">
							<a
								href="/register"
								className="rounded-full bg-black px-8 py-3 text-base font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
							>
								Start free trial
							</a>
						</div>
						<p className="text-sm text-gray-400 mt-5">
							No credit card required. Free 14-day trial.
						</p>
					</MotionReveal>
				</div>
			</section>

			{/* Footer — clean, minimal */}
			<footer className="bg-white dark:bg-gray-950 border-t border-black/5 dark:border-white/10 px-6 py-16 md:py-24">
				<div className="max-w-[1200px] mx-auto">
					<div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
						{/* Brand */}
						<div className="max-w-xs">
							<div className="flex items-center gap-2.5 mb-3">
								<div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-md flex items-center justify-center">
									<span className="text-white dark:text-gray-900 font-semibold text-base">T</span>
								</div>
								<span className="text-base font-display font-semibold text-gray-900 dark:text-white tracking-tight">
									MT
								</span>
							</div>
							<p className="text-sm text-muted-foreground leading-relaxed">
								AI-powered commodity market intelligence for 55+ commodities.
							</p>
						</div>

						{/* Link columns */}
						<div className="flex gap-12 md:gap-16">
							{FOOTER_SECTIONS.map((section) => (
								<div key={section.title}>
									<h4 className="font-mono uppercase text-xs font-medium text-gray-400 tracking-wide mb-3">
										{section.title}
									</h4>
									<ul className="space-y-2">
										{section.links.map((link) => (
											<li key={link.href + link.label}>
												<a
													href={link.href}
													className="text-sm text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
												>
													{link.label}
												</a>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</div>

					<div className="border-t border-black/5 dark:border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
						<p className="text-xs text-gray-400">&copy; 2026 MT. All rights reserved.</p>
						<button type="button"
							onClick={scrollToTop}
							className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
						>
							<ArrowUp size={14} />
							Back to top
						</button>
					</div>
				</div>
			</footer>
		</div>
	);
}
