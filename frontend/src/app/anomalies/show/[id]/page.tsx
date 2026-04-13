/**
 * Anomaly Detail Page
 *
 * Displays detailed information about a specific anomaly including:
 * - Anomaly metadata (severity, status, detection method)
 * - Context and related time series
 * - Visualization of the anomalous data point
 * - Resolution actions
 */

"use client";

import React, { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Statistic,
  Tag,
  Button,
  Space,
  Descriptions,
  Alert,
  Timeline,
  Card,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { Anomaly } from "@/types/api";
import { authFetch } from "@/utils/auth";
import { DetailPageLayout, DetailSection } from "@/components/layout/DetailPageLayout";
import { useIsMobile } from "@/lib/responsive-utils";

interface AnomalyDetailParams {
  id: string;
}

interface AnomalyWithDetails extends Omit<Anomaly, 'timeseries'> {
  timeseries?: {
    id: string;
    name: string;
    path: string;
  };
  detectedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  detectionMethod?: string;
  threshold?: number;
  actualValue?: number;
  normalRange?: {
    min: number;
    max: number;
  };
}

export default function AnomalyDetailPage({ params }: { params: Promise<AnomalyDetailParams> }) {
  const { id } = use(params);
  const router = useRouter();
  const [anomaly, setAnomaly] = useState<AnomalyWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchAnomaly = useCallback(async () => {
    if (!id) {
      setError("Anomaly ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch(`/api/anomalies/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch anomaly");
      }
      const data = await response.json();
      setAnomaly(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnomaly();
  }, [fetchAnomaly]);

  const handleResolve = async () => {
    try {
      const response = await authFetch(`/api/anomalies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      if (!response.ok) {
        throw new Error("Failed to resolve anomaly");
      }
      message.success("Anomaly resolved successfully");
      fetchAnomaly();
    } catch {
      message.error("Failed to resolve anomaly");
    }
  };

  const handleDismiss = async () => {
    try {
      const response = await authFetch(`/api/anomalies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      if (!response.ok) {
        throw new Error("Failed to dismiss anomaly");
      }
      message.success("Anomaly dismissed");
      fetchAnomaly();
    } catch {
      message.error("Failed to dismiss anomaly");
    }
  };

  if (loading) {
    return (
      <DetailPageLayout
        title="Anomaly Details"
        loading={loading}
      />
    );
  }

  if (error || !anomaly) {
    return (
      <DetailPageLayout
        title="Anomaly"
        error={error || "Anomaly not found"}
      />
    );
  }

  const breadcrumb = [
    { label: "Anomalies", href: "/anomalies" },
    { label: `Anomaly #${anomaly.id.substring(0, 8)}` }
  ];

  const severityColors: Record<string, string> = {
    low: "green",
    medium: "orange",
    high: "red"
  };

  const severityIcons: Record<string, React.ReactNode> = {
    low: <ExclamationCircleOutlined />,
    medium: <WarningOutlined />,
    high: <WarningOutlined />
  };

  const actions = [
    ...(anomaly.isResolved !== true ? [{
      icon: <CheckCircleOutlined />,
      label: "Resolve",
      onClick: handleResolve
    }] : []),
    {
      icon: <CloseCircleOutlined />,
      label: "Dismiss",
      onClick: handleDismiss
    }
  ];

  return (
    <DetailPageLayout
      title={`Anomaly #${anomaly.id.substring(0, 8)}`}
      subtitle={`Detected ${anomaly.detectedAt ? new Date(anomaly.detectedAt).toLocaleString() : "Recently"}`}
      breadcrumb={breadcrumb}
      actions={actions}
    >
      {/* Severity and Status Card */}
      <DetailSection title="Anomaly Status" colSpan={isMobile ? 24 : 8}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Severity">
            <Tag
              color={severityColors[anomaly.severity]}
              icon={severityIcons[anomaly.severity]}
            >
              {anomaly.severity.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={anomaly.isResolved === true ? "success" : "processing"}>
              {anomaly.isResolved ? "RESOLVED" : "OPEN"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Detection Method">
            {anomaly.detectionMethod || "statistical"}
          </Descriptions.Item>
        </Descriptions>

        {anomaly.isResolved === true && anomaly.resolvedAt && (
          <Alert
            message={`Resolved by ${anomaly.resolvedBy || "Admin"}`}
            description={anomaly.resolutionNote || "No resolution note provided"}
            type="success"
            showIcon
            style={{ marginTop: "16px" }}
          />
        )}
      </DetailSection>

      {/* Context Card */}
      <DetailSection title="Anomaly Context" colSpan={isMobile ? 24 : 16}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {anomaly.timeseries && (
            <Card size="small" title="Time Series">
              <Space>
                <LineChartOutlined />
                <span className="font-semibold text-gray-900 dark:text-gray-50">{anomaly.timeseries.name}</span>
                <span className="text-body-sm text-gray-500 dark:text-gray-400">({anomaly.timeseries.path})</span>
              </Space>
            </Card>
          )}

          {anomaly.actualValue !== undefined && (
            <Card size="small" title="Detected Value">
              <Statistic
                value={anomaly.actualValue}
                precision={4}
                valueStyle={{
                  color: anomaly.severity === "high" ? "#ef4444" : "#f59e0b"
                }}
                suffix={
                  anomaly.threshold ? `/ ${anomaly.threshold}` : ""
                }
              />
            </Card>
          )}

          {anomaly.normalRange && (
            <Card size="small" title="Normal Range">
              <Space>
                <span className="text-body data-text">Min: {anomaly.normalRange.min.toFixed(4)}</span>
                <span className="text-body data-text">Max: {anomaly.normalRange.max.toFixed(4)}</span>
              </Space>
            </Card>
          )}
        </Space>
      </DetailSection>

      {/* Visualization */}
      <DetailSection title="Data Visualization" colSpan={24}>
        <Alert
          message="Chart showing the anomaly in context"
          description="The anomalous data point will be highlighted on the chart"
          type="info"
          showIcon
          style={{ marginBottom: "16px" }}
        />
        <div className="h-[300px] flex items-center justify-center bg-error/5 rounded-lg border border-dashed border-error/30">
          <WarningOutlined className="text-[48px] text-error mr-4" />
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-50">Anomaly Visualization</span>
            <br />
            <span className="text-body-sm text-gray-500 dark:text-gray-400">Chart will display the anomalous data point</span>
          </div>
        </div>
      </DetailSection>

      {/* Timeline */}
      <DetailSection title="Event Timeline" colSpan={24}>
        <Timeline
          items={[
            {
              color: "red",
              dot: <ExclamationCircleOutlined />,
              children: (
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-50">Anomaly Detected</span>
                  <br />
                  <span className="text-body-sm text-gray-500 dark:text-gray-400">
                    {anomaly.detectedAt
                      ? new Date(anomaly.detectedAt).toLocaleString()
                      : "Recently"}
                  </span>
                </div>
              )
            },
            ...(anomaly.isResolved === true ? [{
              color: "green",
              dot: <CheckCircleOutlined />,
              children: (
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-50">Anomaly Resolved</span>
                  <br />
                  <span className="text-body-sm text-gray-500 dark:text-gray-400">
                    {anomaly.resolvedAt
                      ? new Date(anomaly.resolvedAt).toLocaleString()
                      : "Recently"}
                  </span>
                  {anomaly.resolutionNote && (
                    <>
                      <br />
                      <span className="text-body-sm text-gray-500 dark:text-gray-400">{anomaly.resolutionNote}</span>
                    </>
                  )}
                </div>
              )
            }] : [])
          ]}
        />
      </DetailSection>

      {/* Actions */}
      <DetailSection title="Quick Actions" colSpan={24}>
        <Space wrap>
          {anomaly.timeseries && (
            <Button
              icon={<LineChartOutlined />}
              onClick={() => anomaly.timeseries && router.push(`/timeseries?path=${anomaly.timeseries.path}`)}
            >
              View Time Series
            </Button>
          )}
          <Button
            icon={<ClockCircleOutlined />}
            onClick={() => router.push("/anomalies")}
          >
            View Related Anomalies
          </Button>
        </Space>
      </DetailSection>
    </DetailPageLayout>
  );
}
