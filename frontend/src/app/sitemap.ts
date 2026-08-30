import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * Public sitemap (IMPROVEMENT-PLAN v3.3.0 batch 1a). Only indexable PUBLIC
 * routes are listed — middleware PUBLIC_PATHS is the access truth and this
 * list is its indexable subset. Auth pages (/login, /register) and the
 * auth-check redirect at "/" carry no indexable content; every login-gated
 * app page is excluded. No fabricated entries: every path here renders.
 */
const PUBLIC_INDEXABLE: {
	path: string;
	changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
	priority: number;
}[] = [
	{ path: "/landing", changeFrequency: "weekly", priority: 1.0 },
	// Live-data digest — the SEO long-tail entry (real series, auto-aggregated).
	{ path: "/market/digest", changeFrequency: "daily", priority: 0.9 },
	{ path: "/ai/track-record", changeFrequency: "weekly", priority: 0.8 },
	{ path: "/tools/landing-cost", changeFrequency: "weekly", priority: 0.8 },
	{ path: "/about", changeFrequency: "monthly", priority: 0.5 },
	{ path: "/pricing", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
	// lastModified is the build stamp — the sitemap regenerates on deploy,
	// which is exactly when content last changed for these static routes.
	const lastModified = new Date();
	return PUBLIC_INDEXABLE.map((route) => ({
		url: `${SITE_URL}${route.path}`,
		lastModified,
		changeFrequency: route.changeFrequency,
		priority: route.priority,
	}));
}
