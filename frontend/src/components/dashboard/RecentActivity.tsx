"use client";

import React, { useState } from "react";
import { Card, Typography, List, Tag, Button, Space, Tabs, Empty } from "antd";
import {
  BellOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useGo } from "@refinedev/core";
import type { Alert, Forecast } from "@/types/api";

const { Title, Text } = Typography;

interface RecentActivityProps {
  recentAlerts?: Alert[];
  recentForecasts?: Forecast[];
  loading?: boolean;
}

export const RecentActivity = React.memo<RecentActivityProps>(function RecentActivity({
  recentAlerts = [],
  recentForecasts = [],
  loading = false,
}) {
  const go = useGo();
  const [activeTab, setActiveTab] = useState("alerts");

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "error";
      case "high":
        return "warning";
      case "medium":
        return "processing";
      case "low":
        return "default";
      default:
        return "default";
    }
  };

  const alertsItems = recentAlerts.slice(0, 5).map((alert: Alert) => ({
    id: alert.id,
    title: alert.message || "Alert",
    description: alert.message || "",
    severity: alert.severity,
    time: alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "Recently",
  }));

  const forecastsItems = recentForecasts.slice(0, 5).map((forecast: Forecast) => ({
    id: forecast.id,
    title: `Forecast for ${forecast.timeseriesId || "Time Series"}`,
    description: `Model: ${forecast.model?.name || "N/A"}`,
    status: forecast.model?.status || "completed",
    time: forecast.createdAt ? new Date(forecast.createdAt).toLocaleString() : "Recently",
  }));

  const renderAlertsList = () => {
    if (alertsItems.length === 0) {
      return <Empty description="No recent alerts" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <List
        itemLayout="horizontal"
        dataSource={alertsItems}
        renderItem={(item) => (
          <List.Item
            role="button"
            tabIndex={0}
            aria-label={`View alert: ${item.title}`}
            style={{ cursor: "pointer" }}
            onClick={() => go({ to: `/alerts/show/${item.id}`, type: "push" })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                go({ to: `/alerts/show/${item.id}`, type: "push" });
              }
            }}
          >
            <List.Item.Meta
              avatar={<BellOutlined style={{ fontSize: 20, color: "#1890ff" }} />}
              title={
                <Space size={8}>
                  <Text ellipsis style={{ maxWidth: 200 }}>{item.title}</Text>
                  <Tag color={getSeverityColor(item.severity)}>
                    {item.severity || "UNKNOWN"}
                  </Tag>
                </Space>
              }
              description={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.time}
                </Text>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  const renderForecastsList = () => {
    if (forecastsItems.length === 0) {
      return <Empty description="No recent forecasts" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <List
        itemLayout="horizontal"
        dataSource={forecastsItems}
        renderItem={(item) => (
          <List.Item
            role="button"
            tabIndex={0}
            aria-label={`View forecast: ${item.title}`}
            onClick={() => go({ to: "/forecasts", type: "push" })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                go({ to: "/forecasts", type: "push" });
              }
            }}
          >
            <List.Item.Meta
              avatar={<ThunderboltOutlined style={{ fontSize: 20, color: "#722ed1" }} />}
              title={
                <Space size={8}>
                  <Text ellipsis style={{ maxWidth: 200 }}>{item.title}</Text>
                  <Tag color="purple">{item.status}</Tag>
                </Space>
              }
              description={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.description} • {item.time}
                </Text>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  const tabItems = [
    {
      key: "alerts",
      label: (
        <span>
          <BellOutlined /> Alerts
        </span>
      ),
      children: renderAlertsList(),
    },
    {
      key: "forecasts",
      label: (
        <span>
          <ThunderboltOutlined /> Forecasts
        </span>
      ),
      children: renderForecastsList(),
    },
  ];

  return (
    <Card
      loading={loading}
      variant="borderless"
      style={{ height: "100%" }}
      styles={{ body: { padding: "16px" } }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={5} style={{ fontSize: "16px", margin: 0 }}>
          Recent Activity
        </Title>
        <Button
          type="link"
          size="small"
          icon={<RightOutlined />}
          onClick={() => {
            if (activeTab === "alerts") {
              go({ to: "/alerts", type: "push" });
            } else {
              go({ to: "/forecasts", type: "push" });
            }
          }}
        >
          View All
        </Button>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="small"
      />
    </Card>
  );
}, (prevProps, nextProps) => {
  // Memoize to prevent re-renders when parent updates
  return (
    prevProps.recentAlerts === nextProps.recentAlerts &&
    prevProps.recentForecasts === nextProps.recentForecasts &&
    prevProps.loading === nextProps.loading
  );
});
RecentActivity.displayName = 'RecentActivity';

export default RecentActivity;
