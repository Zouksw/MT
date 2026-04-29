"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import PortfolioSummary from "@/components/trading/PortfolioSummary";

export default function PortfolioPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Analysis Groups"
        description="Track related commodities and compare trends across groups"
      />
      <PortfolioSummary />
    </PageContainer>
  );
}
