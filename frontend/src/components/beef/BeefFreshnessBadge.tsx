"use client";

import type React from "react";
import { memo } from "react";

/**
 * BeefFreshnessBadge — consumes the backend's 3-tier freshness classification
 * (services/beefFreshness.ts). Distinct from the legacy FreshnessBadge which
 * only knows date-age; this one renders the semantic tier the backend assigns.
 *
 * Tiers:
 *   live     🟢 — real scraper output, recent
 *   proxy    🟡 — bridged from an upstream commodity (aggregate proxy)
 *   snapshot 🔴 — seed data or real-but-stale (>7d)
 */

export type BeefFreshness = "live" | "proxy" | "snapshot";

interface BeefFreshnessBadgeProps {
	freshness?: BeefFreshness;
	/** ISO date string — shown in compact tooltip/subtitle. */
	dataDate?: string | null;
	/** Compact = just the dot + label (table cell). Full = with reason (detail page). */
	compact?: boolean;
	/** Optional reason text from backend (shown in full mode tooltip). */
	reason?: string;
}

const TIER_CONFIG: Record<BeefFreshness, { label: string; dotClass: string; textClass: string }> = {
	live: { label: "Live", dotClass: "bg-success", textClass: "text-success" },
	proxy: { label: "Proxy", dotClass: "bg-warning", textClass: "text-warning" },
	snapshot: {
		label: "Snapshot",
		dotClass: "bg-destructive",
		textClass: "text-destructive",
	},
};

function formatDate(iso: string | null | undefined): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Memoized (round-88): rendered in up to 50 rows of the beef price table
// alongside CutForecastCell. Props are all primitives/stable references from
// the SWR cache, so a shallow compare skips unchanged rows during search/filter.
const BeefFreshnessBadgeComponent: React.FC<BeefFreshnessBadgeProps> = ({
	freshness,
	dataDate,
	compact = true,
	reason,
}) => {
	if (!freshness) {
		return (
			<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
				<span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
				{compact ? "—" : "No data"}
			</span>
		);
	}

	const cfg = TIER_CONFIG[freshness] ?? TIER_CONFIG.snapshot;
	const dateStr = formatDate(dataDate);
	const title = reason
		? `${cfg.label}${dateStr ? ` · ${dateStr}` : ""} — ${reason}`
		: `${cfg.label}${dateStr ? ` · ${dateStr}` : ""}`;

	return (
		<span className={`inline-flex items-center gap-1 text-xs ${cfg.textClass}`} title={title}>
			<span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
			{compact ? cfg.label : `${cfg.label}${dateStr ? ` · ${dateStr}` : ""}`}
		</span>
	);
};

export const BeefFreshnessBadge = memo(BeefFreshnessBadgeComponent);

export default BeefFreshnessBadge;
