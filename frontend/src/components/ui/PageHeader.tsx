"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  key?: string;
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  showBackButton?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumbs,
  showBackButton = false,
}) => {
  const items = showBackButton
    ? [{ label: "Home", href: "/" }, ...(breadcrumbs || [])]
    : breadcrumbs;

  return (
    <div className="mb-6 animate-[fadeIn_0.3s_ease-out]">
      {items && items.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          {items.map((item, i) => (
            <React.Fragment key={item.key || i}>
              {i > 0 && (
                <ChevronRight className="size-3 text-gray-400" />
              )}
              {item.href ? (
                <a href={item.href} className="hover:text-gray-700 dark:hover:text-gray-200">
                  {item.label}
                </a>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight m-0 mb-2">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground m-0">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="shrink-0 flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
