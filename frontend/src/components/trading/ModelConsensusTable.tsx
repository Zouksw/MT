"use client";

import { Table } from "@/components/ui/Table";
import { MODEL_NAME_MAP } from "@/types/accuracy";
import SignalBadge from "./SignalBadge";

interface ModelSignal {
	modelId: string;
	type: "BUY" | "SELL" | "HOLD";
	predictedChange: number;
	currentValue: number;
	predictedValue: number;
	confidence: number;
}

interface ModelConsensusTableProps {
	signals: ModelSignal[];
	loading?: boolean;
}

export default function ModelConsensusTable({
	signals,
	loading = false,
}: ModelConsensusTableProps) {
	const tableData = signals.filter(Boolean).map((s) => ({ ...s, id: s.modelId }));

	type Row = ModelSignal & { id: string };
	const columns = [
		{
			key: "modelId",
			title: "Model",
			dataIndex: "modelId" as const,
			render: (_v: unknown, row: Row) => (
				<span className="font-semibold font-mono text-[13px]">
					{MODEL_NAME_MAP[row.modelId] || row.modelId}
				</span>
			),
		},
		{
			key: "type",
			title: "Signal",
			dataIndex: "type" as const,
			render: (_v: unknown, row: Row) => (
				<SignalBadge type={row.type} confidence={row.confidence} size="small" />
			),
		},
		{
			key: "predictedValue",
			title: "Predicted",
			dataIndex: "predictedValue" as const,
			render: (_v: unknown, row: Row) => (
				<span className="font-mono">
					{row.predictedValue?.toLocaleString("en-US", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})}
				</span>
			),
		},
		{
			key: "predictedChange",
			title: "Change",
			dataIndex: "predictedChange" as const,
			render: (_v: unknown, row: Row) => (
				<span
					className="font-mono"
					style={{
						color:
							row.predictedChange > 0 ? "#16a34a" : row.predictedChange < 0 ? "#dc2626" : undefined,
					}}
				>
					{row.predictedChange > 0 ? "+" : ""}
					{row.predictedChange.toFixed(2)}%
				</span>
			),
		},
		{
			key: "confidence",
			title: "Confidence",
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
			<div className="text-center py-8 text-gray-400 text-sm">
				No model signals available for this commodity
			</div>
		);
	}

	return <Table columns={columns} dataSource={tableData} />;
}
