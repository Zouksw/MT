"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type React from "react";
import { useState } from "react";
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
 *
 * Batch B4 (design-optimization): the full three-line explanation was a wall
 * of amber text towering over the page. One scannable summary line + the
 * detail behind a disclosure — same honesty, half the visual noise.
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
	const [expanded, setExpanded] = useState(false);

	// Only render when the backend explicitly says all rows are non-live.
	if (!freshness?.allStale) return null;

	const dateStr = formatDate(freshness.latestDate);
	const parts: string[] = [];
	if (freshness.snapshotCount) parts.push(`${freshness.snapshotCount} snapshot`);
	if (freshness.proxyCount) parts.push(`${freshness.proxyCount} proxy`);
	const breakdown = parts.length ? ` (${parts.join(", ")})` : "";

	return (
		<Alert variant="warning" className="mb-4">
			{/* The Alert variant already renders the warning icon — no second one. */}
			<div className="text-sm flex-1">
				<div className="flex items-center justify-between gap-2 flex-wrap">
					<span>
						<strong>Demo snapshot mode.</strong> Cut-level prices are frozen at{" "}
						<strong>{dateStr}</strong>
						{breakdown} — no live source is publishing right now.
					</span>
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						aria-expanded={expanded}
						className="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline shrink-0"
					>
						{expanded ? "Less" : "Why?"}
						{expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
					</button>
				</div>
				{expanded && (
					<p className="text-xs text-muted-foreground mt-2 leading-relaxed">
						The full product experience (AI predictions per cut, alerts, real-time行情) is
						functional and will activate automatically once a beef data source goes live (e.g. USDA
						MARS or MLA API key configured). Until then every row below is labeled with its
						provenance rather than passed off as live.
					</p>
				)}
			</div>
		</Alert>
	);
};

export default SnapshotBanner;
