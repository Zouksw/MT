"use client";

import { Info } from "lucide-react";
import { formatPrice, formatPriceRange, formatSignedPercent } from "@/lib/format";
import { TRADING_COLORS } from "@/lib/trading-chart-config";
import { MODEL_NAME_MAP } from "@/types/accuracy";
import DirectionBadge from "./DirectionBadge";

type Direction = "up" | "down" | "flat";

interface ModelForecast {
	modelId: string;
	direction: Direction;
	predictedChange: number;
	currentPrice: number;
	predictedPrice: number;
	confidence: number;
	status?: "available" | "unavailable";
	error?: string;
}

interface PriceForecastPanelProps {
	consensusDirection: Direction;
	confidence: number;
	modelsAgree: number;
	totalModels: number;
	individualForecasts: ModelForecast[];
	predictedChange: number;
	currentPrice: number;
	predictedPrice: number;
	horizon: number;
	range: { lower: number; upper: number };
	supportLevel: number;
	resistanceLevel: number;
	distribution: { up: number; down: number; flat: number };
	bestModelId?: string;
	loading?: boolean;
	timestamp?: string;
}

const directionStyles: Record<Direction, { symbol: string; color: string; border: string }> = {
	up: { symbol: "▲", color: TRADING_COLORS.buy, border: `4px solid ${TRADING_COLORS.buy}` },
	down: { symbol: "▼", color: TRADING_COLORS.sell, border: `4px solid ${TRADING_COLORS.sell}` },
	flat: { symbol: "◆", color: TRADING_COLORS.hold, border: `4px dashed ${TRADING_COLORS.hold}` },
};

