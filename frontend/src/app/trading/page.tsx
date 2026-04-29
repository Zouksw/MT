"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart3, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Tag } from "@/components/ui/Tag";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import CommoditySelector from "@/components/trading/CommoditySelector";
import ProfessionalChart from "@/components/trading/ProfessionalChart";
import MultiSourceChart from "@/components/trading/MultiSourceChart";
import TimeframeSelector from "@/components/trading/TimeframeSelector";
import ChartToolbar, { type ChartType } from "@/components/trading/ChartToolbar";
import TradingSignalPanel from "@/components/trading/TradingSignalPanel";
import ModelConsensusTable from "@/components/trading/ModelConsensusTable";
import AnomalyAlertBanner, { type AnomalyAlert } from "@/components/trading/AnomalyAlertBanner";
import DataSourcePanel from "@/components/trading/DataSourcePanel";
import MarketFactorsPanel from "@/components/trading/MarketFactorsPanel";
import CommodityInfoCard from "@/components/trading/CommodityInfoCard";
import { useCommodities, usePriceHistory, useCommoditySources, useMultiSourcePrices, useCommodityFundamentals } from "@/lib/market-data";

type Timeframe = "daily" | "weekly" | "monthly";

export default function TradingPage() {
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [showMultiSource, setShowMultiSource] = useState(false);
  const [indicators, setIndicators] = useState({ sma20: true, sma50: true, bollinger: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [signal, setSignal] = useState<any>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);

  // Fetch commodity list
  const { commodities, loading: commoditiesLoading } = useCommodities();

  // Auto-select first commodity
  useEffect(() => {
    if (!selectedSlug && commodities.length > 0) {
      setSelectedSlug(commodities[0].slug);
    }
  }, [selectedSlug, commodities]);

  const selected = useMemo(
    () => commodities.find((c) => c.slug === selectedSlug),
    [commodities, selectedSlug],
  );

  // Fetch price history
  const { prices, loading: pricesLoading } = usePriceHistory(
    selectedSlug,
    timeframe,
  );

  // Fetch data source provenance
  const { priceSources, factorSources, loading: sourcesLoading } = useCommoditySources(selectedSlug);

  // Fetch multi-source prices
  const { sources: multiSources, sourceCount } = useMultiSourcePrices(selectedSlug, timeframe);

  // Fetch market factors
  const { factors, loading: factorsLoading } = useCommodityFundamentals(selectedSlug);

  const loading = commoditiesLoading || pricesLoading;

  // Fetch AI signal when commodity changes
  const loadSignal = useCallback(async () => {
    if (!selected || prices.length === 0) return;

    const currentPrice = prices[prices.length - 1]?.close;
    if (!currentPrice) return;

    setSignalLoading(true);
    try {
      const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(
        `${apiBase}/api/signals/${selected.slug}?timeseriesPath=root.trading.${selected.slug}.price&currentPrice=${currentPrice}&horizon=10`,
        { headers },
      );

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setSignal(data.data);
        }
      }
    } catch {
      // Signal fetch failed — keep existing signal or null
    } finally {
      setSignalLoading(false);
    }
  }, [selected, prices]);

  useEffect(() => {
    loadSignal();
  }, [loadSignal]);

  // Fetch anomalies when commodity changes
  useEffect(() => {
    if (!selected) {
      setAnomalies([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(
          `${apiBase}/api/anomalies?commodityId=${selected.id}`,
          { headers },
        );

        if (!cancelled && res.ok) {
          const data = await res.json();
          setAnomalies(data.data?.anomalies ?? data.data ?? []);
        }
      } catch {
        // Anomaly fetch failed — keep empty
      }
    })();

    return () => { cancelled = true; };
  }, [selected]);

  // Convert prices to chart data format
  const chartData = useMemo(
    () =>
      prices.map((p) => ({
        time: p.date,
        open: Number(p.open ?? p.close),
        high: Number(p.high ?? p.close),
        low: Number(p.low ?? p.close),
        close: Number(p.close),
        volume: Number(p.volume ?? 0),
      })),
    [prices],
  );

  // Current price for signal panel
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].close : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Market Intelligence"
        description="AI-powered commodity price forecasting and market analysis"
        actions={
          selected ? (
            <Tag color="info">
              {selected.nameCn || selected.name}
            </Tag>
          ) : undefined
        }
      />

      {/* Commodity Selector */}
      {commodities.length > 0 && (
        <CommoditySelector
          commodities={commodities.map((c) => ({
            id: c.slug,
            name: c.nameCn || c.name,
            symbol: c.category === "forex" ? c.slug.replace("_", "/").toUpperCase() : c.originCountry || c.category.slice(0, 3).toUpperCase(),
          }))}
          selected={selectedSlug}
          onSelect={setSelectedSlug}
          loading={commoditiesLoading}
          renderLabel={(c) => (
            <span>
              {c.name}{" "}
              <span className="text-gray-400" style={{ fontSize: 11 }}>
                ({c.symbol})
              </span>
            </span>
          )}
        />
      )}

      {/* Anomaly alerts */}
      <AnomalyAlertBanner anomalies={anomalies} />

      {error && (
        <Alert
          variant="warning"
          title={error}
          closable
          onClose={() => setError(null)}
          className="mb-4"
        >
          {error}
        </Alert>
      )}

      {/* Toolbar: Timeframe + Chart Type + Indicators + Multi-Source Toggle */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <ChartToolbar
          chartType={chartType}
          onChartTypeChange={setChartType}
          indicators={indicators}
          onIndicatorsChange={setIndicators}
        />
        {sourceCount > 1 && (
          <button
            type="button"
            onClick={() => setShowMultiSource(!showMultiSource)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              showMultiSource
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
            }`}
          >
            {showMultiSource ? "Single Source" : `Multi-Source (${sourceCount})`}
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
                  <span>{selected?.name || "Loading..."} — Price Chart</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : showMultiSource ? (
                <MultiSourceChart sources={multiSources} height={480} />
              ) : (
                <ProfessionalChart
                  data={chartData}
                  supportLevel={signal?.supportLevel}
                  resistanceLevel={signal?.resistanceLevel}
                  chartType={chartType}
                  height={480}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div>
          {/* Commodity info card */}
          {selected && (
            <CommodityInfoCard
              commodity={{
                id: selected.id,
                slug: selected.slug,
                name: selected.name,
                nameCn: selected.nameCn,
                category: selected.category,
                subcategory: selected.subcategory,
                grade: selected.grade,
                originCountry: selected.originCountry,
                factoryCode: selected.factoryCode,
                unit: selected.unit,
                currency: selected.currency,
              }}
              latestDate={prices.length > 0 ? prices[prices.length - 1].date : null}
              latestSource={priceSources.length > 0 ? priceSources[0].label : null}
            />
          )}

          {signalLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500">Loading AI signals...</span>
            </div>
          )}
          <TradingSignalPanel
            consensusType={signal?.type || "HOLD"}
            confidence={signal?.confidence || 0}
            modelsAgree={signal?.modelsAgree || 0}
            totalModels={signal?.totalModels || 0}
            individualSignals={(signal?.individualSignals ?? []).filter(Boolean)}
            predictedDirection={signal?.predictedDirection || 0}
            supportLevel={signal?.supportLevel || currentPrice * 0.97}
            resistanceLevel={signal?.resistanceLevel || currentPrice * 1.04}
            distribution={signal?.distribution || { buy: 0, sell: 0, hold: 0 }}
            loading={signalLoading}
          />
        </div>
      </div>

      {/* Model consensus table */}
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
            {signalLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ModelConsensusTable
                signals={(signal?.individualSignals ?? []).filter(Boolean)}
                loading={signalLoading}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Market factors panorama */}
      <div className="mt-4">
        <MarketFactorsPanel factors={factors} loading={factorsLoading} />
      </div>

      {/* Data provenance panel */}
      <div className="mt-4">
        <DataSourcePanel
          priceSources={priceSources}
          factorSources={factorSources}
          loading={sourcesLoading}
        />
      </div>

      {/* Disclaimer */}
      <p
        className="text-center text-gray-400 mt-6"
        style={{ fontSize: 11, opacity: 0.7 }}
      >
        AI-generated signals are for informational purposes only. Not financial advice.
        Past performance does not guarantee future results.
      </p>
    </PageContainer>
  );
}
