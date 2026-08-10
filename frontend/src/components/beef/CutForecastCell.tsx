"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type React from "react";
import { memo } from "react";
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

// Memoized (round-88): the beef price table renders up to 50 rows, each with a
// CutForecastCell. Without memo, every keystroke in the search box or filter
// toggle re-rendered all 50 cells even though their `forecast` props hadn't
// changed. The forecast object is a stable reference from the SWR cache, so a
// shallow compare skips unchanged rows.
const CutForecastCellComponent: React.FC<CutForecastCellProps> = ({ forecast }) => {
	if (!forecast) {
		// Honest absence — no forecast available for this cut.
		return <span className="text-xs text-gray-300">—</span>;
	}

	// Guard against an unexpected direction (null/uppercase/empty) — the type
	// claims up/down/flat, but a malformed backend payload would otherwise
	// destructure undefined and crash the whole table. Mirrors the defensive
	// lookup in PriceForecastPanel.tsx:197.
	const { Icon, color } = iconConfig[forecast.direction] ?? iconConfig.flat;
	const title = `${forecast.modelsAgree}/${forecast.availableModels} models agree · ${Math.round(forecast.confidence * 100)}% confidence · ${forecast.dataPoints} pts`;

	return (
		<span className={`inline-flex items-center gap-1 text-xs ${color}`} title={title}>
			<Icon className="size-3" />
			{formatSignedPercent(forecast.predictedChange)}
		</span>
	);
};

export const CutForecastCell = memo(CutForecastCellComponent);

export default CutForecastCell;
