"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type React from "react";
import type { CutForecastSummary } from "@/hooks/useBeefCutForecasts";
import { formatSignedPercent } from "@/lib/format";

/**
 * CutForecastCell — the compact per-row forecast summary for the price table.
 *
 * Renders an inline direction icon + signed % change + confidence, or nothing
 * if the cut has no forecast (stale/insufficient data — an honest absence
 * rather than a fabricated zero). Tooltip carries the model agreement detail.
 */

interface CutForecastCellProps {
	forecast?: CutForecastSummary | null;
}

const iconConfig = {
	up: { Icon: TrendingUp, color: "text-success" },
	down: { Icon: TrendingDown, color: "text-destructive" },
	flat: { Icon: Minus, color: "text-warning" },
};

export const CutForecastCell: React.FC<CutForecastCellProps> = ({ forecast }) => {
	if (!forecast) {
		// Honest absence — no forecast available for this cut.
		return <span className="text-xs text-gray-300">—</span>;
	}

	const { Icon, color } = iconConfig[forecast.direction];
	const title = `${forecast.modelsAgree}/${forecast.availableModels} models agree · ${Math.round(forecast.confidence * 100)}% confidence · ${forecast.dataPoints} pts`;

	return (
		<span className={`inline-flex items-center gap-1 text-xs ${color}`} title={title}>
			<Icon className="size-3" />
			{formatSignedPercent(forecast.predictedChange)}
		</span>
	);
};

export default CutForecastCell;
