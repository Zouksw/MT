"use client";

import { LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import CorrelationMatrixChart from "@/components/trading/CorrelationMatrix";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";

export default function AnalysisPage() {
	const [matrixData, setMatrixData] = useState<{
		commodities: string[];
		matrix: number[][];
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [windowDays, setWindowDays] = useState(30);

	useEffect(() => {
		async function loadMatrix() {
			setLoading(true);
			try {
				const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
				const headers: Record<string, string> = { "Content-Type": "application/json" };
				if (token) headers.Authorization = `Bearer ${token}`;

				const res = await fetch(`/api/signals/correlation/matrix?window=${windowDays}`, {
					headers,
				});

				if (res.ok) {
					const data = await res.json();
					if (data.success && data.data) {
						setMatrixData(data.data);
						return;
					}
				}
				// API returned non-success or no data — show an honest empty state
				// instead of fabricating a random correlation matrix (AGENTS.md
				// §十.3: never write fabricated data). Previously this generated
				// Math.random() values dressed up as Pearson correlations.
				setMatrixData(null);
			} catch {
				setMatrixData(null);
			} finally {
				setLoading(false);
			}
		}
		loadMatrix();
	}, [windowDays]);

	return (
		<PageContainer>
			<PageHeader
				title="Correlation Analysis"
				description="Pearson correlation between commodity prices. 30-day rolling window, UTC timezone alignment."
			/>

			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-3">
					<span className="text-sm text-muted-foreground">Rolling Window:</span>
					<Select
						value={String(windowDays)}
						onChange={(v) => setWindowDays(Number(v))}
						options={[
							{ label: "7 days", value: "7" },
							{ label: "14 days", value: "14" },
							{ label: "30 days", value: "30" },
							{ label: "90 days", value: "90" },
						]}
					/>
				</div>
				<span className="text-xs text-muted-foreground">
					{matrixData?.commodities?.length || 0} commodities
				</span>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<LayoutGrid className="size-5 text-primary" />
						<CardTitle>Price Correlation Matrix</CardTitle>
					</div>
				</CardHeader>
				<CardBody>
					{loading && (
						<div className="flex items-center justify-center py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
						</div>
					)}
					{matrixData && !loading && (
						<CorrelationMatrixChart
							commodities={matrixData.commodities}
							matrix={matrixData.matrix}
							loading={loading}
						/>
					)}
					{!matrixData && !loading && (
						<EmptyState
							type="data"
							title="No correlation data available"
							description="Correlation data will appear here when enough price history exists for at least two commodities. Try a wider rolling window."
						/>
					)}
				</CardBody>
			</Card>

			<Card className="mt-4">
				<CardHeader>
					<CardTitle>Reading the Matrix</CardTitle>
				</CardHeader>
				<CardBody>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<p className="text-sm">
							<strong>+1.0</strong> — Perfect positive correlation (prices move together)
						</p>
						<p className="text-sm">
							<strong>0.0</strong> — No linear relationship
						</p>
						<p className="text-sm">
							<strong>&minus;1.0</strong> — Perfect negative correlation (prices move opposite)
						</p>
					</div>
				</CardBody>
			</Card>
		</PageContainer>
	);
}
