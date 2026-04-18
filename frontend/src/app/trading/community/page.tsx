"use client";

import React from "react";
import {
  ConfigProvider,
  Card,
  Table,
  Tag,
  Empty,
  Spin,
} from "antd";
import { TrophyOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import useSWR from "swr";
import { fetcher } from "@/lib/market-data";

export default function CommunityPage() {
  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: {
      leaderboard: Array<{
        rank: number;
        user: { id: string; name: string; avatarUrl: string | null };
        accountName: string;
        balance: number;
        pnl: number;
        pnlPercent: number;
        tradeCount: number;
      }>;
    };
  }>("/community/leaderboard", fetcher, { refreshInterval: 300000 });

  const leaderboard = data?.data?.leaderboard ?? [];

  const columns = [
    {
      title: "Rank",
      dataIndex: "rank",
      key: "rank",
      width: 60,
      render: (rank: number) => {
        if (rank === 1) return <span className="text-yellow-500 font-bold">#1</span>;
        if (rank === 2) return <span className="text-gray-400 font-bold">#2</span>;
        if (rank === 3) return <span className="text-amber-700 font-bold">#3</span>;
        return `#${rank}`;
      },
    },
    {
      title: "Trader",
      dataIndex: ["user", "name"],
      key: "name",
    },
    {
      title: "Account",
      dataIndex: "accountName",
      key: "account",
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      render: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: "P&L",
      dataIndex: "pnl",
      key: "pnl",
      render: (v: number) => (
        <span style={{ color: v >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
          {v >= 0 ? "+" : ""}${v.toFixed(2)}
        </span>
      ),
    },
    {
      title: "Return",
      dataIndex: "pnlPercent",
      key: "pnlPct",
      render: (v: number) => (
        <Tag color={v >= 0 ? "green" : "red"}>
          {v >= 0 ? "+" : ""}{v.toFixed(1)}%
        </Tag>
      ),
    },
    {
      title: "Trades",
      dataIndex: "tradeCount",
      key: "trades",
    },
  ];

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
          title="Community"
          description="Top traders and shared signals"
          actions={
            <Tag icon={<TrophyOutlined />} color="gold">
              Leaderboard
            </Tag>
          }
        />

        <Card>
          {isLoading ? (
            <Spin />
          ) : leaderboard.length === 0 ? (
            <Empty description="No traders on the leaderboard yet. Start trading to appear here!" />
          ) : (
            <Table
              dataSource={leaderboard}
              columns={columns}
              rowKey="rank"
              pagination={false}
              size="small"
            />
          )}
        </Card>
      </PageContainer>
    </ConfigProvider>
  );
}
