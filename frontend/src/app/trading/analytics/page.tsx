"use client";

import React from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useSimAccounts } from "@/lib/simulation";
import useSWR from "swr";
import { fetcher } from "@/lib/market-data";

export default function AnalyticsPage() {
  const { accounts } = useSimAccounts();

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="Risk metrics, seasonality, and performance analysis"
      />

      {accounts.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <BarChart3 className="size-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Create a backtest account first to see analytics</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <RiskDashboard accounts={accounts} />
      )}
    </PageContainer>
  );
}

function RiskDashboard({ accounts }: { accounts: Array<{ id: string; name: string }> }) {
  const [selectedId, setSelectedId] = React.useState(accounts[0]?.id);

  const { data, isLoading } = useSWR<{ success: boolean; data: { risk: {
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    var95: number;
    var99: number;
    calmar: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgTrade: number;
    annualizedReturn: number;
  } } }>(
    selectedId ? `/analytics/risk/${selectedId}` : null,
    fetcher,
  );

  const risk = data?.data?.risk;

  return (
    <div className="space-y-4">
      <Select
        value={selectedId}
        onChange={setSelectedId}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        className="w-64"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : risk ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <StatCard title="Sharpe Ratio" value={risk.sharpe.toFixed(2)} color={risk.sharpe > 1 ? "green" : risk.sharpe > 0 ? "amber" : "red"} />
          <StatCard title="Sortino Ratio" value={risk.sortino.toFixed(2)} color={risk.sortino > 1 ? "green" : risk.sortino > 0 ? "amber" : "red"} />
          <StatCard title="Max Drawdown" value={`${(risk.maxDrawdown * 100).toFixed(2)}%`} color="red" />
          <StatCard title="VaR (95%)" value={`${(risk.var95 * 100).toFixed(2)}%`} color="red" />
          <StatCard title="Win Rate" value={`${(risk.winRate * 100).toFixed(1)}%`} color={risk.winRate > 0.5 ? "green" : "red"} />
          <StatCard title="Profit Factor" value={risk.profitFactor.toFixed(2)} color={risk.profitFactor > 1 ? "green" : "red"} />
          <StatCard
            title="Annualized Return"
            value={`${(risk.annualizedReturn * 100).toFixed(2)}%`}
            color={risk.annualizedReturn >= 0 ? "green" : "red"}
            prefix={risk.annualizedReturn >= 0 ? "↑" : "↓"}
          />
          <StatCard title="Total Trades" value={String(risk.totalTrades)} color="default" />
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <BarChart3 className="size-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-gray-500">No risk data — place some trades first</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, color, prefix }: { title: string; value: string; color: string; prefix?: string }) {
  const colorMap: Record<string, string> = {
    green: "#22c55e",
    amber: "#f59e0b",
    red: "#ef4444",
    default: "inherit",
  };
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-gray-500 mb-1">{title}</p>
        <p className="text-lg font-semibold font-mono" style={{ color: colorMap[color] || "inherit" }}>
          {prefix}{value}
        </p>
      </CardBody>
    </Card>
  );
}
