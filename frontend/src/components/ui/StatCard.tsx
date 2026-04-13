"use client";

import React, { useRef, useEffect, useState } from "react";
import { Card, Space } from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from "@ant-design/icons";

export interface TrendIndicator {
  value: number;
  isPositive: boolean;
}

export type StatCardVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error";

export interface StatCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: TrendIndicator;
  /** Sparkline data — an array of numbers. Renders a tiny trend line below the value. */
  sparklineData?: number[];
  variant?: StatCardVariant;
  loading?: boolean;
  onClick?: () => void;
}

// --- Animated counter hook ---
function useAnimatedCounter(target: number, duration = 800) {
  const [display, setDisplay] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return target;
    }
    return 0;
  });
  const prevTarget = useRef(target);

  useEffect(() => {
    // Skip animation if reduced motion is preferred
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      prevTarget.current = target;
      return;
    }

    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        prevTarget.current = target;
      }
    }

    requestAnimationFrame(step);
  }, [target, duration]);

  return display;
}

// --- Sparkline renderer (tiny SVG, no axes/labels) ---

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pathRef = useRef<SVGPathElement>(null);

  if (data.length < 2) return null;

  const W = 80;
  const H = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 4) - 2,
  }));

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  // Calculate total path length for stroke-dashoffset animation
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="mt-1"
      style={{ overflow: "visible" }}
    >
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLength}
        strokeDashoffset={totalLength}
        style={{
          animation: "sparkline-draw 0.8s ease-out forwards",
        }}
      />
      {/* Glow dot at the end - pulses subtly */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={color}
        opacity={0}
        style={{ animation: "sparkline-dot 0.3s ease-out 0.7s forwards" }}
      />
    </svg>
  );
}

// --- Variant colors ---

const variantColors: Record<
  StatCardVariant,
  { text: string; bgLight: string }
> = {
  default: { text: "#475569", bgLight: "#F1F5F9" },
  primary: { text: "#0a72ef", bgLight: "#EEF2FF" },
  success: { text: "#10B981", bgLight: "#D1FAE5" },
  warning: { text: "#D97706", bgLight: "#FEF3C7" },
  error: { text: "#EF4444", bgLight: "#FEE2E2" },
};

// --- Main StatCard ---

export const StatCard = React.memo<StatCardProps>(
  ({
    title,
    value,
    icon,
    trend,
    sparklineData,
    variant = "default",
    loading = false,
    onClick,
  }) => {
    const colors = variantColors[variant];
    const numericValue = typeof value === "number" ? value : 0;
    const animatedValue = useAnimatedCounter(numericValue);
    const displayValue = typeof value === "number" ? animatedValue : value;

    return (
      <>
        <Card
          className={`stat-card stat-card--${variant}`}
          style={{
            borderRadius: 8,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
            cursor: onClick ? "pointer" : "default",
            height: "100%",
          }}
          loading={loading}
          variant="borderless"
          onClick={onClick}
          hoverable={!!onClick}
        >
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {icon && (
                <span
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    transition: "transform 0.2s ease",
                  }}
                  className="stat-card-icon"
                >
                  {icon}
                </span>
              )}
              <span
                style={{
                  fontSize: 14,
                  color: "#64748B",
                  marginBottom: 0,
                  fontWeight: 500,
                }}
              >
                {title}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <div>
                <span
                  className="data-text"
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: colors.text,
                    lineHeight: 1.2,
                    display: "block",
                  }}
                >
                  {displayValue}
                </span>

                {/* Sparkline */}
                {sparklineData && sparklineData.length >= 2 && (
                  <Sparkline data={sparklineData} color={colors.text} />
                )}
              </div>

              {trend && (
                <Space size={4} style={{ marginBottom: 4 }}>
                  <TrendIcon
                    value={trend.value}
                    isPositive={trend.isPositive}
                    color={colors.text}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      color: trend.isPositive ? "#10B981" : "#EF4444",
                      fontWeight: 500,
                    }}
                  >
                    {trend.isPositive ? "+" : ""}
                    {trend.value}%
                  </span>
                </Space>
              )}
            </div>
          </Space>
        </Card>

        {/* Sparkline animation keyframes — injected once */}
        <style>{`
          @keyframes sparkline-draw {
            to { stroke-dashoffset: 0; }
          }
          @keyframes sparkline-dot {
            to { opacity: 1; }
          }
          .stat-card:hover .stat-card-icon {
            transform: scale(1.1);
          }
          .stat-card:hover {
            transform: scale(1.02) translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
          }
        `}</style>
      </>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.title === nextProps.title &&
      prevProps.value === nextProps.value &&
      prevProps.trend?.value === nextProps.trend?.value &&
      prevProps.trend?.isPositive === nextProps.trend?.isPositive &&
      prevProps.variant === nextProps.variant &&
      prevProps.loading === nextProps.loading &&
      prevProps.sparklineData?.length === nextProps.sparklineData?.length
    );
  }
);
StatCard.displayName = "StatCard";

// --- Trend Icon ---

interface TrendIconProps {
  value: number;
  isPositive: boolean;
  color: string;
}

const TrendIcon: React.FC<TrendIconProps> = ({ value, isPositive, color }) => {
  const style: React.CSSProperties = {
    color: isPositive && value > 0 ? color : undefined,
    fontSize: 12,
  };

  if (value === 0) return <MinusOutlined style={style} />;
  if (isPositive) return <ArrowUpOutlined style={style} />;
  return <ArrowDownOutlined style={style} />;
};

export default StatCard;
