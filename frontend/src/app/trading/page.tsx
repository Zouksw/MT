"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Alert,
  Tag,
  ConfigProvider,
  Space,
  Spin,
} from "antd";
import {
  ThunderboltOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import CommoditySelector from "@/components/trading/CommoditySelector";
import ProfessionalChart from "@/components/trading/ProfessionalChart";
import TimeframeSelector from "@/components/trading/TimeframeSelector";
import ChartToolbar, { type ChartType } from "@/components/trading/ChartToolbar";
import TradingSignalPanel from "@/components/trading/TradingSignalPanel";
import ModelConsensusTable from "@/components/trading/ModelConsensusTable";
import AnomalyAlertBanner, { type AnomalyAlert } from "@/components/trading/AnomalyAlertBanner";
import { useCommodities, usePriceHistory } from "@/lib/market-data";

const { Text, Paragraph } = Typography;

type Timeframe = "daily" | "weekly" | "monthly";

export default function TradingPage() {
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
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
      if (token) headers["Authorization"] = `Bearer ${token}`;

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
        if (token) headers["Authorization"] = `Bearer ${token}`;

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
        open: p.open ?? p.close,
        high: p.high ?? p.close,
        low: p.low ?? p.close,
        close: p.close,
        volume: p.volume ?? 0,
      })),
    [prices],
  );

  // Current price for signal panel
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].close : 0;

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
          title="Market Intelligence"
          description="AI-powered commodity price forecasting and market analysis"
          actions={
            selected ? (
              <Tag color="blue" style={{ fontSize: 11 }}>
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
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ({c.symbol})
                </Text>
              </span>
            )}
          />
        )}

        {/* Anomaly alerts */}
        <AnomalyAlertBanner anomalies={anomalies} />

        {error && (
          <Alert
            type="warning"
            message={error}
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Toolbar: Timeframe + Chart Type + Indicators */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <ChartToolbar
            chartType={chartType}
            onChartTypeChange={setChartType}
            indicators={indicators}
            onIndicatorsChange={setIndicators}
          />
        </div>

        {/* 2-column layout: Chart + Signal Panel */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card
              title={
                <Space>
                  <LineChartOutlined />
                  <span>{selected?.name || "Loading..."} — Price Chart</span>
                </Space>
              }
              loading={loading}
            >
              <ProfessionalChart
                data={chartData}
                supportLevel={signal?.supportLevel}
                resistanceLevel={signal?.resistanceLevel}
                chartType={chartType}
                height={480}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Spin spinning={signalLoading} tip="Loading AI signals...">
              <TradingSignalPanel
                consensusType={signal?.type || "HOLD"}
                confidence={signal?.confidence || 0}
                modelsAgree={signal?.modelsAgree || 0}
                totalModels={signal?.totalModels || 0}
                individualSignals={signal?.individualSignals ?? []}
                predictedDirection={signal?.predictedDirection || 0}
                supportLevel={signal?.supportLevel || currentPrice * 0.97}
                resistanceLevel={signal?.resistanceLevel || currentPrice * 1.04}
                distribution={signal?.distribution || { buy: 0, sell: 0, hold: 0 }}
                loading={signalLoading}
              />
            </Spin>
          </Col>
        </Row>

        {/* Model consensus table */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              title={
                <Space>
                  <ThunderboltOutlined />
                  <span>Model Consensus</span>
                </Space>
              }
              loading={signalLoading}
            >
              <ModelConsensusTable
                signals={signal?.individualSignals || []}
                loading={signalLoading}
              />
            </Card>
          </Col>
        </Row>

        {/* Disclaimer */}
        <Paragraph
          type="secondary"
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 11,
            opacity: 0.7,
          }}
        >
          AI-generated signals are for informational purposes only. Not financial advice.
          Past performance does not guarantee future results.
        </Paragraph>
      </PageContainer>
    </ConfigProvider>
  );
}
