"use client";

import React from "react";
import { ConfigProvider } from "antd";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import PortfolioSummary from "@/components/trading/PortfolioSummary";

export default function PortfolioPage() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#F59E0B",
          colorPrimaryBg: "#FEF3C7",
          colorPrimaryBgHover: "#FDE68A",
        },
      }}
    >
      <PageContainer>
        <PageHeader
          title="Analysis Groups"
          description="Track related commodities and compare trends across groups"
        />
        <PortfolioSummary />
      </PageContainer>
    </ConfigProvider>
  );
}
