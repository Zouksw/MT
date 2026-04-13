"use client";

import { Card, CardProps } from "antd";
import React from "react";

interface GlassCardProps extends CardProps {
  /**
   * @deprecated No longer used. Kept for backward compatibility.
   * @default "medium"
   */
  intensity?: "light" | "medium" | "heavy";
  /**
   * @deprecated No longer used. Kept for backward compatibility.
   * @default 1
   */
  depth?: 1 | 2 | 3;
}

/**
 * GlassCard - A card component using Vercel shadow-as-border style
 *
 * Solid backgrounds with layered box-shadows to create a subtle
 * border-like outline without any CSS border property.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = "",
  style,
  ...props
}) => {
  const classes = [
    "rounded-lg overflow-hidden bg-white dark:bg-gray-900",
    "shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]",
    "dark:shadow-[rgba(0,0,0,0.3)_0px_0px_0px_1px,rgba(0,0,0,0.2)_0px_2px_2px]",
    "transition-shadow duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
    "hover:shadow-[rgba(0,0,0,0.12)_0px_0px_0px_1px,rgba(0,0,0,0.06)_0px_2px_4px,rgba(0,0,0,0.06)_0px_12px_12px_-8px,#fafafa_0px_0px_0px_1px]",
    "dark:hover:shadow-[rgba(0,0,0,0.4)_0px_0px_0px_1px,rgba(0,0,0,0.3)_0px_4px_4px]",
    className,
  ].join(" ");

  return (
    <Card className={classes} style={style} variant="borderless" {...props}>
      {children}
    </Card>
  );
};

export default GlassCard;
