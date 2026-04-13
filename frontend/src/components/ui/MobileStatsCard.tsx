/**
 * Mobile Statistics Card
 *
 * Horizontal scrolling statistics cards for mobile devices.
 * Provides better mobile UX than stacked columns.
 */

"use client";

import React from "react";
import { Card, Col, Row } from "antd";

export interface MobileStatItem {
  label: string;
  value: string | number;
  trend?: number;
  suffix?: string;
  color?: string;
}

export interface MobileStatsCardProps {
  items: MobileStatItem[];
  featuredIndex?: number; // Index of featured item (shows larger)
}

/**
 * MobileStatsCard Component
 *
 * Horizontal scrolling stats container for mobile.
 * Desktop: Shows as grid (degrades gracefully).
 *
 * @example
 * <MobileStatsCard
 *   items={[
 *     { label: "Total", value: 1234, trend: 12 },
 *     { label: "Active", value: 567 },
 *   ]}
 *   featuredIndex={0}
 * />
 */
export const MobileStatsCard: React.FC<MobileStatsCardProps> = ({
  items,
  featuredIndex = 0
}) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        overflowX: "auto",
        overflowY: "visible",
        padding: "4px 4px 16px 4px", // Bottom padding for scrollbar/shadow
        margin: "-4px", // Negative margin to offset padding
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        // Hide scrollbar but keep functionality
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="mobile-stats-scroll"
    >
      {items.map((item, index) => {
        const isFeatured = index === featuredIndex;

        return (
          <div
            key={index}
            style={{
              flex: isFeatured ? "0 0 280px" : "0 0 200px",
              minWidth: isFeatured ? 280 : 200,
              scrollSnapAlign: "start",
            }}
          >
            <Card
              variant="borderless"
              style={{
                borderRadius: 4,
                padding: isFeatured ? "20px" : "16px",
                height: "100%",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
              styles={{ body: { padding: 0 } }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                }}
              >
                {/* Label */}
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#6B7280",
                    marginBottom: isFeatured ? "12px" : "8px",
                  }}
                >
                  {item.label}
                </div>

                {/* Value */}
                <div
                  style={{
                    fontSize: isFeatured ? "32px" : "24px",
                    fontWeight: 600,
                    color: item.color || "#111827",
                    lineHeight: 1,
                    marginBottom: isFeatured ? "12px" : "8px",
                  }}
                >
                  {typeof item.value === "number"
                    ? item.value.toLocaleString()
                    : item.value}
                  {item.suffix && (
                    <span
                      style={{
                        fontSize: isFeatured ? "18px" : "14px",
                        fontWeight: 500,
                        marginLeft: "4px",
                      }}
                    >
                      {item.suffix}
                    </span>
                  )}
                </div>

                {/* Trend */}
                {item.trend !== undefined && (
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: item.trend >= 0 ? "#10B981" : "#EF4444",
                    }}
                  >
                    {item.trend >= 0 ? "↑" : "↓"} {Math.abs(item.trend)}%
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
};

/**
 * DesktopGridStats - Grid layout for desktop
 *
 * @example
 * <DesktopGridStats
 *   items={items}
 *   featuredIndex={0}
 *   columns={{ featured: 12, standard: 6 }}
 * />
 */
export interface DesktopGridStatsProps {
  items: MobileStatItem[];
  featuredIndex?: number;
  columns?: {
    featured: number;
    standard: number;
  };
}

export const DesktopGridStats: React.FC<DesktopGridStatsProps> = ({
  items,
  featuredIndex = 0,
  columns = { featured: 12, standard: 6 }
}) => {
  return (
    <Row gutter={[16, 16]}>
      {items.map((item, index) => {
        const isFeatured = index === featuredIndex;
        const colSpan = isFeatured ? columns.featured : columns.standard;

        return (
          <Col xs={24} sm={12} md={colSpan} key={index}>
            <Card
              variant="borderless"
              style={{
                borderRadius: 4,
                padding: isFeatured ? "24px" : "20px",
                height: "100%",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
              styles={{ body: { padding: 0 } }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                }}
              >
                {/* Label */}
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#6B7280",
                    marginBottom: isFeatured ? "12px" : "8px",
                  }}
                >
                  {item.label}
                </div>

                {/* Value */}
                <div
                  style={{
                    fontSize: isFeatured ? "36px" : "28px",
                    fontWeight: 600,
                    color: item.color || "#111827",
                    lineHeight: 1,
                    marginBottom: isFeatured ? "12px" : "8px",
                  }}
                >
                  {typeof item.value === "number"
                    ? item.value.toLocaleString()
                    : item.value}
                  {item.suffix && (
                    <span
                      style={{
                        fontSize: isFeatured ? "20px" : "16px",
                        fontWeight: 500,
                        marginLeft: "4px",
                      }}
                    >
                      {item.suffix}
                    </span>
                  )}
                </div>

                {/* Trend */}
                {item.trend !== undefined && (
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: item.trend >= 0 ? "#10B981" : "#EF4444",
                    }}
                  >
                    {item.trend >= 0 ? "↑" : "↓"} {Math.abs(item.trend)}%
                  </div>
                )}
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

/**
 * ResponsiveStats - Automatically switches between mobile and desktop layouts
 */
export interface ResponsiveStatsProps extends DesktopGridStatsProps {
  isMobile?: boolean;
}

export const ResponsiveStats: React.FC<ResponsiveStatsProps> = ({
  isMobile = false,
  ...props
}) => {
  if (isMobile) {
    return <MobileStatsCard {...props} />;
  }
  return <DesktopGridStats {...props} />;
};
