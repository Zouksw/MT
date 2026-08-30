/**
 * Canonical site origin for absolute SEO URLs (sitemap.xml, robots.txt,
 * metadataBase/canonical resolution).
 *
 * NEXT_PUBLIC_APP_URL must be set to the REAL deployed origin for SEO to be
 * meaningful. The shipped .env.production still carries the scaffold
 * placeholder "your-domain.com" (same class of trap as the round-107
 * NEXT_PUBLIC_WS_URL placeholder — a placeholder baked into the build
 * artifact actively misleads crawlers), so it is treated as UNSET and the
 * localhost fallback applies until a real domain is configured. Setting the
 * real origin + rebuild flips every absolute SEO URL to the truth.
 */
const RAW_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export const SITE_URL =
	RAW_APP_URL && !RAW_APP_URL.includes("your-domain.com") ? RAW_APP_URL : "http://localhost:3000";
