"use client";

import { BarChart3, Beef, Zap } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import AnomalyAlertBanner from "@/components/trading/AnomalyAlertBanner";
import BeefCutSelector from "@/components/trading/BeefCutSelector";
import ChartToolbar from "@/components/trading/ChartToolbar";
import CommodityInfoCard from "@/components/trading/CommodityInfoCard";
import CommoditySelector from "@/components/trading/CommoditySelector";
import DataSourcePanel from "@/components/trading/DataSourcePanel";
import MarketFactorsPanel from "@/components/trading/MarketFactorsPanel";
import ModelConsensusTable from "@/components/trading/ModelConsensusTable";
import MultiSourceChart from "@/components/trading/MultiSourceChart";
import ProfessionalChart from "@/components/trading/ProfessionalChart";
import TimeframeSelector from "@/components/trading/TimeframeSelector";
import TradingSignalPanel from "@/components/trading/TradingSignalPanel";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tag } from "@/components/ui/Tag";
import { MODEL_NAME_MAP } from "@/types/accuracy";
import { useTradingData } from "./useTradingData";

export default function TradingPage() {
	const d = useTradingData();

	return (
		<PageContainer>
			<PageHeader
				title="Market Intelligence"
				description="AI-powered commodity price forecasting and market analysis"
				actions={
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								d.setBeefMode(!d.beefMode);
								d.setSelectedCut("");
								d.setBeefFactoryFilter("");
							}}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
								d.beefMode
									? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
									: "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
							}`}
						>
							<Beef className="size-3.5" />
							{d.beefMode ? "Beef Cuts" : "Show Beef Cuts"}
						</button>
						{!d.beefMode && d.selected && (
							<Tag color="info">{d.selected.nameCn || d.selected.name}</Tag>
						)}
						{d.beefMode && d.beefCutInfo && <Tag color="info">{d.beefCutInfo.displayName}</Tag>}
					</div>
				}
			/>

			{/* Commodity Selector (normal mode) or Beef Cut Selector (beef mode) */}
			{d.beefMode ? (
				<BeefCutSelector selected={d.selectedCut} onSelect={d.setSelectedCut} />
			) : (
				d.commodities.length > 0 && (
					<CommoditySelector
						commodities={d.commodities.map((c) => ({
							id: c.slug,
							name: c.nameCn || c.name,
							symbol:
								c.category === "forex"
									? c.slug.replace("_", "/").toUpperCase()
									: c.originCountry || c.category.slice(0, 3).toUpperCase(),
						}))}
						selected={d.selectedSlug}
						onSelect={d.setSelectedSlug}
						loading={d.commoditiesLoading}
						renderLabel={(c) => (
							<span>
								{c.name}{" "}
								<span className="text-gray-400" style={{ fontSize: 11 }}>
									({c.symbol})
								</span>
							</span>
						)}
					/>
				)
			)}

			{/* Anomaly alerts */}
			<AnomalyAlertBanner anomalies={d.anomalies} />

			{/* Signal change alert */}
			{!d.beefMode &&
				d.previousSignalType &&
				d.signal?.type &&
				d.previousSignalType !== d.signal.type && (
					<Alert
						variant="info"
						title={`Signal changed: ${d.previousSignalType} → ${d.signal.type}`}
						closable
						onClose={() => d.setPreviousSignalType(null)}
						className="mb-4"
					>
						The consensus signal for {d.selected?.nameCn || d.selected?.name} shifted from{" "}
						{d.previousSignalType} to {d.signal.type}.
					</Alert>
				)}

			{d.error && (
				<Alert
					variant="warning"
					title={d.error}
					closable
					onClose={() => d.setError(null)}
					className="mb-4"
				>
					{d.error}
				</Alert>
			)}

			{/* Toolbar: Timeframe + Chart Type + Indicators + Multi-Source Toggle */}
			<div className="flex items-center gap-4 mb-4 flex-wrap">
				{!d.beefMode && <TimeframeSelector value={d.timeframe} onChange={d.setTimeframe} />}
				<ChartToolbar
					chartType={d.chartType}
					onChartTypeChange={d.setChartType}
					indicators={d.indicators}
					onIndicatorsChange={d.setIndicators}
				/>
				{!d.beefMode && d.sourceCount > 1 && (
					<button
						type="button"
						onClick={() => d.setShowMultiSource(!d.showMultiSource)}
						className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
							d.showMultiSource
								? "bg-primary text-primary-foreground border-primary"
								: "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
						}`}
					>
						{d.showMultiSource ? "Single Source" : `Multi-Source (${d.sourceCount})`}
					</button>
				)}
				{d.beefMode && d.beefFactories.length > 0 && (
					<select
						value={d.beefFactoryFilter}
						onChange={(e) => d.setBeefFactoryFilter(e.target.value)}
						className="px-2 py-1.5 rounded-md text-xs border bg-muted text-muted-foreground"
					>
						<option value="">All Factories</option>
						{d.beefFactories.map((f: { code: string; name: string; country: string }) => (
							<option key={f.code} value={f.code}>
								{f.name} ({f.country})
							</option>
						))}
					</select>
				)}
				{d.beefMode && Object.keys(d.beefMultiSources).length > 1 && (
					<button
						type="button"
						onClick={() => d.setShowMultiSource(!d.showMultiSource)}
						className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
							d.showMultiSource
								? "bg-primary text-primary-foreground border-primary"
								: "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
						}`}
					>
						{d.showMultiSource
							? "Single Source"
							: `By Source (${Object.keys(d.beefMultiSources).length})`}
					</button>
				)}
			</div>

			{/* 2-column layout: Chart + Signal Panel */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>
								<div className="flex items-center gap-2">
									<BarChart3 className="size-4" />
									<span>
										{d.beefMode
											? d.selectedCut
												? `${d.selectedCut.replace(/_/g, " ")} — Beef Cut Price`
												: "Select a beef cut"
											: `${d.selected?.name || "Loading..."} — Price Chart`}
									</span>
								</div>
							</CardTitle>
						</CardHeader>
						<CardBody>
							{d.loading && !d.beefMode ? (
								<div className="flex items-center justify-center h-48">
									<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
								</div>
							) : d.beefMode && !d.selectedCut ? (
								<div className="flex items-center justify-center h-48 text-gray-400">
									Select a beef cut above to view price history
								</div>
							) : d.beefMode && d.selectedCut ? (
								d.showMultiSource ? (
									<MultiSourceChart sources={d.beefMultiSources} height={480} />
								) : (
									<ProfessionalChart data={d.beefChartData} chartType={d.chartType} height={480} />
								)
							) : d.showMultiSource ? (
								<MultiSourceChart sources={d.multiSources} height={480} />
							) : (
								<ProfessionalChart
									data={d.chartData}
									supportLevel={d.signal?.supportLevel}
									resistanceLevel={d.signal?.resistanceLevel}
									chartType={d.chartType}
									height={480}
								/>
							)}
						</CardBody>
					</Card>
				</div>

				<div>
					{/* Beef cut info card or Commodity info card */}
					{d.beefMode && d.beefCutInfo ? (
						<Card className="mb-4">
							<CardBody>
								<h3 className="font-medium text-sm mb-2">{d.beefCutInfo.displayName}</h3>
								<div className="space-y-1.5 text-xs">
									<div className="flex justify-between">
										<span className="text-gray-500">Latest Price</span>
										<span className="font-mono font-medium">
											${d.beefCutInfo.latestPrice.toFixed(2)}/kg
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-500">Range (90d)</span>
										<span className="font-mono">
											${d.beefCutInfo.minPrice.toFixed(2)} — ${d.beefCutInfo.maxPrice.toFixed(2)}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-500">Sources</span>
										<span>{d.beefCutInfo.sources.join(", ")}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-500">Factories</span>
										<span>{d.beefCutInfo.factories.length}</span>
									</div>
								</div>
							</CardBody>
						</Card>
					) : (
						!d.beefMode &&
						d.selected && (
							<CommodityInfoCard
								commodity={{
									id: d.selected.id,
									slug: d.selected.slug,
									name: d.selected.name,
									nameCn: d.selected.nameCn,
									category: d.selected.category,
									subcategory: d.selected.subcategory,
									grade: d.selected.grade,
									originCountry: d.selected.originCountry,
									factoryCode: d.selected.factoryCode,
									unit: d.selected.unit,
									currency: d.selected.currency,
								}}
								latestDate={d.prices.length > 0 ? d.prices[d.prices.length - 1].date : null}
								latestSource={d.priceSources.length > 0 ? d.priceSources[0].label : null}
							/>
						)
					)}

					{d.signalLoading && !d.beefMode && (
						<div className="flex items-center justify-center py-8">
							<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
							<span className="ml-3 text-sm text-gray-500">Loading AI signals...</span>
						</div>
					)}
					{!d.beefMode && (
						<TradingSignalPanel
							consensusType={d.signal?.type || "HOLD"}
							confidence={d.signal?.confidence || 0}
							modelsAgree={d.signal?.modelsAgree || 0}
							totalModels={d.signal?.totalModels || 0}
							individualSignals={(d.signal?.individualSignals ?? []).filter(Boolean)}
							predictedDirection={d.signal?.predictedDirection || 0}
							supportLevel={d.signal?.supportLevel || d.currentPrice * 0.97}
							resistanceLevel={d.signal?.resistanceLevel || d.currentPrice * 1.04}
							distribution={d.signal?.distribution || { buy: 0, sell: 0, hold: 0 }}
							currentPrice={d.currentPrice}
							bestModelId={d.bestModelId}
							loading={d.signalLoading}
						/>
					)}

					{/* Beef mode: factory price comparison table */}
					{d.beefMode && d.beefPrices.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Prices by Source</CardTitle>
							</CardHeader>
							<CardBody>
								<div className="overflow-x-auto">
									<table className="data-table text-xs">
										<thead>
											<tr>
												<th className="text-left">Source</th>
												<th className="text-left">Factory</th>
												<th className="text-right">Price</th>
												<th className="text-left">Date</th>
											</tr>
										</thead>
										<tbody>
											{d.beefPrices
												.slice(0, 15)
												.map(
													(p: {
														source: string;
														price: number;
														date: string;
														factory?: { code: string; name: string; country: string };
													}) => (
														<tr key={`${p.source}-${p.factory?.code}-${p.date}`}>
															<td className="text-gray-500">{p.source}</td>
															<td>
																{p.factory ? `${p.factory.name} (${p.factory.country})` : "--"}
															</td>
															<td className="text-right font-mono">${p.price.toFixed(2)}</td>
															<td className="text-gray-400">
																{new Date(p.date).toLocaleDateString()}
															</td>
														</tr>
													),
												)}
										</tbody>
									</table>
								</div>
							</CardBody>
						</Card>
					)}
				</div>
			</div>

			{/* Model consensus table — only in normal mode */}
			{!d.beefMode && (
				<div className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>
								<div className="flex items-center gap-2">
									<Zap className="size-4" />
									<span>Model Consensus</span>
								</div>
							</CardTitle>
						</CardHeader>
						<CardBody>
							{d.signalLoading ? (
								<div className="flex items-center justify-center py-8">
									<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
								</div>
							) : (
								<ModelConsensusTable
									signals={(d.signal?.individualSignals ?? []).filter(Boolean)}
									loading={d.signalLoading}
								/>
							)}
						</CardBody>
					</Card>
				</div>
			)}

			{/* Prediction History — only in normal mode */}
			{!d.beefMode && d.predictionHistory.length > 0 && (
				<div className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>
								<div className="flex items-center gap-2">
									<BarChart3 className="size-4" />
									<span>Recent Verified Predictions</span>
								</div>
							</CardTitle>
						</CardHeader>
						<CardBody className="p-0">
							<div className="overflow-x-auto">
								<table className="min-w-full">
									<thead>
										<tr className="border-b border-border">
											<th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
												Date
											</th>
											<th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
												Model
											</th>
											<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
												Predicted
											</th>
											<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
												Actual
											</th>
											<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
												MAPE
											</th>
											<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
												Confidence
											</th>
										</tr>
									</thead>
									<tbody>
										{d.predictionHistory.map((p) => {
											const predicted = p.predictedValues?.[0];
											const actual = p.actualValues?.[0];
											return (
												<tr
													key={p.id}
													className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
												>
													<td className="px-4 py-2.5 text-xs text-muted-foreground">
														{new Date(p.predictedAt).toLocaleDateString()}
													</td>
													<td className="px-4 py-2.5 text-sm font-medium">
														{MODEL_NAME_MAP[p.modelId] || p.modelId}
													</td>
													<td className="px-4 py-2.5 text-xs font-mono text-right">
														{predicted !== undefined ? `$${predicted.toFixed(2)}` : "--"}
													</td>
													<td className="px-4 py-2.5 text-xs font-mono text-right">
														{actual !== undefined ? `$${actual.toFixed(2)}` : "--"}
													</td>
													<td className="px-4 py-2.5 text-xs font-mono font-medium text-right">
														{p.mape !== null ? (
															<span
																className={
																	p.mape < 5
																		? "text-green-600 dark:text-green-400"
																		: p.mape < 10
																			? "text-primary"
																			: "text-red-600 dark:text-red-400"
																}
															>
																{p.mape.toFixed(1)}%
															</span>
														) : (
															"--"
														)}
													</td>
													<td className="px-4 py-2.5 text-xs text-right text-muted-foreground">
														{p.confidence !== null ? `${(p.confidence * 100).toFixed(0)}%` : "--"}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</CardBody>
					</Card>
				</div>
			)}

			{/* Market factors panorama — only in normal mode */}
			{!d.beefMode && (
				<div className="mt-4">
					<MarketFactorsPanel factors={d.factors} loading={d.factorsLoading} />
				</div>
			)}

			{/* Data provenance panel */}
			<div className="mt-4">
				<DataSourcePanel
					priceSources={d.priceSources}
					factorSources={d.factorSources}
					loading={d.sourcesLoading}
				/>
			</div>

			{/* Disclaimer */}
			<p className="text-center text-gray-400 mt-6" style={{ fontSize: 11, opacity: 0.7 }}>
				AI-generated signals are for informational purposes only. Not financial advice. Past
				performance does not guarantee future results.
			</p>
		</PageContainer>
	);
}
