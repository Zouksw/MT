"use client";

import React from "react";
import { Alert, Typography, Space, Tag } from "antd";
import { WarningOutlined } from "@ant-design/icons";

const { Text, Link } = Typography;

export interface AnomalyAlert {
  id: string;
  timeseriesId: string;
  timeseriesName: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  score: number;
  timestamp: string;
}

interface AnomalyAlertBannerProps {
  anomalies: AnomalyAlert[];
  onViewDetails?: () => void;
}

const severityOrder: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export default function AnomalyAlertBanner({
  anomalies,
  onViewDetails,
}: AnomalyAlertBannerProps) {
  if (!anomalies.length) return null;

  const sorted = [...anomalies].sort(
    (a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
  );

  const criticalCount = sorted.filter(
    (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
  ).length;

  const alertType = criticalCount > 0 ? "error" : "warning";

  return (
    <Alert
      type={alertType}
      role="alert"
      aria-live="assertive"
      showIcon
      icon={<WarningOutlined />}
      style={{ marginBottom: 16 }}
      message={
        <Space>
          <Text strong>
            {anomalies.length} active anomaly{anomalies.length > 1 ? "ies" : "y"}
          </Text>
          {criticalCount > 0 && (
            <Tag color="red" style={{ marginLeft: 8 }}>
              {criticalCount} critical
            </Tag>
          )}
        </Space>
      }
      description={
        <div>
          <div style={{ marginBottom: 4 }}>
            {sorted.slice(0, 3).map((a) => (
              <div key={a.id}>
                <Tag
                  color={
                    a.severity === "CRITICAL"
                      ? "red"
                      : a.severity === "HIGH"
                      ? "orange"
                      : a.severity === "MEDIUM"
                      ? "gold"
                      : "blue"
                  }
                  style={{ fontSize: 11 }}
                >
                  {a.severity}
                </Tag>
                <Text style={{ fontSize: 13 }}>
                  {a.timeseriesName}: {a.message}
                </Text>
              </div>
            ))}
            {sorted.length > 3 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                +{sorted.length - 3} more
              </Text>
            )}
          </div>
          {onViewDetails && (
            <Link onClick={onViewDetails}>View details</Link>
          )}
        </div>
      }
    />
  );
}
