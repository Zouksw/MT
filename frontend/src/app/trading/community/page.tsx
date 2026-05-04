"use client";

import { Sparkles, Users } from "lucide-react";
import useSWR from "swr";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { fetcher } from "@/lib/market-data";

interface LeaderboardEntry {
	rank: number;
	user: { id: string; name: string; avatarUrl: string | null };
	accountName: string;
	balance: number;
	pnl: number;
	pnlPercent: number;
	tradeCount: number;
}

export default function CommunityPage() {
	const { data, isLoading } = useSWR<{
		success: boolean;
		data: {
			leaderboard: LeaderboardEntry[];
		};
	}>("/community/leaderboard", fetcher, { refreshInterval: 300000 });

	const leaderboard = data?.data?.leaderboard ?? [];

	const columns = [
		{
			key: "rank",
			title: "Rank",
			dataIndex: "rank" as const,
			width: 60,
			render: (_value: unknown, record: LeaderboardEntry) => {
				if (record.rank === 1) return <span className="text-yellow-500 font-bold">#1</span>;
				if (record.rank === 2) return <span className="text-gray-400 font-bold">#2</span>;
				if (record.rank === 3) return <span className="text-amber-700 font-bold">#3</span>;
				return `#${record.rank}`;
			},
		},
		{
			key: "name",
			title: "Analyst",
			render: (_value: unknown, record: LeaderboardEntry) => record.user.name,
		},
		{
			key: "account",
			title: "Account",
			dataIndex: "accountName" as const,
		},
		{
			key: "predictions",
			title: "Predictions",
			dataIndex: "tradeCount" as const,
		},
		{
			key: "score",
			title: "Signal Score",
			render: (_value: unknown, record: LeaderboardEntry) => (
				<Tag color={record.pnlPercent >= 0 ? "success" : "error"}>
					{record.pnlPercent >= 0 ? "+" : ""}
					{record.pnlPercent.toFixed(1)}%
				</Tag>
			),
		},
		{
			key: "accuracy",
			title: "Accuracy",
			render: (_value: unknown, record: LeaderboardEntry) => (
				<span style={{ color: record.pnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
					{record.pnl >= 0 ? "+" : ""}
					{record.pnl.toFixed(2)}
				</span>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title="Community"
				description="Top analysts ranked by prediction accuracy and signal quality"
				actions={
					<Tag color="primary">
						<span className="flex items-center gap-1">
							<Sparkles className="size-3.5" />
							Leaderboard
						</span>
					</Tag>
				}
			/>

			<Card>
				<CardBody>
					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
						</div>
					) : leaderboard.length === 0 ? (
						<div className="text-center py-8">
							<Users className="size-12 mx-auto text-gray-300 mb-3" />
							<p className="text-gray-500">
								No analysts on the leaderboard yet. Start making predictions to appear here!
							</p>
						</div>
					) : (
						<Table
							dataSource={leaderboard}
							columns={columns}
							rowKey="rank"
							loading={isLoading}
							emptyText="No leaderboard data"
						/>
					)}
				</CardBody>
			</Card>
		</PageContainer>
	);
}
