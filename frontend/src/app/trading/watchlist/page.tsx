"use client";

import React from "react";
import { ConfigProvider, Typography } from "antd";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import WatchlistPanel from "@/components/trading/WatchlistPanel";

export default function WatchlistPage() {
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
          title="Watchlists"
          description="Track your favorite commodities and monitor price changes"
        />
        <WatchlistPanel />
      </PageContainer>
    </ConfigProvider>
  );
}
