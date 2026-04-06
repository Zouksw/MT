"use client";

import React from "react";
import { DevtoolsProvider } from "@/providers/devtools";
import { useNotificationProvider } from "@refinedev/antd";
import { Refine } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import routerProvider from "@refinedev/nextjs-router";
import { App as AntdApp } from "antd";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";
import { ToastProvider } from "@/components/ui/Toast";
import { ColorModeContextProvider } from "@/contexts/color-mode";
import { authProviderClient } from "@/providers/auth-provider/auth-provider.client";
import { dataProvider } from "@/providers/data-provider";
import {
  DashboardOutlined,
  LineChartOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  RocketOutlined,
  BellOutlined,
  KeyOutlined,
  SettingOutlined,
} from "@ant-design/icons";

export default function AppProviders({
  children,
  defaultMode,
}: {
  children: React.ReactNode;
  defaultMode?: string;
}) {
  return (
    <AntdApp>
      <ToastProvider>
        <RefineKbarProvider>
          <ColorModeContextProvider defaultMode={defaultMode}>
            <DevtoolsProvider>
              <Refine
                routerProvider={routerProvider}
                dataProvider={dataProvider}
                notificationProvider={useNotificationProvider}
                authProvider={authProviderClient}
                resources={[
                  {
                    name: "dashboard",
                    list: "/dashboard",
                    meta: {
                      canDelete: false,
                      label: "Dashboard",
                      icon: <DashboardOutlined aria-label="Dashboard" />,
                    },
                  },
                  {
                    name: "timeseries",
                    list: "/timeseries",
                    create: "/timeseries/create",
                    meta: {
                      canDelete: true,
                      label: "Time Series",
                      icon: <LineChartOutlined aria-label="LineChart" />,
                    },
                  },
                  {
                    name: "forecasts",
                    list: "/forecasts",
                    create: "/forecasts/create",
                    meta: {
                      canDelete: true,
                      label: "Forecasts",
                      icon: <LineChartOutlined aria-label="LineChart" />,
                    },
                  },
                  {
                    name: "anomalies",
                    list: "/anomalies",
                    create: "/anomalies/create",
                    meta: {
                      canDelete: true,
                      label: "Anomalies",
                      icon: <AlertOutlined aria-label="Alert" />,
                    },
                  },
                  {
                    name: "ai-models",
                    list: "/ai/models",
                    meta: {
                      canDelete: false,
                      label: "AI Models",
                      icon: <ThunderboltOutlined aria-label="Thunderbolt" />,
                    },
                  },
                  {
                    name: "ai-anomalies",
                    list: "/ai/anomalies",
                    meta: {
                      canDelete: false,
                      label: "AI Anomaly Detection",
                      icon: <EyeOutlined aria-label="Eye" />,
                    },
                  },
                  {
                    name: "ai-predict",
                    list: "/ai/predict",
                    meta: {
                      canDelete: false,
                      label: "AI Prediction",
                      icon: <RocketOutlined aria-label="Rocket" />,
                    },
                  },
                  {
                    name: "alerts",
                    list: "/alerts",
                    create: "/alerts/create",
                    meta: {
                      canDelete: true,
                      label: "Alerts",
                      icon: <BellOutlined aria-label="Bell" />,
                    },
                  },
                  {
                    name: "alert-rules",
                    list: "/alerts/rules",
                    meta: {
                      canDelete: false,
                      label: "Alert Rules",
                      icon: <AlertOutlined aria-label="Alert" />,
                    },
                  },
                  {
                    name: "apikeys",
                    list: "/apikeys",
                    create: "/apikeys/create",
                    meta: {
                      canDelete: true,
                      label: "API Keys",
                      icon: <KeyOutlined aria-label="Key" />,
                    },
                  },
                  {
                    name: "settings",
                    list: "/settings",
                    meta: {
                      canDelete: false,
                      label: "Settings",
                      icon: <SettingOutlined aria-label="Settings" />,
                    },
                  },
                ]}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  disableTelemetry: true,
                }}
              >
                <main id="main-content">
                  <ErrorBoundaryWrapper>
                    {children}
                  </ErrorBoundaryWrapper>
                </main>
                <RefineKbar />
              </Refine>
            </DevtoolsProvider>
          </ColorModeContextProvider>
        </RefineKbarProvider>
      </ToastProvider>
    </AntdApp>
  );
}
