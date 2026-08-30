import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * robots.txt (IMPROVEMENT-PLAN v3.3.0 batch 1a). Default-allow with a
 * negative list of the login-gated app sections (crawl-budget hygiene —
 * middleware already redirects them to /login) plus the API surface. The
 * public acquisition pages under /landing, /market/digest, /ai/track-record
 * and /tools/landing-cost stay crawlable.
 */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			disallow: [
				"/api/",
				"/dashboard",
				"/settings",
				"/datasets",
				"/timeseries",
				"/alerts",
				"/apikeys",
				"/watchlists",
				"/trading",
				"/beef",
				"/market-news",
				// /ai subpages are login-gated except the public track record.
				"/ai/predict",
				"/ai/accuracy",
				"/ai/anomalies",
			],
		},
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
