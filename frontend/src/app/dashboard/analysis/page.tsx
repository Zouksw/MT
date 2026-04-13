"use client";

import React, { useState, useEffect } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Select,
  Spin,
  ConfigProvider,
  Space,
  Alert,
} from "antd";
import { HeatMapOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import CorrelationMatrixChart from "@/components/trading/CorrelationMatrix";

const { Text } = Typography;

export default function AnalysisPage() {
  const [matrixData, setMatrixData] = useState<{
    commodities: string[];
    matrix: number[][];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(30);
  const [isDemoData, setIsDemoData] = useState(false);

  useEffect(() => {
    async function loadMatrix() {
      setLoading(true);
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `/api/signals/correlation/matrix?window=${windowDays}`,
          { headers }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setMatrixData(data.data);
            return;
          }
        }
        // Demo fallback
        const commodities = [
          "brisket-80-90",
          "8-piece-set",
          "sirloin-short-rib",
          "sirloin-eye",
        ];
        const n = commodities.length;
        const matrix = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => {
            if (i === j) return 1;
            const v = Math.random() * 2 - 1;
            return Math.round(v * 100) / 100;
          })
        );
        // Make symmetric
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++) matrix[j][i] = matrix[i][j];
        setMatrixData({ commodities, matrix });
        setIsDemoData(true);
      } catch {
        const commodities = [
          "brisket-80-90",
          "8-piece-set",
          "sirloin-short-rib",
          "sirloin-eye",
        ];
        const n = commodities.length;
        const matrix = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) =>
            i === j ? 1 : Math.round((Math.random() * 2 - 1) * 100) / 100
          )
        );
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++) matrix[j][i] = matrix[i][j];
        setMatrixData({ commodities, matrix });
        setIsDemoData(true);
      } finally {
        setLoading(false);
      }
    }
    loadMatrix();
  }, [windowDays]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#F59E0B" } }}>
      <PageContainer>
        <PageHeader
          title="Correlation Analysis"
          description="Pearson correlation between commodity prices. 30-day rolling window, UTC timezone alignment."
        />

        {isDemoData && (
          <Alert
            type="info"
            message="Showing demo correlation data. Connect to live data for real commodity analysis."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Text type="secondary">Rolling Window:</Text>
              <Select
                value={windowDays}
                onChange={setWindowDays}
                style={{ width: 150 }}
                options={[
                  { label: "7 days", value: 7 },
                  { label: "14 days", value: 14 },
                  { label: "30 days", value: 30 },
                  { label: "90 days", value: 90 },
                ]}
              />
            </Space>
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {matrixData?.commodities?.length || 0} commodities
            </Text>
          </Col>
        </Row>

        <Card
          title={
            <Space>
              <HeatMapOutlined />
              <span>Price Correlation Matrix</span>
            </Space>
          }
          loading={loading}
        >
          {matrixData ? (
            <CorrelationMatrixChart
              commodities={matrixData.commodities}
              matrix={matrixData.matrix}
              loading={loading}
            />
          ) : (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Spin />
            </div>
          )}
        </Card>

        <Card
          style={{ marginTop: 16 }}
          size="small"
          title={<Text strong>Reading the Matrix</Text>}
        >
          <Row gutter={24}>
            <Col span={8}>
              <Text style={{ fontSize: 12 }}>
                <strong>+1.0</strong> — Perfect positive correlation (prices move together)
              </Text>
            </Col>
            <Col span={8}>
              <Text style={{ fontSize: 12 }}>
                <strong>0.0</strong> — No linear relationship
              </Text>
            </Col>
            <Col span={8}>
              <Text style={{ fontSize: 12 }}>
                <strong>−1.0</strong> — Perfect negative correlation (prices move opposite)
              </Text>
            </Col>
          </Row>
        </Card>
      </PageContainer>
    </ConfigProvider>
  );
}
