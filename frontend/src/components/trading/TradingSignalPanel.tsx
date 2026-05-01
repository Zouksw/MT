"use client";

import { Info } from "lucide-react";
import SignalBadge from "./SignalBadge";
import { TRADING_COLORS } from "@/lib/trading-chart-config";

interface ModelSignal {
  modelId: string;
  type: "BUY" | "SELL" | "HOLD";
  predictedChange: number;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  status?: "available" | "unavailable";
  error?: string;
}

interface TradingSignalPanelProps {
  consensusType: "BUY" | "SELL" | "HOLD";
  confidence: number;
  modelsAgree: number;
  totalModels: number;
  individualSignals: ModelSignal[];
  predictedDirection: number;
  supportLevel: number;
  resistanceLevel: number;
  distribution: { buy: number; sell: number; hold: number };
  currentPrice?: number;
  loading?: boolean;
}

const modelNameMap: Record<string, string> = {
  arima: "ARIMA",
  holtwinters: "Holt-Winters",
  exponential_smoothing: "Exp. Smoothing",
  naive_forecaster: "Naive",
  stl_forecaster: "STL",
  timer_xl: "Timer-XL",
  sundial: "Sundial",
};

const signalSymbols: Record<string, { symbol: string; color: string; border: string }> = {
  BUY: { symbol: "▲", color: TRADING_COLORS.buy, border: `4px solid ${TRADING_COLORS.buy}` },
  SELL: { symbol: "▼", color: TRADING_COLORS.sell, border: `4px solid ${TRADING_COLORS.sell}` },
  HOLD: { symbol: "◆", color: TRADING_COLORS.hold, border: `4px dashed ${TRADING_COLORS.hold}` },
};

