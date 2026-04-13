"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Alert,
  Tag,
  ConfigProvider,
  Space,
} from "antd";
import {
  ThunderboltOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import CommoditySelector from "@/components/trading/CommoditySelector";
import TradingForecastChart from "@/components/trading/TradingForecastChart";
import TradingSignalPanel from "@/components/trading/TradingSignalPanel";
import ModelConsensusTable from "@/components/trading/ModelConsensusTable";
import AnomalyAlertBanner, { type AnomalyAlert } from "@/components/trading/AnomalyAlertBanner";

const { Text, Paragraph } = Typography;

// Commodity presets with demo data
const COMMODITIES = [
  {
    id: "wti-crude",
    name: "WTI Crude Oil",
    symbol: "CL",
    unit: "USD/bbl",
    timeseriesPath: "root.trading.wti_crude.price",
    demoPrice: 78.45,
    demoChange: 1.23,
    demoChangePercent: 1.59,
  },
  {
    id: "brent-crude",
    name: "Brent Crude",
    symbol: "BZ",
    unit: "USD/bbl",
    timeseriesPath: "root.trading.brent_crude.price",
    demoPrice: 82.17,
    demoChange: -0.45,
    demoChangePercent: -0.54,
  },
  {
    id: "natural-gas",
    name: "Natural Gas",
    symbol: "NG",
    unit: "USD/MMBtu",
    timeseriesPath: "root.trading.natural_gas.price",
    demoPrice: 2.34,
    demoChange: 0.08,
    demoChangePercent: 3.54,
  },
  {
    id: "gold",
    name: "Gold",
    symbol: "XAU",
    unit: "USD/oz",
    timeseriesPath: "root.trading.gold.price",
    demoPrice: 2345.6,
    demoChange: 12.3,
    demoChangePercent: 0.53,
  },
];

// Generate demo prediction data
function generateDemoPredictions(currentPrice: number) {
  const models = ["arima", "holtwinters", "exponential_smoothing", "stl_forecaster", "naive_forecaster"];
  const predictions: Record<string, any> = {};

  for (const model of models) {
    const trend = (Math.random() - 0.4) * 0.02;
    const volatility = 0.005 + Math.random() * 0.01;
    const timestamps: number[] = [];
    const values: number[] = [];
    const lowerBound: number[] = [];
    const upperBound: number[] = [];

    let price = currentPrice;
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      price = price * (1 + trend + (Math.random() - 0.5) * volatility);
      timestamps.push(now + (i + 1) * 86400000);
      values.push(Math.round(price * 100) / 100);
      lowerBound.push(Math.round(price * (1 - 0.02 - Math.random() * 0.02) * 100) / 100);
      upperBound.push(Math.round(price * (1 + 0.02 + Math.random() * 0.02) * 100) / 100);
    }

    predictions[model] = { timestamps, values, lowerBound, upperBound, algorithm: model };
  }

  return predictions;
}

function generateDemoSignal(predictions: Record<string, any>, currentPrice: number) {
  const individualSignals = Object.entries(predictions).map(([modelId, pred]) => {
    const lastPred = pred.values[pred.values.length - 1];
    const change = ((lastPred - currentPrice) / currentPrice) * 100;
    return {
      modelId,
      type: change > 1 ? "BUY" as const : change < -1 ? "SELL" as const : "HOLD" as const,
      predictedChange: Math.round(change * 100) / 100,
      currentValue: currentPrice,
      predictedValue: lastPred,
      confidence: 0.5 + Math.random() * 0.4,
      status: "available" as const,
    };
  });

  const buyCount = individualSignals.filter((s) => s.type === "BUY").length;
  const sellCount = individualSignals.filter((s) => s.type === "SELL").length;
  const holdCount = individualSignals.length - buyCount - sellCount;
  const consensusType = buyCount > sellCount ? "BUY" : sellCount > buyCount ? "SELL" : "HOLD";
  const modelsAgree = Math.max(buyCount, sellCount, holdCount);

  return {
    type: consensusType,
    confidence: Math.round((modelsAgree / individualSignals.length) * 100) / 100,
    modelsAgree,
    totalModels: individualSignals.length,
    availableModels: individualSignals.length,
    predictedDirection: Math.round(
      (individualSignals.reduce((s, sig) => s + sig.predictedChange, 0) / individualSignals.length) * 100
    ) / 100,
    supportLevel: Math.round(currentPrice * 0.97 * 100) / 100,
    resistanceLevel: Math.round(currentPrice * 1.04 * 100) / 100,
    individualSignals,
    distribution: { buy: buyCount, sell: sellCount, hold: holdCount },
    timestamp: new Date().toISOString(),
  };
}

