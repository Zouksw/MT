/**
 * ResponsiveGrid Component
 *
 * Provides consistent responsive grid layouts across the application.
 * Automatically adjusts columns based on breakpoint.
 */

"use client";

import React from "react";
import { useBreakpoint } from "@/lib/responsive-utils";

export interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  minColumnWidth?: number; // px
  gap?: string | number;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className = "",
  minColumnWidth: _minColumnWidth = 300,
  gap = "16px",
  columns = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
}) => {
  const breakpoint = useBreakpoint();

  // Calculate columns based on breakpoint
  const getColumns = () => {
    switch (breakpoint) {
      case "xs":
      case "sm":
        return columns.mobile || 1;
      case "md":
        return columns.tablet || 2;
      case "lg":
      case "xl":
      case "2xl":
        return columns.desktop || 3;
      default:
        return 1;
    }
  };

  const columnCount = getColumns();
  const gapValue = typeof gap === "number" ? `${gap}px` : gap;

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: gapValue,
      }}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveContainer Component
 *
 * Provides responsive container with max-width
 */
export interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
  padding?: string | number;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = "",
  maxWidth = "1280px",
  padding = "16px",
}) => {
  const paddingValue = typeof padding === "number" ? `${padding}px` : padding;

  return (
    <div
      className={className}
      style={{
        maxWidth,
        margin: "0 auto",
        padding: paddingValue,
        width: "100%",
      }}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveStack Component
 *
 * Stacks children vertically on mobile, horizontally on desktop
 */
export interface ResponsiveStackProps {
  children: React.ReactNode;
  className?: string;
  direction?: {
    mobile?: "column" | "row";
    desktop?: "column" | "row";
  };
  gap?: string | number;
  align?: "start" | "center" | "end" | "stretch";
}

export const ResponsiveStack: React.FC<ResponsiveStackProps> = ({
  children,
  className = "",
  direction = {
    mobile: "column",
    desktop: "row",
  },
  gap = "16px",
  align = "start",
}) => {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "xs" || breakpoint === "sm";

  const currentDirection = isMobile ? direction.mobile : direction.desktop;
  const gapValue = typeof gap === "number" ? `${gap}px` : gap;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: currentDirection,
        gap: gapValue,
        alignItems: align === "stretch" ? "stretch" : `flex-${align}`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * ResponsiveText Component
 *
 * Adjusts text size based on breakpoint
 */
export interface ResponsiveTextProps {
  children: React.ReactNode;
  className?: string;
  size?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  weight?: {
    mobile?: string | number;
    desktop?: string | number;
  };
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  className = "",
  size = {
    mobile: "14px",
    tablet: "16px",
    desktop: "18px",
  },
  weight = {
    mobile: 400,
    desktop: 500,
  },
}) => {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "xs" || breakpoint === "sm";

  const currentSize = isMobile ? size.mobile : breakpoint === "md" ? size.tablet : size.desktop;
  const currentWeight = isMobile ? weight.mobile : weight.desktop;

  return (
    <span
      className={className}
      style={{
        fontSize: currentSize,
        fontWeight: currentWeight,
      }}
    >
      {children}
    </span>
  );
};
