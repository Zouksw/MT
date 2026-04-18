"use client";

import React from "react";
import { Card, Statistic, Row, Col, Empty, Spin, Tag } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined, BankOutlined } from "@ant-design/icons";
import { usePortfolios, usePortfolioPerformance } from "@/lib/watchlist";

export default function PortfolioSummary() {
  const { portfolios, loading } = usePortfolios();

  if (loading) {
    return <Card loading />;
  }

  if (portfolios.length === 0) {
    return (
      <Card>
        <Empty description="No portfolios yet" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {portfolios.map((p) => (
        <PortfolioCard key={p.id} portfolio={p} />
      ))}
    </div>
  );
}

function PortfolioCard({ portfolio }: { portfolio: {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  positionCount: number;
} }) {
  const { performance, loading } = usePortfolioPerformance(portfolio.id);

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <BankOutlined />
          <span>{portfolio.name}</span>
          {portfolio.isDefault && <Tag color="blue" className="text-xs">Default</Tag>}
        </div>
      }
      size="small"
    >
      {loading ? (
        <Spin />
      ) : performance ? (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="Total P&L"
                value={performance.totalPnl}
                precision={2}
                valueStyle={{ color: performance.totalPnl >= 0 ? '#22c55e' : '#ef4444' }}
                prefix={performance.totalPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Unrealized"
                value={performance.totalUnrealizedPnl}
                precision={2}
                valueStyle={{ color: performance.totalUnrealizedPnl >= 0 ? '#22c55e' : '#ef4444' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Positions"
                value={performance.positionCount}
                suffix={
                  <span className="text-xs text-gray-400">
                    ({performance.longCount}L / {performance.shortCount}S)
                  </span>
                }
              />
            </Col>
          </Row>

          {performance.positions.length > 0 && (
            <div className="mt-4 divide-y">
              {performance.positions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium">{pos.commodity.name}</span>
                    <Tag color={pos.side === 'LONG' ? 'green' : 'red'} className="ml-2 text-xs">
                      {pos.side}
                    </Tag>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">
                      Qty: {pos.quantity.toFixed(2)} @ {pos.avgEntryPrice.toFixed(2)}
                    </div>
                    {pos.unrealizedPnl != null && (
                      <div
                        className="text-xs font-mono"
                        style={{ color: pos.unrealizedPnl >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        P&L: {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnl.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <Empty description="No positions" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );
}
