"use client";

import React from "react";
import { Row, Col, Space, Avatar } from "antd";
import {
  DatabaseOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
  BellOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { StatCard } from "@/components/ui/StatCard";
import { ForecastTrendChart } from "@/components/dashboard/ForecastTrendChart";
import { AlertDistributionChart } from "@/components/dashboard/AlertDistributionChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { getCachedUser } from "@/utils/auth";
import { useIsMobile } from "@/lib/responsive-utils";

export default function DashboardPage() {
  const { stats, loading, error, manualRetry } = useDashboardStats();
  const user = getCachedUser();
  const isMobile = useIsMobile();

  const statCards = [
    {
      title: "Datasets",
      value: stats?.datasets.total || 0,
      icon: <DatabaseOutlined />,
      trend: stats?.datasets.trend
        ? { value: Math.abs(stats.datasets.trend), isPositive: stats.datasets.trend > 0 }
        : undefined,
      variant: "primary" as const,
    },
    {
      title: "Time Series",
      value: stats?.timeseries.total || 0,
      icon: <LineChartOutlined />,
      trend: stats?.timeseries.trend
        ? { value: Math.abs(stats.timeseries.trend), isPositive: stats.timeseries.trend > 0 }
        : undefined,
      variant: "success" as const,
    },
    {
      title: "Forecasts",
      value: stats?.forecasts.total || 0,
      icon: <ThunderboltOutlined />,
      trend: stats?.forecasts.trend
        ? { value: Math.abs(stats.forecasts.trend), isPositive: stats.forecasts.trend > 0 }
        : undefined,
      variant: "warning" as const,
    },
    {
      title: "Alerts",
      value: stats?.alerts?.total || 0,
      icon: <BellOutlined />,
      trend: stats?.alerts?.trend
        ? { value: Math.abs(stats.alerts.trend), isPositive: stats.alerts.trend < 0 }
        : undefined,
      variant: ((stats?.alerts?.total || 0) > 0 ? "error" : "default") as "error" | "default",
    },
  ];

  return (
    <PageContainer>
      {/* Error Display */}
      {error && <ErrorDisplay error={error} retry={manualRetry} context="Dashboard" />}

      {/* Loading State with timeout */}
      <LoadingState loading={loading} timeout={15000}>
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-h1 font-display font-bold text-gray-900 dark:text-gray-50 mb-1">
              Welcome back, {user?.name || "User"}!
            </h1>
            <p className="text-body text-gray-600 dark:text-gray-400">
              Here's what's happening with your IoTDB Platform.
            </p>
          </div>
          <Avatar
            size={isMobile ? 40 : 48}
            src={user?.avatar}
            icon={<UserOutlined />}
            style={{ border: "2px solid #0066CC" }}
          />
        </div>

        {/* Stats Cards */}
        <Row
          gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
          style={{ marginBottom: isMobile ? 16 : 24 }}
          aria-live="polite"
          aria-atomic="true"
        >
          {statCards.map((stat, index) => (
            <Col xs={12} sm={12} md={6} key={index}>
              <StatCard {...stat} loading={loading} />
            </Col>
          ))}
        </Row>

        {/* Charts Row */}
        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <Col xs={24} lg={16}>
            <ForecastTrendChart loading={loading} />
          </Col>
          <Col xs={24} lg={8}>
            <AlertDistributionChart
              data={stats?.alerts.bySeverity}
              loading={loading}
            />
          </Col>
        </Row>

        {/* Activity and Actions Row */}
        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
          <Col xs={24} lg={16}>
            <RecentActivity
              recentAlerts={stats?.recentAlerts}
              recentForecasts={stats?.recentForecasts}
              loading={loading}
            />
          </Col>
          <Col xs={24} lg={8}>
            <QuickActions />
          </Col>
        </Row>

        {/* AI Model Status (Optional) */}
        {stats?.aiModels && (
          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginTop: isMobile ? 16 : 24 }}>
            <Col xs={24}>
              <div
                className="bg-primary rounded-lg p-5 sm:p-6 text-white"
              >
                <Space size="large" style={{ width: "100%", justifyContent: "space-between" }}>
                  <div>
                    <h3 className="text-h4 font-display font-bold text-white mb-1">
                      AI Models Status
                    </h3>
                    <p className="text-body text-white/85">
                      {stats.aiModels.active} of {stats.aiModels.total} models active
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="text-5xl font-display font-bold leading-none data-text">
                      {stats.aiModels.active}
                    </div>
                    <p className="text-body-sm text-white/85">
                      Active Models
                    </p>
                  </div>
                </Space>
              </div>
            </Col>
          </Row>
        )}
      </LoadingState>
    </PageContainer>
  );
}
