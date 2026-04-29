"use client";

import type React from "react";

export interface ContentCardProps {
  className?: string;
  title?: string;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  loading?: boolean;
  hoverable?: boolean;
  accent?: boolean;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = "",
  accent = false,
  style,
}) => {
  return (
    <div
      className={`bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] mb-6 transition-shadow duration-200 ${accent ? "border-t-2 border-t-primary" : ""} ${className}`}
      style={style}
    >
      {(title || actions) && (
        <div className="flex justify-between items-center gap-4 p-6 pb-0">
          <div>
            {title && (
              <div className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#171717] dark:bg-gray-400 flex-shrink-0" />
                {title}
              </div>
            )}
            {subtitle && (
              <div className="text-sm text-muted-foreground mt-1">
                {subtitle}
              </div>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export default ContentCard;
