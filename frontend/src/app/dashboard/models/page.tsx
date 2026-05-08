"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { getMapeFillColor } from "@/lib/ai-utils";
import { MODEL_NAME_MAP } from "@/types/accuracy";

interface ModelAccuracy {
	modelId: string;
	avgMape: number | null;
	predictionCount: number;
	verifiedCount: number;
}

const modelDescMap: Record<string, string> = {
	arima: "AutoRegressive Integrated Moving Average",
	holtwinters: "Triple exponential smoothing",
	exponential_smoothing: "Simple exponential smoothing",
	naive_forecaster: "Baseline: last observed value",
	stl_forecaster: "STL decomposition + forecast",
	timer_xl: "LSTM deep learning model",
	sundial: "Transformer-based model",
};

function getMapeVariant(mape: number | null): "success" | "warning" | "error" | "default" {
	if (mape === null) return "default";
	if (mape < 3) return "success";
	if (mape < 7) return "warning";
	return "error";
}

function getMapeLabel(mape: number | null): string {
	if (mape === null) return "No data";
	if (mape < 3) return "Excellent";
	if (mape < 7) return "Good";
	if (mape < 15) return "Fair";
	return "Poor";
}

export default function ModelsComparisonPage() {
	const [accuracy, setAccuracy] = useState<ModelAccuracy[]>([]);
	const [loading, setLoading] = useState(true);
	const [days, setDays] = useState(30);
	const [isDemoData, setIsDemoData] = useState(false);

	useEffect(() => {
		async function loadAccuracy() {
			setLoading(true);
			try {
				const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
				const headers: Record<string, string> = { "Content-Type": "application/json" };
				if (token) headers.Authorization = `Bearer ${token}`;

				const res = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/signals/models/accuracy?days=${days}`,
					{ headers },
				);

				if (res.ok) {
					const data = await res.json();
					if (data.success && data.data?.accuracy) {
						setAccuracy(data.data.accuracy);
						return;
					}
				}
				setAccuracy([]);
				setIsDemoData(true);
			} catch {
				setAccuracy([]);
				setIsDemoData(true);
			} finally {
				setLoading(false);
			}
		}
		loadAccuracy();
	}, [days]);

	const bestModel = accuracy.reduce(
		(best, m) =>
			m.avgMape !== null && (best === null || (best.avgMape !== null && m.avgMape < best.avgMape))
				? m
				: best,
		null as ModelAccuracy | null,
	);

	const tableData = accuracy.map((a) => ({
		id: a.modelId,
		model: MODEL_NAME_MAP[a.modelId] || a.modelId,
		description: modelDescMap[a.modelId] || "",
		mape: a.avgMape,
		predictionCount: a.predictionCount,
		verifiedCount: a.verifiedCount,
		rating: getMapeLabel(a.avgMape),
	}));

	const columns = [
		{
			key: "model",
			title: "Model",
			render: (row: (typeof tableData)[0]) => (
				<div>
					<span className="font-semibold font-mono">{row.model}</span>
					<br />
					<span className="text-xs text-muted-foreground">{row.description}</span>
				</div>
			),
		},
		{
			key: "mape",
			title: "MAPE",
			render: (row: (typeof tableData)[0]) => (
				<div className="flex items-center gap-2">
					<span
						className="font-semibold font-mono text-base"
						style={{ color: getMapeFillColor(row.mape) }}
					>
						{row.mape !== null ? `${row.mape.toFixed(2)}%` : "—"}
					</span>
					<Tag color={getMapeVariant(row.mape)}>{getMapeLabel(row.mape)}</Tag>
				</div>
			),
		},
		{
			key: "predictionCount",
			title: "Predictions",
			render: (row: (typeof tableData)[0]) => (
				<span className="font-mono">{row.predictionCount}</span>
			),
		},
		{
			key: "verifiedCount",
			title: "Verified",
			render: (row: (typeof tableData)[0]) => {
				const pct =
					row.predictionCount > 0 ? Math.round((row.verifiedCount / row.predictionCount) * 100) : 0;
				return (
					<div className="flex items-center gap-2">
						<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-24">
							<div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
						</div>
						<span className="text-xs text-gray-500">
							{row.verifiedCount}/{row.predictionCount}
						</span>
					</div>
				);
			},
		},
		{
			key: "rating",
			title: "Accuracy Rating",
			render: (row: (typeof tableData)[0]) => {
				const mape = accuracy.find((a) => a.modelId === row.id)?.avgMape;
				if (mape === null || mape === undefined) return <Tag color="default">Awaiting Data</Tag>;
				if (mape < 3) return <Tag color="success">Top Performer</Tag>;
				if (mape < 7) return <Tag color="primary">Reliable</Tag>;
				if (mape < 15) return <Tag color="warning">Needs Tuning</Tag>;
				return <Tag color="error">Underperforming</Tag>;
			},
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title="Model Comparison"
				description="Compare prediction accuracy across all AI models using MAPE (Mean Absolute Percentage Error)"
			/>

			{isDemoData && (
				<Alert variant="info" className="mb-4">
					No prediction data yet.
				</Alert>
			)}

			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-3">
					<span className="text-sm text-muted-foreground">Time Window:</span>
					<Select
						value={String(days)}
						onChange={(v) => setDays(Number(v))}
						options={[
							{ label: "Last 7 days", value: "7" },
							{ label: "Last 30 days", value: "30" },
							{ label: "Last 90 days", value: "90" },
						]}
					/>
				</div>
				{bestModel && bestModel.avgMape !== null && (
					<Tag color="success">
						{MODEL_NAME_MAP[bestModel.modelId]} (MAPE {bestModel.avgMape.toFixed(2)}%)
					</Tag>
				)}
			</div>

			<Card>
				<CardBody>
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
						</div>
					) : (
						<Table columns={columns} dataSource={tableData} />
					)}
				</CardBody>
			</Card>

			<Card className="mt-4">
				<CardHeader>
					<CardTitle>Understanding MAPE</CardTitle>
				</CardHeader>
				<CardBody>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div>
							<Tag color="success">Excellent</Tag>
							<br />
							<span className="text-xs text-gray-500">MAPE &lt; 3%</span>
						</div>
						<div>
							<Tag color="warning">Good</Tag>
							<br />
							<span className="text-xs text-gray-500">MAPE 3-7%</span>
						</div>
						<div>
							<Tag color="warning">Fair</Tag>
							<br />
							<span className="text-xs text-gray-500">MAPE 7-15%</span>
						</div>
						<div>
							<Tag color="error">Poor</Tag>
							<br />
							<span className="text-xs text-gray-500">MAPE &gt; 15%</span>
						</div>
					</div>
					<p className="text-xs text-gray-400 mt-2">
						MAPE = (1/n) × &Sigma;|actual &minus; predicted| / |actual| × 100. Lower is better.
					</p>
				</CardBody>
			</Card>
		</PageContainer>
	);
}
