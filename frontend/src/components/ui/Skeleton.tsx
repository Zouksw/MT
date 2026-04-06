"use client";

import React from "react";
import { Skeleton, Card } from "antd";

/**
 * Skeleton loading states for async content
 *
 * Provides skeleton loaders that match real content layout:
 * - Statistics cards skeleton
 * - Table skeleton
 * - Form skeleton
 * - List skeleton
 */

/**
 * Statistics Card Skeleton - Matches 4-column stats layout
 */
export const StatsCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          variant="borderless"
          style={{
            borderRadius: 4,
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
          }}
        >
          <Skeleton.Input
            active
            style={{ width: 120, height: 24, marginBottom: 12 }}
          />
          <Skeleton.Input
            active
            style={{ width: 80, height: 32, marginBottom: 8 }}
          />
          <Skeleton.Input
            active
            style={{ width: 100, height: 14 }}
          />
        </Card>
      ))}
    </div>
  );
};

/**
 * Table Skeleton - Matches table layout
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 6,
}) => {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 4,
        padding: "16px 20px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton.Input active style={{ width: 200, height: 20 }} />
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: "flex",
            gap: 16,
            padding: "12px 0",
            borderBottom:
              rowIndex < rows - 1 ? "1px solid #F3F4F6" : "none",
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton.Input
              key={colIndex}
              active
              style={{
                width: colIndex === 0 ? 150 : 100,
                height: 20,
                flex: 1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Form Skeleton - Matches form layout
 */
export const FormSkeleton: React.FC<{ fieldCount?: number }> = ({ fieldCount = 4 }) => {
  return (
    <Card
      variant="borderless"
      style={{
        maxWidth: 600,
        borderRadius: 4,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
      }}
    >
      <Skeleton.Input active style={{ width: 200, height: 28, marginBottom: 24 }} />

      {Array.from({ length: fieldCount }).map((_, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <Skeleton.Input
            active
            style={{ width: 120, height: 16, marginBottom: 8 }}
          />
          <Skeleton.Input active style={{ width: "100%", height: 40 }} />
        </div>
      ))}

      <Skeleton.Input
        active
        style={{ width: 120, height: 40, marginTop: 8 }}
      />
    </Card>
  );
};

/**
 * Card List Skeleton - Matches card list layout
 */
export const CardListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          variant="borderless"
          style={{
            borderRadius: 4,
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
          }}
        >
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <Skeleton.Avatar active size={48} shape="square" />
            <div style={{ flex: 1 }}>
              <Skeleton.Input
                active
                style={{ width: 150, height: 20, marginBottom: 8 }}
              />
              <Skeleton.Input
                active
                style={{ width: "80%", height: 14 }}
              />
            </div>
          </div>
          <Skeleton.Input active style={{ width: "100%", height: 60 }} />
        </Card>
      ))}
    </div>
  );
};

/**
 * Detail Page Skeleton - Matches detail page layout
 */
export const DetailPageSkeleton: React.FC = () => {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Skeleton.Input active style={{ width: 200, height: 28, marginBottom: 12 }} />
        <Skeleton.Input active style={{ width: 400, height: 16 }} />
      </div>

      {/* Featured stat */}
      <Card
        variant="borderless"
        style={{
          marginBottom: 24,
          borderRadius: 4,
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
        }}
      >
        <Skeleton.Input active style={{ width: 150, height: 20, marginBottom: 16 }} />
        <Skeleton.Input active style={{ width: 150, height: 36 }} />
      </Card>

      {/* Content sections */}
      <Card
        variant="borderless"
        style={{
          borderRadius: 4,
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
        }}
      >
        <Skeleton.Input active style={{ width: 180, height: 20, marginBottom: 16 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <Skeleton.Input active style={{ width: "100%", height: 16 }} />
          </div>
        ))}
      </Card>
    </div>
  );
};

/**
 * Inline Loading Skeleton - For small content areas
 */
export const InlineSkeleton: React.FC<{ width?: string | number; lines?: number }> = ({
  width = "100%",
  lines = 2,
}) => {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton.Input
          key={i}
          active
          style={{
            width: i === lines - 1 ? "70%" : width,
            height: 16,
            marginBottom: i < lines - 1 ? 8 : 0,
          }}
        />
      ))}
    </div>
  );
};

/**
 * Shimmer animation keyframes
 * Add this to global CSS for shimmer effect
 */
export const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #F3F4F6 0%,
    #E5E7EB 20%,
    #F3F4F6 40%,
    #E5E7EB 60%,
    #F3F4F6 80%,
    #E5E7EB 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
`;

export default StatsCardSkeleton;
