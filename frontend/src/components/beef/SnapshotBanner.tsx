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
	if (!iso) return "未知日期";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "未知日期";
	return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export const SnapshotBanner: React.FC<SnapshotBannerProps> = ({ freshness }) => {
	const [expanded, setExpanded] = useState(false);

	// Only render when the backend explicitly says all rows are non-live.
	if (!freshness?.allStale) return null;

	const dateStr = formatDate(freshness.latestDate);
	const parts: string[] = [];
	if (freshness.snapshotCount) parts.push(`${freshness.snapshotCount} 条快照`);
	if (freshness.proxyCount) parts.push(`${freshness.proxyCount} 条代理`);
	const breakdown = parts.length ? ` (${parts.join(", ")})` : "";

	return (
		<Alert variant="warning" className="mb-4">
			{/* The Alert variant already renders the warning icon — no second one. */}
			<div className="text-sm flex-1">
				<div className="flex items-center justify-between gap-2 flex-wrap">
					<span>
						<strong>演示快照模式。</strong>部位级价格冻结于 <strong>{dateStr}</strong>
						{breakdown} —— 当前无实时数据源在发布。
					</span>
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						aria-expanded={expanded}
						className="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline shrink-0"
					>
						{expanded ? "收起" : "为什么？"}
						{expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
					</button>
				</div>
				{expanded && (
					<p className="text-xs text-muted-foreground mt-2 leading-relaxed">
						完整产品能力（部位级 AI 预测、告警、实时行情）均已就绪，一旦牛肉数据源上线 （如配置 USDA
						MARS 或 MLA API key）即自动激活。在此之前，下方每一行都标注其数据来源，
						绝不将快照数据冒充实时行情。
					</p>
				)}
			</div>
		</Alert>
	);
};

export default SnapshotBanner;
