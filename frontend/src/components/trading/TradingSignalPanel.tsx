"use client";

import React from "react";
import { Card, Space, Divider, Row, Col, Typography, Progress, Skeleton, Empty, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import SignalBadge from "./SignalBadge";
import { TRADING_COLORS } from "@/lib/trading-chart-config";

const { Text } = Typography;

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
  /** Consensus signal type */
  consensusType: "BUY" | "SELL" | "HOLD";
  /** Overall confidence 0-1 */
  confidence: number;
  /** Number of models agreeing on consensus */
  modelsAgree: number;
  /** Total models evaluated */
  totalModels: number;
  /** Per-model signals */
  individualSignals: ModelSignal[];
  /** Predicted direction % */
  predictedDirection: number;
  /** Support price level */
  supportLevel: number;
  /** Resistance price level */
  resistanceLevel: number;
  /** Distribution counts */
  distribution: { buy: number; sell: number; hold: number };
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

/**
 * Trading Signal Panel with per-model breakdown and consensus bar.
 * Accessible: symbols + colors + left-border patterns for WCAG 2.1.
 */
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
  loading = false,
}: TradingSignalPanelProps) {
  if (loading) {
    return (
      <Card title="Signal Analysis" style={{ marginBottom: 16 }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (!individualSignals.length) {
    return (
      <Card title="Signal Analysis" style={{ marginBottom: 16 }}>
        <Empty description="No signals available" />
      </Card>
    );
  }

  const availableCount = individualSignals.filter((s) => s.status !== "unavailable").length;

  // All models failed
  if (availableCount === 0) {
    return (
      <Card
        title="Signal Analysis"
        style={{ marginBottom: 16, borderColor: TRADING_COLORS.primary }}
      >
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text type="secondary">No signals available</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Last attempted: {new Date().toLocaleTimeString()}
          </Text>
        </div>
      </Card>
    );
  }

  // Consensus bar percentages
  const buyPct = totalModels > 0 ? (distribution.buy / totalModels) * 100 : 0;
  const sellPct = totalModels > 0 ? (distribution.sell / totalModels) * 100 : 0;
  const holdPct = totalModels > 0 ? (distribution.hold / totalModels) * 100 : 0;

  return (
    <Card title="Signal Analysis" style={{ marginBottom: 16 }}>
      {/* Consensus badge */}
      <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
        <SignalBadge type={consensusType} confidence={confidence} size="large" />
      </div>

      <Divider style={{ margin: "4px 0 12px" }} />

      {/* Key stats */}
      <Row gutter={8}>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>Models Agree</Text>
          <br />
          <Text strong style={{ fontFamily: "monospace" }}>
            {modelsAgree}/{totalModels}
          </Text>
        </Col>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>Direction</Text>
          <br />
          <Text
            strong
            style={{
              fontFamily: "monospace",
              color: predictedDirection > 0 ? TRADING_COLORS.buy : predictedDirection < 0 ? TRADING_COLORS.sell : undefined,
            }}
          >
            {predictedDirection > 0 ? "+" : ""}{predictedDirection}%
          </Text>
        </Col>
      </Row>

      <Divider style={{ margin: "12px 0" }} />

      <Row gutter={8}>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>Support</Text>
          <br />
          <Text strong style={{ fontFamily: "monospace", color: TRADING_COLORS.supportLine }}>
            ${supportLevel?.toFixed(2)}
          </Text>
        </Col>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>Resistance</Text>
          <br />
          <Text strong style={{ fontFamily: "monospace", color: TRADING_COLORS.resistanceLine }}>
            ${resistanceLevel?.toFixed(2)}
          </Text>
        </Col>
      </Row>

      <Divider style={{ margin: "12px 0 8px" }} />

      {/* Per-model breakdown */}
      <div style={{ fontSize: 12 }}>
        <Text type="secondary" strong style={{ marginBottom: 4, display: "block" }}>
          Per-Model Breakdown
        </Text>
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          {individualSignals.map((signal) => {
            const style = signalSymbols[signal.type] || signalSymbols.HOLD;
            const isUnavailable = signal.status === "unavailable";

            return (
              <div
                key={signal.modelId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  borderLeft: isUnavailable ? "4px dashed #D1D5DB" : style.border,
                  borderRadius: "0 4px 4px 0",
                  background: isUnavailable ? "#F9FAFB" : undefined,
                  opacity: isUnavailable ? 0.6 : 1,
                }}
                role="status"
                aria-label={`${modelNameMap[signal.modelId] || signal.modelId}: ${isUnavailable ? "unavailable" : signal.type} signal, confidence ${Math.round(signal.confidence * 100)}%`}
              >
                <span>
                  <Text
                    strong
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: isUnavailable ? "#9CA3AF" : style.color,
                    }}
                  >
                    {style.symbol} {modelNameMap[signal.modelId] || signal.modelId}
                  </Text>
                  {isUnavailable && (
                    <Tooltip title={signal.error || "Model unavailable"}>
                      <InfoCircleOutlined style={{ marginLeft: 4, color: "#9CA3AF", fontSize: 10 }} />
                    </Tooltip>
                  )}
                </span>
                {!isUnavailable && (
                  <Progress
                    percent={Math.round(signal.confidence * 100)}
                    size="small"
                    style={{ width: 80, fontSize: 10 }}
                    strokeColor={signal.confidence > 0.7 ? TRADING_COLORS.buy : TRADING_COLORS.primaryDark}
                    format={(_pct) => (
                      <span style={{ fontSize: 10 }}>
                        {signal.predictedChange > 0 ? "+" : ""}
                        {signal.predictedChange.toFixed(1)}%
                      </span>
                    )}
                  />
                )}
                {isUnavailable && (
                  <Text style={{ fontSize: 10, color: "#9CA3AF" }}>N/A</Text>
                )}
              </div>
            );
          })}
        </Space>
      </div>

      <Divider style={{ margin: "12px 0 8px" }} />

      {/* Consensus distribution bar */}
      <div
        role="status"
        aria-label={`Consensus: ${distribution.buy} buy, ${distribution.sell} sell, ${distribution.hold} hold`}
        aria-live="polite"
      >
        <Text type="secondary" strong style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
          Consensus Distribution
        </Text>
        <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden" }}>
          {buyPct > 0 && (
            <div
              style={{
                width: `${buyPct}%`,
                background: TRADING_COLORS.buy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 10,
                fontWeight: 600,
              }}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 10,
                fontWeight: 600,
              }}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {distribution.sell > 0 && `${distribution.sell} Sell`}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
