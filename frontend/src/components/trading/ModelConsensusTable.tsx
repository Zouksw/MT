"use client";

import { Table } from "@/components/ui/Table";
import { formatSignedPercent } from "@/lib/format";
import { MODEL_NAME_MAP } from "@/types/accuracy";
import DirectionBadge from "./DirectionBadge";

type Direction = "up" | "down" | "flat";

interface ModelForecast {
	modelId: string;
	direction: Direction;
	predictedChange: number;
	currentPrice: number;
	predictedPrice: number;
	confidence: number;
}

interface ModelConsensusTableProps {
	forecasts: ModelForecast[];
	loading?: boolean;
}

export default function ModelConsensusTable({
	forecasts,
	loading = false,
}: ModelConsensusTableProps) {
	const tableData = forecasts.filter(Boolean).map((f) => ({ ...f, id: f.modelId }));

	type Row = ModelForecast & { id: string };
	const columns = [
		{
			key: "modelId",
			title: "模型",
			dataIndex: "modelId" as const,
			render: (_v: unknown, row: Row) => (
				<span className="font-semibold font-mono text-[13px]">
					{MODEL_NAME_MAP[row.modelId] || row.modelId}
				</span>
			),
		},
		{
			key: "direction",
			title: "方向",
			dataIndex: "direction" as const,
			render: (_v: unknown, row: Row) => (
				<DirectionBadge direction={row.direction} confidence={row.confidence} size="small" />
			),
		},
		{
			key: "predictedPrice",
			title: "预测价格",
			dataIndex: "predictedPrice" as const,
			render: (_v: unknown, row: Row) => (
				<span className="font-mono">
					{row.predictedPrice?.toLocaleString("en-US", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})}
				</span>
			),
		},
		{
			key: "predictedChange",
			title: "变化",
			dataIndex: "predictedChange" as const,
			render: (_v: unknown, row: Row) => (
				<span
					className="font-mono"
					style={{
						color:
							row.predictedChange > 0 ? "#16a34a" : row.predictedChange < 0 ? "#dc2626" : undefined,
					}}
				>
					{formatSignedPercent(row.predictedChange, 2)}
				</span>
			),
		},
		{
			key: "confidence",
			title: "置信度",
			dataIndex: "confidence" as const,
			render: (_v: unknown, row: Row) => {
				const pct = Math.round(row.confidence * 100);
				const color =
					row.confidence > 0.7 ? "#16a34a" : row.confidence > 0.4 ? "#d97706" : "#dc2626";
				return (
					<div className="flex items-center gap-2">
						<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-24">
							<div
								className="h-full rounded-full"
								style={{ width: `${pct}%`, backgroundColor: color }}
							/>
						</div>
						<span className="text-xs text-gray-500">{pct}%</span>
					</div>
				);
			},
		},
	];

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
			</div>
		);
	}

	if (tableData.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground text-sm">该商品暂无模型预测数据</div>
		);
	}

	return <Table columns={columns} dataSource={tableData} />;
}
