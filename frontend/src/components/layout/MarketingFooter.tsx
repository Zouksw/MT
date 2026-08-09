"use client";

import { ArrowUp } from "lucide-react";
import { SITE_STATS } from "@/lib/site-stats";

/**
 * Shared footer for marketing pages (landing / about / pricing).
 *
 * Before round-83 the footer was inlined three times with varying detail:
 * landing had the full brand block + link columns + copyright, while about
 * and pricing carried only a bare copyright line — so the brand identity
 * (slogan, navigation) was missing on two of the three public-facing pages.
 *
 * Link hrefs use the `/<page>#<anchor>` form (not bare `#anchor`) so they
 * work from any page: on landing they scroll in-place, on other pages they
 * route back to landing then scroll. The marketing nav already links to
 * /pricing and /about as full routes.
 *
 * The slogan numbers come from SITE_STATS (the single source of truth,
 * site-stats.ts) — never hardcode counts here.
 */

const FOOTER_SECTIONS = [
	{
		title: "Product",
		links: [
			{ label: "Features", href: "/#features" },
			{ label: "Pricing", href: "/pricing" },
			{ label: "About", href: "/about" },
		],
	},
	{
		title: "Support",
		links: [
			{ label: "FAQ", href: "/#faq" },
			{ label: "Get Started", href: "/register" },
		],
	},
] as const;

export function MarketingFooter() {
	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<footer className="bg-white dark:bg-background border-t border-black/5 dark:border-white/10 px-6 py-16 md:py-24">
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
							{SITE_STATS.beefCuts} beef cuts. {SITE_STATS.aiModels} AI price models.{" "}
							{SITE_STATS.sourceCountries} export markets.
						</p>
					</div>

					{/* Link columns */}
					<div className="flex gap-12 md:gap-16">
						{FOOTER_SECTIONS.map((section) => (
							<div key={section.title}>
								<h4 className="font-mono uppercase text-xs font-medium text-muted-foreground tracking-wide mb-3">
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
					<p className="text-xs text-muted-foreground">&copy; 2026 MT. All rights reserved.</p>
					<button
						type="button"
						onClick={scrollToTop}
						className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
					>
						<ArrowUp size={14} />
						Back to top
					</button>
				</div>
			</div>
		</footer>
	);
}
