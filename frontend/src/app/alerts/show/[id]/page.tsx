"use client";

import React from "react";
import { Row, Col, Tag, Button, Space, Alert, Descriptions, Badge, Modal, message } from "antd";
import { ArrowLeftOutlined, BellOutlined, InfoCircleOutlined, WarningOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useGo } from "@refinedev/core";
import { useOne } from "@refinedev/core";
import { DateField } from "@refinedev/antd";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { authFetch } from "@/utils/auth";

interface AlertShowPageProps {
  params: Promise<{ id: string }>;
}

const SEVERITY_CONFIG = {
  INFO: {
    color: "blue",
    icon: <InfoCircleOutlined />,
    label: "Info",
  },
  WARNING: {
    color: "orange",
    icon: <WarningOutlined />,
    label: "Warning",
  },
  ERROR: {
    color: "red",
    icon: <CloseCircleOutlined />,
    label: "Error",
  },
};

const ALERT_TYPE_CONFIG = {
  ANOMALY: { label: "Anomaly Detection", icon: "🚨" },
  FORECAST_READY: { label: "Forecast Ready", icon: "📈" },
  SYSTEM: { label: "System Event", icon: "⚙️" },
  THRESHOLD: { label: "Threshold Breach", icon: "📊" },
};

export default function AlertShowPage({ params }: AlertShowPageProps) {
  const { id } = React.use(params);
  const go = useGo();

  const alertResult = useOne({
    resource: "alerts",
    id,
  });

  const alert = alertResult?.result?.data;
  const isLoading = alertResult?.query?.isLoading ?? false;

  if (isLoading) {
    return (
      <PageContainer>
        <ContentCard>
          <Alert message="Loading alert details..." type="info" />
        </ContentCard>
      </PageContainer>
    );
  }

  if (!alert) {
    return (
      <PageContainer>
        <ContentCard>
          <Alert message="Alert not found" type="error" />
        </ContentCard>
      </PageContainer>
    );
  }

  const severityConfig = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.INFO;
  const typeConfig = ALERT_TYPE_CONFIG[alert.type as keyof typeof ALERT_TYPE_CONFIG] || { label: alert.type, icon: "📢" };

  return (
    <PageContainer>
      <PageHeader
        title="Alert Details"
        description="View detailed information about this alert"
        actions={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => go({ to: "/alerts", type: "push" })}
          >
            Back to Alerts
          </Button>
        }
      />

      {/* Status Alert */}
      <Alert
        message={
          <Space>
            {typeConfig.icon} {typeConfig.label} - {severityConfig.label} Severity
          </Space>
        }
        description={alert.message || alert.description || "No description provided"}
        type={severityConfig.color === "blue" ? "info" : severityConfig.color === "orange" ? "warning" : "error"}
        showIcon
        icon={severityConfig.icon}
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[24, 24]}>
        {/* Main Details */}
        <Col xs={24} lg={16}>
          <ContentCard title="Alert Information" subtitle="Details about this alert">
            <Descriptions bordered column={{ xs: 1, sm: 2 }} size="middle">
              <Descriptions.Item label="Alert ID" span={2}>
                <code className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
                  {alert.id}
                </code>
              </Descriptions.Item>

              <Descriptions.Item label="Name" span={2}>
                <span className="font-semibold text-gray-900 dark:text-gray-50">{alert.name || "Unnamed Alert"}</span>
              </Descriptions.Item>

              <Descriptions.Item label="Type">
                <Tag icon={<BellOutlined />} color="blue">
                  {typeConfig.icon} {typeConfig.label}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Severity">
                <Tag
                  color={severityConfig.color}
                  icon={severityConfig.icon}
                  className="text-[13px] px-3 py-1"
                >
                  {severityConfig.label}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Status">
                <Badge
                  status={alert.isRead ? "default" : "processing"}
                  text={alert.isRead ? "Read" : "Unread"}
                />
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                <DateField value={alert.createdAt} format="YYYY-MM-DD HH:mm:ss" />
              </Descriptions.Item>

              {alert.timeseries && (
                <Descriptions.Item label="Time Series" span={2}>
                  <Space>
                    <span className="font-semibold text-gray-900 dark:text-gray-50">{alert.timeseries.name}</span>
                    {alert.timeseries.unit && (
                      <span className="text-body-sm text-gray-500 dark:text-gray-400">({alert.timeseries.unit})</span>
                    )}
                  </Space>
                </Descriptions.Item>
              )}

              {alert.description && (
                <Descriptions.Item label="Description" span={2}>
                  <p className="text-body mb-0">
                    {alert.description}
                  </p>
                </Descriptions.Item>
              )}
            </Descriptions>
          </ContentCard>
        </Col>

        {/* Side Panel */}
        <Col xs={24} lg={8}>
          {/* Quick Actions */}
          <ContentCard title="Quick Actions" subtitle="Available actions for this alert">
            <Space direction="vertical" style={{ width: "100%" }}>
              {!alert.isRead && (
                <Button
                  type="primary"
                  block
                  style={{
                    background: "#171717",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                  }}
                  onClick={async () => {
                    try {
                      const response = await authFetch(`/api/alerts/${id}/read`, { method: "PATCH" });
                      if (!response.ok) {
                        throw new Error("Failed to mark alert as read");
                      }
                      message.success("Alert marked as read");
                      alertResult.query?.refetch();
                    } catch {
                      message.error("Failed to mark alert as read");
                    }
                  }}
                >
                  Mark as Read
                </Button>
              )}
              <Button danger block onClick={() => {
                Modal.confirm({
                  title: "Delete Alert",
                  icon: <ExclamationCircleOutlined />,
                  content: "Are you sure you want to delete this alert? This action cannot be undone.",
                  okText: "Delete",
                  okType: "danger",
                  cancelText: "Cancel",
                  onOk: async () => {
                    try {
                      const response = await authFetch(`/api/alerts/${id}`, { method: "DELETE" });
                      if (!response.ok) {
                        throw new Error("Failed to delete alert");
                      }
                      message.success("Alert deleted");
                      go({ to: "/alerts", type: "push" });
                    } catch {
                      message.error("Failed to delete alert");
                    }
                  },
                });
              }}>
                Delete Alert
              </Button>
            </Space>
          </ContentCard>

          {/* Metadata Card */}
          <ContentCard title="Metadata" subtitle="Alert metadata" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Created At">
                <DateField value={alert.createdAt} format="YYYY-MM-DD HH:mm" />
              </Descriptions.Item>
              <Descriptions.Item label="Time">
                <DateField value={alert.createdAt} format="HH:mm:ss" />
              </Descriptions.Item>
            </Descriptions>
          </ContentCard>
        </Col>
      </Row>
    </PageContainer>
  );
}
