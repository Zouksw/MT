"use client";

import React from "react";
import { Typography, Breadcrumb } from "antd";
import type { BreadcrumbProps } from "antd";
import { HomeOutlined, RightOutlined } from "@ant-design/icons";
import { theme } from "antd";

const { Title, Text } = Typography;

export interface BreadcrumbItem {
  key: string;
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbProps["items"];
  showBackButton?: boolean;
}

/**
 * PageHeader - Consistent page headers with title, description, and actions
 *
 * Provides a standardized header for pages with:
 * - Page title using Outfit display font
 * - Optional description
 * - Optional action buttons
 * - Optional breadcrumbs with chevron separator
 * - Gradient bottom border
 * - Fade-in animation on mount
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumbs,
  showBackButton = false,
}) => {
  const { token } = theme.useToken();

  const headerStyle: React.CSSProperties = {
    marginBottom: token.marginLG,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading3,
    fontWeight: 700,
    lineHeight: 1.25,
    color: token.colorText,
    margin: "0 0 8px 0",
    fontFamily: "var(--font-outfit), sans-serif",
    letterSpacing: "-0.02em",
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: token.fontSizeSM,
    color: token.colorTextSecondary,
    margin: 0,
  };

  const breadcrumbItems = showBackButton
    ? [
        {
          title: (
            <span style={{ display: "flex", alignItems: "center" }}>
              <HomeOutlined />
            </span>
          ),
          href: "/",
        },
        ...(breadcrumbs || []),
      ]
    : breadcrumbs;

  return (
    <div className="page-header page-transition-fade-in" style={headerStyle}>
      {breadcrumbItems && breadcrumbItems.length > 0 && (
        <Breadcrumb
          items={breadcrumbItems}
          separator={<RightOutlined style={{ fontSize: 10, color: "#94A3B8" }} />}
          style={{ marginBottom: token.marginMD }}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: actions ? "flex-start" : "flex-start",
          gap: token.marginMD,
        }}
      >
        <div style={{ flex: 1 }}>
          <Title style={titleStyle}>{title}</Title>
          {description && (
            <Text style={descriptionStyle}>{description}</Text>
          )}
        </div>
        {actions && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: token.marginSM,
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
