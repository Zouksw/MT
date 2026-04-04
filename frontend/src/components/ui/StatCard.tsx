"use client";

import React from "react";
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
  variant?: StatCardVariant;
  loading?: boolean;
  onClick?: () => void;
}

/**
 * StatCard - Enhanced statistics display with variants
 *
 * Provides a standardized statistics card with:
 * - Icon support
 * - Trend indicator
 * - Color variants for visual distinction
 * - Loading state
 * - Optional click handler
 * - Consistent sizing and spacing
 */
export const StatCard = React.memo<StatCardProps>(({
  title,
  value,
  icon,
  trend,
  variant = "default",
  loading = false,
  onClick,
}) => {
  // Define variant colors using design system
  const variantColors: Record<
    StatCardVariant,
    { border: string; text: string; bgLight: string }
  > = {
    default: {
      border: "#E2E8F0",
      text: "#475569",
      bgLight: "#F1F5F9",
    },
    primary: {
      border: "#0066CC",
      text: "#0066CC",
      bgLight: "#EEF2FF",
    },
    success: {
      border: "#10B981",
      text: "#10B981",
      bgLight: "#D1FAE5",
    },
    warning: {
      border: "#F59E0B",
      text: "#D97706",
      bgLight: "#FEF3C7",
    },
    error: {
      border: "#EF4444",
      text: "#EF4444",
      bgLight: "#FEE2E2",
    },
  };

  const colors = variantColors[variant];

  const cardStyle: React.CSSProperties = {
    borderRadius: 8,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
    borderLeft: `3px solid ${colors.border}`,
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.15s ease-move",
    height: "100%",
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    color: colors.text,
    margin: 0,
    lineHeight: 1.2,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: 500,
  };

  const iconStyle: React.CSSProperties = {
    color: "#64748B",
    fontSize: 18,
  };

  return (
    <Card
      className={`stat-card stat-card--${variant} hover:-translate-y-0.5 hover:shadow-card-hover`}
      style={cardStyle}
      loading={loading}
      variant="borderless"
      onClick={onClick}
      hoverable={!!onClick}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon && <span style={iconStyle}>{icon}</span>}
          <span style={titleStyle}>{title}</span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{...valueStyle}} className="data-text">{value}</span>

          {trend && (
            <Space size={4}>
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
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  return (
    prevProps.title === nextProps.title &&
    prevProps.value === nextProps.value &&
    prevProps.trend?.value === nextProps.trend?.value &&
    prevProps.trend?.isPositive === nextProps.trend?.isPositive &&
    prevProps.variant === nextProps.variant &&
    prevProps.loading === nextProps.loading
  );
});
StatCard.displayName = 'StatCard';

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

  if (value === 0) {
    return <MinusOutlined style={style} />;
  }

  if (isPositive) {
    return <ArrowUpOutlined style={style} />;
  }

  return <ArrowDownOutlined style={style} />;
};

export default StatCard;
