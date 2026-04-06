"use client";

import { Row, Col, Avatar } from "antd";
import {
  DatabaseOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
  BellOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { StatCard } from "@/components/ui/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import dynamic from "next/dynamic";

// Lazy load heavy chart components (recharts adds ~200KB)
const ForecastTrendChart = dynamic(
  () => import("@/components/dashboard/ForecastTrendChart").then(mod => ({ default: mod.ForecastTrendChart })),
  { loading: () => <div style={{ height: 300, background: "#f5f5f5", borderRadius: 8 }} /> }
);
const AlertDistributionChart = dynamic(
  () => import("@/components/dashboard/AlertDistributionChart").then(mod => ({ default: mod.AlertDistributionChart })),
  { loading: () => <div style={{ height: 300, background: "#f5f5f5", borderRadius: 8 }} /> }
);
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
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-h1 font-display font-bold text-gray-900 dark:text-gray-50">
                Welcome back, {user?.name || "User"}!
              </h1>
              {/* System Health Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </div>
                <span className="text-xs font-medium text-green-700 dark:text-green-400">Healthy</span>
              </div>
            </div>
            <p className="text-body text-gray-600 dark:text-gray-400">
              Here&apos;s what&apos;s happening with your IoTDB Platform.
            </p>
          </div>
          <Avatar
            size={isMobile ? 40 : 48}
            src={user?.avatar}
            icon={<UserOutlined />}
            className="border-2 border-primary"
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

        {/* AI Model Status — Gradient Card with Shimmer */}
        {stats?.aiModels && (
          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginTop: isMobile ? 16 : 24 }}>
            <Col xs={24}>
              <div
                className="rounded-lg p-5 sm:p-6 text-white relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0066CC 0%, #0077E6 50%, #3B82F6 100%)" }}
              >
                {/* Floating decorative dots */}
                <div className="absolute top-4 right-12 w-16 h-16 rounded-full bg-white/5" style={{ animation: "float 6s ease-in-out infinite" }} />
                <div className="absolute bottom-6 right-32 w-8 h-8 rounded-full bg-white/5" style={{ animation: "float 8s ease-in-out 2s infinite" }} />
                <div className="absolute top-8 left-1/2 w-6 h-6 rounded-full bg-white/5" style={{ animation: "float 7s ease-in-out 1s infinite" }} />

                <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" fill="white" fillOpacity="0.8" />
                      </svg>
                      <h3 className="text-h4 font-display font-bold text-white mb-0">
                        AI Models Status
                      </h3>
                    </div>
                    <p className="text-body text-white/85">
                      {stats.aiModels.active} of {stats.aiModels.total} models active
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    {/* Active/Inactive dot indicators */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      {Array.from({ length: stats.aiModels.total }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                            i < stats.aiModels.active ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]" : "bg-white/20"
                          }`}
                        />
                      ))}
                    </div>
                    <div>
                      <div className="text-4xl font-display font-bold leading-none data-text">
                        {stats.aiModels.active}
                      </div>
                      <p className="text-body-sm text-white/85 mt-1">
                        Active Models
                      </p>
                    </div>
                  </div>
                </div>
                {/* Progress bar with shimmer */}
                <div className="relative mt-4 h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/80 transition-all duration-700 ease-out"
                    style={{ width: `${stats.aiModels.total > 0 ? (stats.aiModels.active / stats.aiModels.total) * 100 : 0}%` }}
                  />
                  <div className="absolute inset-0 shimmer-slide" />
                </div>
              </div>
            </Col>
          </Row>
        )}
      </LoadingState>
    </PageContainer>
  );
}
