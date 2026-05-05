"use client";

import { TriangleAlert } from "lucide-react";
import { Tag } from "@/components/ui/Tag";

export interface AnomalyAlert {
	id: string;
	timeseriesId: string;
	timeseriesName: string;
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	message: string;
	score: number;
	timestamp: string;
}

interface AnomalyAlertBannerProps {
	anomalies: AnomalyAlert[];
	onViewDetails?: () => void;
}

const severityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function getSeverityVariant(s: string): "error" | "warning" | "primary" | "default" {
	if (s === "CRITICAL") return "error";
	if (s === "HIGH") return "warning";
	if (s === "MEDIUM") return "primary";
	return "default";
}

export default function AnomalyAlertBanner({ anomalies, onViewDetails }: AnomalyAlertBannerProps) {
	if (!anomalies.length) return null;

	const sorted = [...anomalies].sort(
		(a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0),
	);
	const criticalCount = sorted.filter(
		(a) => a.severity === "CRITICAL" || a.severity === "HIGH",
	).length;
	const isError = criticalCount > 0;

	return (
		<div
			className={`mb-4 p-4 rounded-lg border ${isError ? "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800"}`}
			role="alert"
			aria-live="assertive"
		>
			<div className="flex items-center gap-2 mb-2">
				<TriangleAlert className={`size-5 ${isError ? "text-red-500" : "text-amber-500"}`} />
				<span className="font-semibold text-gray-900 dark:text-gray-100">
					{anomalies.length} active anomaly{anomalies.length > 1 ? "ies" : "y"}
				</span>
				{criticalCount > 0 && <Tag color="error">{criticalCount} critical</Tag>}
			</div>
			<div className="space-y-1">
				{sorted.slice(0, 3).map((a) => (
					<div key={a.id} className="flex items-center gap-2">
						<Tag color={getSeverityVariant(a.severity)}>{a.severity}</Tag>
						<span className="text-[13px] text-foreground">
							{a.timeseriesName}: {a.message}
						</span>
					</div>
				))}
				{sorted.length > 3 && (
					<span className="text-xs text-gray-400">+{sorted.length - 3} more</span>
				)}
			</div>
			{onViewDetails && (
				<button type="button"
					onClick={onViewDetails}
					className="mt-2 text-sm text-amber-600 hover:underline"
				>
					View details
				</button>
			)}
		</div>
	);
}
