"use client";

import React from "react";
import { Card, theme } from "antd";

export interface ContentCardProps {
  className?: string;
  title?: string;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  loading?: boolean;
  hoverable?: boolean;
  /** Show a gradient accent strip at the top of the card */
  accent?: boolean;
}

/**
 * ContentCard - Card with consistent styling
 *
 * Provides a standardized card component with:
 * - 8px border radius
 * - Subtle shadow
 * - Optional title with colored dot prefix
 * - Optional header actions
 * - Optional gradient accent strip at top
 * - Loading state support
 */
export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = "",
  accent = false,
  ...props
}) => {
  const { token } = theme.useToken();

  const cardStyle: React.CSSProperties = {
    borderRadius: 8,
    boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 2px 2px",
    marginBottom: token.marginLG,
    transition: "box-shadow 0.2s ease",
  };

  const header = title || actions ? (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: token.marginMD,
      }}
    >
      <div>
        {title && (
          <div
            style={{
              fontSize: token.fontSizeLG,
              fontWeight: 600,
              color: token.colorText,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* Colored dot prefix */}
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#171717",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            {title}
          </div>
        )}
        {subtitle && (
          <div
            style={{
              fontSize: token.fontSizeSM,
              color: token.colorTextSecondary,
              marginTop: token.marginXS,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  ) : undefined;

  return (
    <Card
      className={`content-card ${accent ? "content-card--accent" : ""} ${className}`}
      style={cardStyle}
      title={header}
      variant="borderless"
      {...props}
    >
      {children}
    </Card>
  );
};

export default ContentCard;
