"use client";

import React from "react";
import { Row, Col } from "antd";
import { StatCard, StatCardVariant } from "@/components/ui/StatCard";
import { ResponsiveStats } from "@/components/ui/MobileStatsCard";
import { useIsMobile } from "@/lib/responsive-utils";

export interface DataPageStatsItem {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: string;
  trend?: number;
  variant?: StatCardVariant;
}

export interface DataPageStatsProps {
  items: DataPageStatsItem[];
  /** Index of the featured/primary stat */
  featuredIndex?: number;
  loading?: boolean;
}

/**
 * DataPageStats - Unified statistics row for data pages
 *
 * Renders StatCard on desktop, ResponsiveStats on mobile.
 * Applies stagger animation for a polished entrance.
 * Used across alerts, forecasts, timeseries, anomalies, datasets pages.
 */
export const DataPageStats: React.FC<DataPageStatsProps> = ({
  items,
  featuredIndex = 0,
  loading = false,
}) => {
  const isMobile = useIsMobile();

  // Mobile: use ResponsiveStats for horizontal scroll
  if (isMobile) {
    return (
      <div style={{ marginBottom: 16 }}>
        <ResponsiveStats
          isMobile={true}
          items={items.map((item, i) => ({
            label: item.label,
            value: item.value,
            color: item.color,
            trend: item.trend,
          }))}
          featuredIndex={featuredIndex}
        />
      </div>
    );
  }

  // Desktop: grid of StatCards with stagger
  return (
    <Row
      gutter={[16, 16]}
      style={{ marginBottom: 24 }}
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((item, index) => {
        const variant = item.variant || (
          index === featuredIndex ? "primary" as StatCardVariant : "default" as StatCardVariant
        );

        return (
          <Col xs={12} sm={12} md={6} key={index}>
            <div
              className="stagger-slide-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <StatCard
                title={item.label}
                value={item.value}
                icon={item.icon}
                variant={variant}
                loading={loading}
                trend={
                  item.trend !== undefined
                    ? { value: Math.abs(item.trend), isPositive: item.trend >= 0 }
                    : undefined
                }
              />
            </div>
          </Col>
        );
      })}
    </Row>
  );
};

export default DataPageStats;