export default function TradingPage() {
  const [selectedCommodity, setSelectedCommodity] = useState(COMMODITIES[0].id);
  const [predictions, setPredictions] = useState<Record<string, any>>({});
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [isDemoData, setIsDemoData] = useState(false);

  const selected = COMMODITIES.find((c) => c.id === selectedCommodity)!;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsDemoData(false);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `/api/signals/${selected.id}?timeseriesPath=${encodeURIComponent(selected.timeseriesPath)}&currentPrice=${selected.demoPrice}&horizon=10`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setSignal(data.data);

          // Try to get cached predictions
          try {
            const predRes = await fetch(
              `/api/signals/${selected.id}/predictions?horizon=10`,
              { headers }
            );
            if (predRes.ok) {
              const predData = await predRes.json();
              if (predData.success && predData.data?.predictions) {
                setPredictions(predData.data.predictions);
                return; // Success — don't fall through to demo
              }
            }
          } catch {
            // Predictions fetch failed — use demo
          }
          // API signal succeeded but predictions unavailable — generate demo predictions
          const demoPreds = generateDemoPredictions(selected.demoPrice);
          setPredictions(demoPreds);
          setIsDemoData(true);
        } else {
          throw new Error("API returned unsuccessful");
        }
      } else {
        // API unavailable — full demo fallback
        const demoPreds = generateDemoPredictions(selected.demoPrice);
        setPredictions(demoPreds);
        setSignal(generateDemoSignal(demoPreds, selected.demoPrice));
        setIsDemoData(true);
      }
    } catch {
      const demoPreds = generateDemoPredictions(selected.demoPrice);
      setPredictions(demoPreds);
      setSignal(generateDemoSignal(demoPreds, selected.demoPrice));
      setIsDemoData(true);
    } finally {
      setLoading(false);
    }
  }, [selected.id, selected.demoPrice, selected.timeseriesPath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate demo historical data for chart
  const historicalData = React.useMemo(() => {
    const data = [];
    const now = Date.now();
    let price = selected.demoPrice * 0.95;
    for (let i = 30; i >= 0; i--) {
      price += (Math.random() - 0.48) * (selected.demoPrice * 0.01);
      data.push({
        timestamp: now - i * 86400000,
        value: Math.round(price * 100) / 100,
      });
    }
    return data;
  }, [selected.demoPrice]);

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
          title="Trading Intelligence"
          description="AI-powered commodity price forecasting and trading signals"
          actions={
            <Tag color="blue" style={{ fontSize: 11 }}>Beta</Tag>
          }
        />

        {/* Commodity Selector — tabs on desktop, dropdown on mobile */}
        <CommoditySelector
          commodities={COMMODITIES.map((c) => ({ id: c.id, name: c.name, symbol: c.symbol }))}
          selected={selectedCommodity}
          onSelect={setSelectedCommodity}
          loading={loading}
          renderLabel={(c) => (
            <span>
              {c.name}{" "}
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({c.symbol})
              </Text>
            </span>
          )}
        />

        {/* Anomaly alerts — hidden when empty */}
        <AnomalyAlertBanner anomalies={anomalies} />

        {isDemoData && (
          <Alert
            type="info"
            message="Showing demo data. Connect to a live data source for real-time trading signals."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

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

        {/* 2-column layout: Chart (2fr) + Signal Panel (1fr) on desktop, single column on mobile */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card
              title={
                <Space>
                  <LineChartOutlined />
                  <span>{selected.name} — Price Forecast</span>
                </Space>
              }
              loading={loading}
            >
              <TradingForecastChart
                historicalData={historicalData}
                predictions={predictions}
                currentPrice={selected.demoPrice}
                supportLevel={signal?.supportLevel}
                resistanceLevel={signal?.resistanceLevel}
                loading={loading}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <TradingSignalPanel
              consensusType={signal?.type || "HOLD"}
              confidence={signal?.confidence || 0}
              modelsAgree={signal?.modelsAgree || 0}
              totalModels={signal?.totalModels || 0}
              individualSignals={signal?.individualSignals || []}
              predictedDirection={signal?.predictedDirection || 0}
              supportLevel={signal?.supportLevel || selected.demoPrice * 0.97}
              resistanceLevel={signal?.resistanceLevel || selected.demoPrice * 1.04}
              distribution={signal?.distribution || { buy: 0, sell: 0, hold: 0 }}
              loading={loading}
            />
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
              loading={loading}
            >
              <ModelConsensusTable
                signals={signal?.individualSignals || []}
                loading={loading}
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
