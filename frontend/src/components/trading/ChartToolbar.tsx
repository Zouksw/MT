"use client";

import { Maximize } from "lucide-react";

export type ChartType = "candlestick" | "line";

export interface IndicatorState {
	sma20: boolean;
	sma50: boolean;
	bollinger: boolean;
}

interface ChartToolbarProps {
	chartType: ChartType;
	onChartTypeChange: (type: ChartType) => void;
	indicators: IndicatorState;
	onIndicatorsChange: (indicators: IndicatorState) => void;
	onFullscreenToggle?: () => void;
}

const chartTypeOptions: { key: ChartType; label: string; icon: string }[] = [
	{ key: "candlestick", label: "K线", icon: "||" },
	{ key: "line", label: "折线", icon: "~" },
];

const indicatorOptions: { key: keyof IndicatorState; label: string }[] = [
	{ key: "sma20", label: "SMA 20" },
	{ key: "sma50", label: "SMA 50" },
	{ key: "bollinger", label: "Bollinger" },
];

export default function ChartToolbar({
	chartType,
	onChartTypeChange,
	indicators,
	onIndicatorsChange,
	onFullscreenToggle,
}: ChartToolbarProps) {
	return (
		<div
			className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-white"
			style={{ boxShadow: "rgba(0,0,0,0.08) 0px 0px 0px 1px" }}
		>
			{/* Chart type toggle */}
			<fieldset className="flex items-center gap-1" aria-label="Chart type">
				{chartTypeOptions.map((opt) => {
					const isActive = chartType === opt.key;
					return (
						<button
							key={opt.key}
							type="button"
							onClick={() => onChartTypeChange(opt.key)}
							className={`
                px-2.5 py-1 text-xs font-medium rounded transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                ${
									isActive
										? "bg-[#171717] text-white"
										: "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
								}
              `}
							aria-pressed={isActive}
						>
							{opt.label}
						</button>
					);
				})}
			</fieldset>

			{/* Indicator toggles */}
			<div className="flex items-center gap-3">
				{indicatorOptions.map((opt) => (
					<label
						key={opt.key}
						className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none"
					>
						<input
							type="checkbox"
							checked={indicators[opt.key]}
							suppressHydrationWarning
							onChange={(e) =>
								onIndicatorsChange({
									...indicators,
									[opt.key]: e.target.checked,
								})
							}
							className="w-3.5 h-3.5 rounded accent-[#B8860B] cursor-pointer"
						/>
						{opt.label}
					</label>
				))}
			</div>

			{/* Fullscreen toggle */}
			{onFullscreenToggle && (
				<button
					type="button"
					onClick={onFullscreenToggle}
					className="
            p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50
            transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          "
					aria-label="Toggle fullscreen"
					title="Fullscreen"
				>
					<Maximize className="size-4" />
				</button>
			)}
		</div>
	);
}
