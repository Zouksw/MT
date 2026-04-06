"use client";

import { Card, CardProps } from "antd";
import React from "react";

interface GlassCardProps extends CardProps {
  /**
   * The intensity of the glassmorphism effect
   * @default "medium"
   */
  intensity?: "light" | "medium" | "heavy";
  /**
   * Shadow depth level (1-3). Higher = deeper shadow.
   * @default 1
   */
  depth?: 1 | 2 | 3;
}

const blurMap = {
  light: "backdrop-blur-[10px]",
  medium: "backdrop-blur-[16px]",
  heavy: "backdrop-blur-[20px]",
};

const bgMapLight = {
  light: "bg-white/80",
  medium: "bg-white/70",
  heavy: "bg-white/60",
};

const bgMapDark = {
  light: "bg-slate-700/80",
  medium: "bg-slate-700/70",
  heavy: "bg-slate-700/60",
};

const depthShadows = {
  1: "shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
  2: "shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
  3: "shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
};

/**
 * GlassCard - A card component with subtle glassmorphism effect
 *
 * Uses Tailwind dark: variants instead of MutationObserver for dark mode.
 *
 * NOTE: Use sparingly. For most cases, use Ant Design Card with
 * variant="borderless" instead. GlassCard is best for hero sections
 * or special emphasis areas where visual distinction is needed.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  intensity = "medium",
  depth = 1,
  children,
  className = "",
  style,
  ...props
}) => {
  const classes = [
    "glass-card",
    `glass-card--${intensity}`,
    "rounded-lg overflow-hidden border",
    "border-black/[0.06] dark:border-white/10",
    bgMapLight[intensity],
    bgMapDark[intensity],
    blurMap[intensity],
    depthShadows[depth],
    "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
    className,
  ].join(" ");

  return (
    <Card className={classes} style={style} variant="borderless" {...props}>
      {children}
    </Card>
  );
};

export default GlassCard;
