"use client";

import type React from "react";

interface GlassCardProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  loading?: boolean;
  hoverable?: boolean;
  styles?: { body?: React.CSSProperties };
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", style, title, extra, loading, styles }) => {
  const shadowClasses = [
    "rounded-lg overflow-hidden bg-white dark:bg-[#171717]",
    "shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)]",
    "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.2)]",
    "transition-shadow duration-200",
    "hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.08)]",
    "dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.3)]",
  ].join(" ");

  return (
    <div className={`${shadowClasses} ${className}`} style={style}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200/60 dark:border-white/[0.08]">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          {extra}
        </div>
      )}
      <div style={styles?.body} className={title ? "p-5" : "p-5"}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : children}
      </div>
    </div>
  );
};

export default GlassCard;
