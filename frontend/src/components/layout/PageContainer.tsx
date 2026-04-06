"use client";

import React from "react";
import { theme } from "antd";
import { PageTransition } from "@/components/ui/PageTransition";

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageContainer - Consistent page wrapper with spacing
 *
 * Provides:
 * - Responsive padding
 * - Background color from Ant Design theme
 * - Max-width constraint for ultrawide monitors (1440px)
 * - Subtle dot pattern in light mode
 * - Automatic slide-up page transition animation
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = "",
}) => {
  const { token } = theme.useToken();

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: token.colorBgLayout,
    padding: token.paddingLG,
  };

  return (
    <div className={`page-container bg-pattern-dots ${className}`} style={containerStyle}>
      <PageTransition variant="slide-up">
        <div className="mx-auto max-w-[1440px]">
          {children}
        </div>
      </PageTransition>
    </div>
  );
};

export default PageContainer;
