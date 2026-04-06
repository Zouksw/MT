"use client";

import React, { useState } from "react";
import { Card, Typography, List, Tag, Button, Space, Tabs, Empty } from "antd";
import {
  BellOutlined,
  ThunderboltOutlined,
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
      case "critical": return "error";
      case "high": return "warning";
      case "medium": return "processing";
      case "low": return "default";
      default: return "default";
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
        renderItem={(item, i) => (
          <List.Item
            role="button"
            tabIndex={0}
            aria-label={`View alert: ${item.title}`}
            className="stagger-slide-up cursor-pointer !transition-all !duration-200 hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06] hover:pl-1 rounded-md"
            style={{ animationDelay: `${i * 50}ms` }}
            onClick={() => go({ to: `/alerts/show/${item.id}`, type: "push" })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                go({ to: `/alerts/show/${item.id}`, type: "push" });
              }
            }}
          >
            <List.Item.Meta
              avatar={
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <BellOutlined className="text-base text-primary" />
                </div>
              }
              title={
                <Space size={8}>
                  <Text ellipsis className="!max-w-[200px] !text-sm">{item.title}</Text>
                  <Tag color={getSeverityColor(item.severity)} className="!text-xs">
                    {item.severity || "UNKNOWN"}
                  </Tag>
                </Space>
              }
              description={
                <Text type="secondary" className="!text-xs">{item.time}</Text>
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
        renderItem={(item, i) => (
          <List.Item
            role="button"
            tabIndex={0}
            aria-label={`View forecast: ${item.title}`}
            className="stagger-slide-up cursor-pointer !transition-all !duration-200 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 hover:pl-1 rounded-md"
            style={{ animationDelay: `${i * 50}ms` }}
            onClick={() => go({ to: "/forecasts", type: "push" })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                go({ to: "/forecasts", type: "push" });
              }
            }}
          >
            <List.Item.Meta
              avatar={
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
                  <ThunderboltOutlined className="text-base text-purple-500" />
                </div>
              }
              title={
                <Space size={8}>
                  <Text ellipsis className="!max-w-[200px] !text-sm">{item.title}</Text>
                  <Tag color="purple" className="!text-xs">{item.status}</Tag>
                </Space>
              }
              description={
                <Text type="secondary" className="!text-xs">{item.description} &middot; {item.time}</Text>
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
        <span><BellOutlined /> Alerts</span>
      ),
      children: renderAlertsList(),
    },
    {
      key: "forecasts",
      label: (
        <span><ThunderboltOutlined /> Forecasts</span>
      ),
      children: renderForecastsList(),
    },
  ];

  return (
    <Card
      loading={loading}
      variant="borderless"
      className="!h-full"
      styles={{ body: { padding: "16px" } }}
    >
      <div className="flex items-center justify-between mb-4">
        <Title level={5} className="!text-base !mb-0">
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
  return (
    prevProps.recentAlerts === nextProps.recentAlerts &&
    prevProps.recentForecasts === nextProps.recentForecasts &&
    prevProps.loading === nextProps.loading
  );
});
RecentActivity.displayName = 'RecentActivity';

export default RecentActivity;