export default function PriceForecastPanel({
	consensusDirection,
	confidence,
	modelsAgree,
	totalModels,
	individualForecasts,
	predictedChange,
	currentPrice = 0,
	predictedPrice,
	horizon,
	range,
	supportLevel,
	resistanceLevel,
	distribution,
	bestModelId,
	loading = false,
	timestamp,
}: PriceForecastPanelProps) {
	if (loading) {
		return (
			<div className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08] mb-4">
				<div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">
					价格预测
				</div>
				<div className="p-5 animate-pulse space-y-3">
					<div className="h-8 bg-muted rounded" />
					<div className="h-6 bg-muted rounded w-3/4" />
					<div className="h-6 bg-muted rounded w-1/2" />
					<div className="h-6 bg-muted rounded w-2/3" />
				</div>
			</div>
		);
	}

	const safeForecasts = individualForecasts.filter(Boolean);
	if (!safeForecasts.length) {
		return (
			<div className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08] mb-4">
				<div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">
					价格预测
				</div>
				<div className="p-5 text-center text-gray-400">暂无预测数据</div>
			</div>
		);
	}

	const availableCount = safeForecasts.filter((f) => f.status !== "unavailable").length;

	if (availableCount === 0) {
		return (
			<div className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08] mb-4">
				<div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">
					价格预测
				</div>
				<div className="p-5 text-center">
					<p className="text-gray-400">所有模型暂不可用</p>
					<p className="text-xs text-gray-400 mt-1">最后尝试: {new Date().toLocaleTimeString()}</p>
				</div>
			</div>
		);
	}

	const upPct = totalModels > 0 ? (distribution.up / totalModels) * 100 : 0;
	const downPct = totalModels > 0 ? (distribution.down / totalModels) * 100 : 0;
	const flatPct = totalModels > 0 ? (distribution.flat / totalModels) * 100 : 0;

	return (
		<div className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08] mb-4">
			<div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">
				价格预测 · 未来 {horizon} 天
			</div>

			<div className="p-5">
				{/* Direction badge + headline predicted price */}
				<div className="text-center py-2 pb-4">
					<DirectionBadge direction={consensusDirection} confidence={confidence} size="large" />
					<div className="mt-3">
						<span className="text-xs text-gray-500">预测价格</span>
						<div className="text-3xl font-bold font-mono text-gray-900 dark:text-white">
							{formatPrice(predictedPrice, false)}
						</div>
						<div className="text-xs text-gray-500 mt-1">
							当前 {formatPrice(currentPrice, false)} → 区间 {formatPrice(range.lower, false)} –{" "}
							{formatPrice(range.upper, false)}
						</div>
					</div>
				</div>

				<hr className="border my-3" />

				{/* Key stats */}
				<div className="grid grid-cols-2 gap-2">
					<div>
						<span className="text-xs text-gray-500">模型一致</span>
						<br />
						<span className="font-semibold font-mono text-gray-900 dark:text-white">
							{modelsAgree}/{totalModels}
						</span>
					</div>
					<div>
						<span className="text-xs text-gray-500">预测变化</span>
						<br />
						<span
							className="font-semibold font-mono"
							style={{
								color:
									predictedChange > 0
										? TRADING_COLORS.buy
										: predictedChange < 0
											? TRADING_COLORS.sell
											: undefined,
							}}
						>
							{predictedChange > 0 ? "+" : ""}
							{predictedChange}%
						</span>
					</div>
				</div>

				<hr className="border my-3" />

				<div className="grid grid-cols-2 gap-2">
					<div>
						<span className="text-xs text-gray-500">支撑位</span>
						<br />
						<span className="font-semibold font-mono" style={{ color: TRADING_COLORS.supportLine }}>
							{formatPrice(supportLevel, false)}
						</span>
					</div>
					<div>
						<span className="text-xs text-gray-500">阻力位</span>
						<br />
						<span
							className="font-semibold font-mono"
							style={{ color: TRADING_COLORS.resistanceLine }}
						>
							{formatPrice(resistanceLevel, false)}
						</span>
					</div>
				</div>

				<hr className="border my-3" />

				{/* Per-model breakdown */}
				<div className="text-xs">
					<span className="block text-gray-500 font-semibold mb-1">各模型预测</span>
					<div className="flex flex-col gap-1.5">
						{safeForecasts.map((forecast) => {
							const style = directionStyles[forecast.direction] || directionStyles.flat;
							const isUnavailable = forecast.status === "unavailable";

							return (
								<div
									key={forecast.modelId}
									className="flex items-center justify-between py-1 px-2 rounded-r"
									style={{
										borderLeft: isUnavailable ? "4px dashed #D1D5DB" : style.border,
										background: isUnavailable ? "#F9FAFB" : undefined,
										opacity: isUnavailable ? 0.6 : 1,
									}}
									role="status"
									aria-label={`${MODEL_NAME_MAP[forecast.modelId] || forecast.modelId}: ${isUnavailable ? "不可用" : forecast.direction}，置信度 ${Math.round(forecast.confidence * 100)}%`}
								>
									<span className="flex items-center gap-1">
										<span
											className="font-semibold font-mono text-xs"
											style={{ color: isUnavailable ? "#9CA3AF" : style.color }}
										>
											{style.symbol} {MODEL_NAME_MAP[forecast.modelId] || forecast.modelId}
										</span>
										{bestModelId === forecast.modelId && !isUnavailable && (
											<span className="ml-1 px-1 py-px text-[9px] font-semibold rounded bg-success/15 text-success leading-none">
												最佳
											</span>
										)}
										{isUnavailable && (
											<span title={forecast.error || "模型不可用"}>
												<Info className="size-2.5 text-gray-400 ml-1" />
											</span>
										)}
									</span>
									{!isUnavailable && (
										<div className="flex items-center gap-2">
											<div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
												<div
													className="h-full rounded-full"
													style={{
														width: `${Math.round(forecast.confidence * 100)}%`,
														backgroundColor:
															forecast.confidence > 0.7
																? TRADING_COLORS.buy
																: TRADING_COLORS.primaryDark,
													}}
												/>
											</div>
											<span className="text-[10px] font-mono text-gray-500 w-12 text-right">
												{formatSignedPercent(forecast.predictedChange, 1)}
											</span>
										</div>
									)}
									{isUnavailable && <span className="text-[10px] text-gray-400">N/A</span>}
								</div>
							);
						})}
					</div>
				</div>

				<hr className="border my-3" />

				{/* Prediction price range */}
				{currentPrice > 0 && safeForecasts.some((f) => f.status !== "unavailable") && (
					<>
						<span className="block text-gray-500 font-semibold text-xs mb-2">
							各模型预测价格区间
						</span>
						<div className="flex flex-col gap-1.5 mb-1">
							{safeForecasts
								.filter((f) => f.status !== "unavailable")
								.map((forecast) => {
									const spread = forecast.predictedPrice * (1 - forecast.confidence) * 0.5;
									const lower = forecast.predictedPrice - spread;
									const upper = forecast.predictedPrice + spread;
									const min = Math.min(forecast.currentPrice, lower);
									const max = Math.max(forecast.currentPrice, upper);
									const rangeSpan = max - min || 1;
									const currentPct = ((forecast.currentPrice - min) / rangeSpan) * 100;
									const lowerPct = ((lower - min) / rangeSpan) * 100;
									const upperPct = ((upper - min) / rangeSpan) * 100;

									return (
										<div key={forecast.modelId} className="flex items-center gap-2">
											<span className="text-xs font-mono text-muted-foreground w-24 shrink-0">
												{MODEL_NAME_MAP[forecast.modelId] || forecast.modelId}
											</span>
											<div className="flex-1 h-4 relative bg-muted rounded">
												<div
													className="absolute top-0.5 bottom-0.5 rounded opacity-60"
													style={{
														left: `${lowerPct}%`,
														width: `${upperPct - lowerPct}%`,
														backgroundColor:
															forecast.direction === "up"
																? TRADING_COLORS.buy
																: forecast.direction === "down"
																	? TRADING_COLORS.sell
																	: TRADING_COLORS.hold,
													}}
												/>
												<div
													className="absolute top-0 bottom-0 w-0.5 bg-foreground"
													style={{ left: `${currentPct}%` }}
												/>
											</div>
											<span className="text-[10px] font-mono text-muted-foreground w-32 text-right shrink-0">
												{formatPriceRange(lower, upper)}
											</span>
										</div>
									);
								})}
						</div>
						<hr className="border my-3" />
					</>
				)}

				{/* Consensus distribution bar */}
				<div
					role="status"
					aria-label={`共识: ${distribution.up} 看涨, ${distribution.down} 看跌, ${distribution.flat} 横盘`}
					aria-live="polite"
				>
					<span className="block text-gray-500 font-semibold text-xs mb-1">模型方向分布</span>
					<div className="flex h-5 rounded overflow-hidden">
						{upPct > 0 && (
							<div
								style={{ width: `${upPct}%`, background: TRADING_COLORS.buy }}
								className="flex items-center justify-center text-white text-[10px] font-semibold"
							>
								{distribution.up > 0 && `${distribution.up} 看涨`}
							</div>
						)}
						{flatPct > 0 && (
							<div
								style={{
									width: `${flatPct}%`,
									background: TRADING_COLORS.hold,
									backgroundImage: "radial-gradient(circle, #94A3B8 1px, transparent 1px)",
									backgroundSize: "4px 4px",
								}}
								className="flex items-center justify-center text-white text-[10px] font-semibold"
							>
								{distribution.flat > 0 && `${distribution.flat} 横盘`}
							</div>
						)}
						{downPct > 0 && (
							<div
								style={{
									width: `${downPct}%`,
									background: TRADING_COLORS.sell,
									backgroundImage:
										"repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)",
								}}
								className="flex items-center justify-center text-white text-[10px] font-semibold"
							>
								{distribution.down > 0 && `${distribution.down} 看跌`}
							</div>
						)}
					</div>
				</div>
			</div>

			{timestamp && (
				<p className="text-[10px] text-gray-400 text-right mt-2">
					更新于 {new Date(timestamp).toLocaleTimeString()}
				</p>
			)}
		</div>
	);
}
