"use client";

import { AlertTriangle } from "lucide-react";
import type React from "react";
import { Alert } from "@/components/ui/Alert";

/**
 * SnapshotBanner — the page-level honesty call-out for /beef.
 *
 * When the backend reports `freshness.allStale === true` (every price row on
 * the page is snapshot/proxy, none live), the platform is NOT showing real-time
 * data. This banner says so plainly, names the date the data is frozen at, and
 * tells the user what changes when real data flows.
 *
 * This is the core of the "no real data is tolerable" contract: the platform
 * stays usable and demoable, but never silently passes frozen seed data off as
 * a live market.
 */

interface SnapshotBannerProps {
	/** Page freshness summary from /api/beef/prices(*).freshness. */
	freshness?: {
		allStale?: boolean;
		liveCount?: number;
		proxyCount?: number;
		snapshotCount?: number;
		latestDate?: string | null;
	} | null;
}

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "an unknown date";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "an unknown date";
	return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export const SnapshotBanner: React.FC<SnapshotBannerProps> = ({ freshness }) => {
	// Only render when the backend explicitly says all rows are non-live.
	if (!freshness || !freshness.allStale) return null;

	const dateStr = formatDate(freshness.latestDate);
	const parts: string[] = [];
	if (freshness.snapshotCount) parts.push(`${freshness.snapshotCount} snapshot`);
	if (freshness.proxyCount) parts.push(`${freshness.proxyCount} proxy`);
	const breakdown = parts.length ? ` (${parts.join(", ")})` : "";

	return (
		<Alert variant="warning" className="mb-4">
			<div className="flex items-start gap-2">
				<AlertTriangle className="size-4 mt-0.5 shrink-0" />
				<div className="text-sm">
					<strong>Demo snapshot mode.</strong> Beef price data on this page is frozen at{" "}
					<strong>{dateStr}</strong>
					{breakdown} — no live scraper is currently producing cut-level prices. The full product
					experience (AI predictions per cut, alerts, real-time行情) is functional and will activate
					automatically once a beef data source goes live (e.g. USDA MARS or MLA API key
					configured).
				</div>
			</div>
		</Alert>
	);
};

export default SnapshotBanner;