export default function TradingSignalPanel({
  consensusType,
  confidence,
  modelsAgree,
  totalModels,
  individualSignals,
  predictedDirection,
  supportLevel,
  resistanceLevel,
  distribution,
  currentPrice = 0,
  loading = false,
}: TradingSignalPanelProps) {
  if (loading) {
    return (
      <div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 mb-4">
        <div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">Signal Analysis</div>
        <div className="p-5 animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded" />
          <div className="h-6 bg-muted rounded w-3/4" />
          <div className="h-6 bg-muted rounded w-1/2" />
          <div className="h-6 bg-muted rounded w-2/3" />
        </div>
      </div>
    );
  }

  const safeSignals = individualSignals.filter(Boolean);
  if (!safeSignals.length) {
    return (
      <div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 mb-4">
        <div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">Signal Analysis</div>
        <div className="p-5 text-center text-gray-400">No signals available</div>
      </div>
    );
  }

  const availableCount = safeSignals.filter((s) => s.status !== "unavailable").length;

  if (availableCount === 0) {
    return (
      <div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 mb-4">
        <div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">Signal Analysis</div>
        <div className="p-5 text-center">
          <p className="text-gray-400">No signals available</p>
          <p className="text-xs text-gray-400 mt-1">Last attempted: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    );
  }

  const buyPct = totalModels > 0 ? (distribution.buy / totalModels) * 100 : 0;
  const sellPct = totalModels > 0 ? (distribution.sell / totalModels) * 100 : 0;
  const holdPct = totalModels > 0 ? (distribution.hold / totalModels) * 100 : 0;

  return (
    <div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 mb-4">
      <div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 font-semibold">Signal Analysis</div>

      <div className="p-5">
        {/* Consensus badge */}
        <div className="text-center py-2 pb-4">
          <SignalBadge type={consensusType} confidence={confidence} size="large" />
        </div>

        <hr className="border my-3" />

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-gray-500">Models Agree</span>
            <br />
            <span className="font-semibold font-mono text-gray-900 dark:text-white">{modelsAgree}/{totalModels}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500">Direction</span>
            <br />
            <span
              className="font-semibold font-mono"
              style={{ color: predictedDirection > 0 ? TRADING_COLORS.buy : predictedDirection < 0 ? TRADING_COLORS.sell : undefined }}
            >
              {predictedDirection > 0 ? "+" : ""}{predictedDirection}%
            </span>
          </div>
        </div>

        <hr className="border my-3" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-gray-500">Support</span>
            <br />
            <span className="font-semibold font-mono" style={{ color: TRADING_COLORS.supportLine }}>
              ${supportLevel?.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-500">Resistance</span>
            <br />
            <span className="font-semibold font-mono" style={{ color: TRADING_COLORS.resistanceLine }}>
              ${resistanceLevel?.toFixed(2)}
            </span>
          </div>
        </div>

        <hr className="border my-3" />

        {/* Per-model breakdown */}
        <div className="text-xs">
          <span className="block text-gray-500 font-semibold mb-1">Per-Model Breakdown</span>
          <div className="flex flex-col gap-1.5">
            {safeSignals.map((signal) => {
              const style = signalSymbols[signal.type] || signalSymbols.HOLD;
              const isUnavailable = signal.status === "unavailable";

              return (
                <div
                  key={signal.modelId}
                  className="flex items-center justify-between py-1 px-2 rounded-r"
                  style={{
                    borderLeft: isUnavailable ? "4px dashed #D1D5DB" : style.border,
                    background: isUnavailable ? "#F9FAFB" : undefined,
                    opacity: isUnavailable ? 0.6 : 1,
                  }}
                  role="status"
                  aria-label={`${modelNameMap[signal.modelId] || signal.modelId}: ${isUnavailable ? "unavailable" : signal.type} signal, confidence ${Math.round(signal.confidence * 100)}%`}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="font-semibold font-mono text-xs"
                      style={{ color: isUnavailable ? "#9CA3AF" : style.color }}
                    >
                      {style.symbol} {modelNameMap[signal.modelId] || signal.modelId}
                    </span>
                    {isUnavailable && (
                      <span title={signal.error || "Model unavailable"}>
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
                            width: `${Math.round(signal.confidence * 100)}%`,
                            backgroundColor: signal.confidence > 0.7 ? TRADING_COLORS.buy : TRADING_COLORS.primaryDark,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-gray-500 w-12 text-right">
                        {signal.predictedChange > 0 ? "+" : ""}{signal.predictedChange.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {isUnavailable && (
                    <span className="text-[10px] text-gray-400">N/A</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <hr className="border my-3" />

        {/* Prediction price range */}
        {currentPrice > 0 && safeSignals.some((s) => s.status !== "unavailable") && (
          <>
            <span className="block text-gray-500 font-semibold text-xs mb-2">Predicted Price Range</span>
            <div className="flex flex-col gap-1.5 mb-1">
              {safeSignals
                .filter((s) => s.status !== "unavailable")
                .map((signal) => {
                  const spread = signal.predictedValue * (1 - signal.confidence) * 0.5;
                  const lower = signal.predictedValue - spread;
                  const upper = signal.predictedValue + spread;
                  const min = Math.min(signal.currentValue, lower);
                  const max = Math.max(signal.currentValue, upper);
                  const range = max - min || 1;
                  const currentPct = ((signal.currentValue - min) / range) * 100;
                  const lowerPct = ((lower - min) / range) * 100;
                  const upperPct = ((upper - min) / range) * 100;

                  return (
                    <div key={signal.modelId} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">
                        {modelNameMap[signal.modelId] || signal.modelId}
                      </span>
                      <div className="flex-1 h-4 relative bg-muted rounded-sm">
                        {/* Range bar */}
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded-sm opacity-60"
                          style={{
                            left: `${lowerPct}%`,
                            width: `${upperPct - lowerPct}%`,
                            backgroundColor:
                              signal.type === "BUY" ? TRADING_COLORS.buy :
                              signal.type === "SELL" ? TRADING_COLORS.sell :
                              TRADING_COLORS.hold,
                          }}
                        />
                        {/* Current price marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                          style={{ left: `${currentPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-32 text-right shrink-0">
                        ${lower.toFixed(2)} — ${upper.toFixed(2)}
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
          aria-label={`Consensus: ${distribution.buy} buy, ${distribution.sell} sell, ${distribution.hold} hold`}
          aria-live="polite"
        >
          <span className="block text-gray-500 font-semibold text-xs mb-1">Consensus Distribution</span>
          <div className="flex h-5 rounded overflow-hidden">
            {buyPct > 0 && (
              <div
                style={{
                  width: `${buyPct}%`,
                  background: TRADING_COLORS.buy,
                }}
                className="flex items-center justify-center text-white text-[10px] font-semibold"
              >
                {distribution.buy > 0 && `${distribution.buy} Buy`}
              </div>
            )}
            {holdPct > 0 && (
              <div
                style={{
                  width: `${holdPct}%`,
                  background: TRADING_COLORS.hold,
                  backgroundImage: "radial-gradient(circle, #94A3B8 1px, transparent 1px)",
                  backgroundSize: "4px 4px",
                }}
                className="flex items-center justify-center text-white text-[10px] font-semibold"
              >
                {distribution.hold > 0 && `${distribution.hold} Hold`}
              </div>
            )}
            {sellPct > 0 && (
              <div
                style={{
                  width: `${sellPct}%`,
                  background: TRADING_COLORS.sell,
                  backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)",
                }}
                className="flex items-center justify-center text-white text-[10px] font-semibold"
              >
                {distribution.sell > 0 && `${distribution.sell} Sell`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
