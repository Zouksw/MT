"use client";

import React from "react";
import {
  ConfigProvider,
  Card,
  Statistic,
  Row,
  Col,
  Select,
  Spin,
  Empty,
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  FundOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useSimAccounts } from "@/lib/simulation";
import useSWR from "swr";
import { fetcher } from "@/lib/market-data";

export default function AnalyticsPage() {
  const { accounts } = useSimAccounts();

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
          title="Analytics"
          description="Risk metrics, seasonality, and performance analysis"
        />

        {accounts.length === 0 ? (
          <Card>
            <Empty description="Create a simulation account first to see analytics" />
          </Card>
        ) : (
          <RiskDashboard accounts={accounts} />
        )}
      </PageContainer>
    </ConfigProvider>
  );
}

function RiskDashboard({ accounts }: { accounts: Array<{ id: string; name: string }> }) {
  const [selectedId, setSelectedId] = React.useState(accounts[0]?.id);

  const { data, error, isLoading } = useSWR<{ success: boolean; data: { risk: {
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
        className="w-64"
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
      />

      {isLoading ? (
        <Spin />
      ) : risk ? (
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title="Sharpe Ratio"
                value={risk.sharpe}
                precision={2}
                valueStyle={{ color: risk.sharpe > 1 ? "#22c55e" : risk.sharpe > 0 ? "#f59e0b" : "#ef4444" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title="Sortino Ratio"
                value={risk.sortino}
                precision={2}
                valueStyle={{ color: risk.sortino > 1 ? "#22c55e" : risk.sortino > 0 ? "#f59e0b" : "#ef4444" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title="Max Drawdown"
                value={risk.maxDrawdown * 100}
                precision={2}
                suffix="%"
                valueStyle={{ color: "#ef4444" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title="VaR (95%)"
                value={risk.var95 * 100}
                precision={2}
                suffix="%"
                valueStyle={{ color: "#ef4444" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title="Win Rate"
                value={risk.winRate * 100}
                precision={1}
                suffix="%"
                valueStyle={{ color: risk.winRate > 0.5 ? "#22c55e" : "#ef4444" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title="Profit Factor"
                value={risk.profitFactor}
                precision={2}
                valueStyle={{ color: risk.profitFactor > 1 ? "#22c55e" : "#ef4444" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic
                title="Annualized Return"
                value={risk.annualizedReturn * 100}
                precision={2}
                suffix="%"
                prefix={risk.annualizedReturn >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ color: risk.annualizedReturn >= 0 ? "#22c55e" : "#ef4444" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Card size="small">
              <Statistic title="Total Trades" value={risk.totalTrades} />
            </Card>
          </Col>
        </Row>
      ) : (
        <Card>
          <Empty description="No risk data — place some trades first" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      )}
    </div>
  );
}
