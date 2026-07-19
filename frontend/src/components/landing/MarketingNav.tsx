"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

/**
 * Sticky top navigation shared by the marketing sub-pages (About, Pricing).
 *
 * Why this exists: about/page.tsx and pricing/page.tsx had byte-near-identical
 * ~30-line <nav> blocks that diverged only in which two links they rendered.
 * This component captures that shared layout (sticky, h-16, logo, 2 links,
 * Sign In CTA) and takes the link set + CTA as props.
 *
 * Why landing/page.tsx does NOT use this: the landing <header> is a genuinely
 * different shape — `fixed` (not sticky), h-14 (not h-16), a mobile hamburger
 * menu, anchor links (#features/#faq vs page routes), and a pill-style CTA.
 * Forcing it into this component would require props for every one of those
 * axes (fixed-vs-sticky, height, mobileMenu, anchor-vs-route, cta-variant) —
 * a prop explosion for a single consumer. Landing keeps its own header.
 */

export interface NavLink {
	label: string;
	href: string;
}

export interface MarketingNavProps {
	/** Desktop links rendered between the logo and the CTA (mobile shows CTA only). */
	links: NavLink[];
	/** CTA button label (default "Sign In"). */
	ctaLabel?: string;
	/** CTA button destination (default "/dashboard"). */
	ctaHref?: string;
}

export function MarketingNav({
	links,
	ctaLabel = "Sign In",
	ctaHref = "/dashboard",
}: MarketingNavProps) {
	return (
		<nav className="border-b border-black/5 dark:border-white/10 bg-white dark:bg-background sticky top-0 z-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center h-16">
					<Link href="/" className="flex items-center gap-2">
						<div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-md flex items-center justify-center">
							<span className="text-white dark:text-gray-900 font-semibold text-lg">T</span>
						</div>
						<span className="text-h4 font-display font-semibold text-foreground">MT</span>
					</Link>
					<div className="hidden md:flex items-center gap-8">
						{links.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="text-body text-muted-foreground hover:text-primary transition-colors"
							>
								{link.label}
							</Link>
						))}
						<Link href={ctaHref}>
							<Button variant="primary" size="sm">
								{ctaLabel}
							</Button>
						</Link>
					</div>
				</div>
			</div>
		</nav>
	);
}

export default MarketingNav;
