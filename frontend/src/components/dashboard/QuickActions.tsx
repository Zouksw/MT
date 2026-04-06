"use client";

import React from "react";
import { Card, Typography, Row, Col } from "antd";
import {
  DatabaseOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Title } = Typography;

interface QuickAction {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  primary?: boolean;
}

const quickActions: QuickAction[] = [
  {
    key: "create-timeseries",
    title: "New Time Series",
    description: "Create a new time series",
    icon: <DatabaseOutlined />,
    path: "/timeseries",
    primary: true,
  },
  {
    key: "create-forecast",
    title: "New Forecast",
    description: "Generate AI predictions",
    icon: <ThunderboltOutlined />,
    path: "/forecasts/create",
  },
  {
    key: "view-alerts",
    title: "View Alerts",
    description: "Check active alerts",
    icon: <EyeOutlined />,
    path: "/alerts",
  },
  {
    key: "detect-anomalies",
    title: "Detect Anomalies",
    description: "Run anomaly detection",
    icon: <ExperimentOutlined />,
    path: "/ai/anomalies",
  },
];

export const QuickActions: React.FC = () => {
  const router = useRouter();

  return (
    <Card
      variant="borderless"
      styles={{ body: { padding: "16px" } }}
    >
      <Title level={5} className="!text-base !mb-4">
        Quick Actions
      </Title>
      <Row gutter={[12, 12]}>
        {quickActions.map((action, i) => (
          <Col xs={12} sm={12} md={12} lg={12} key={action.key}>
            <button
              onClick={() => router.push(action.path)}
              className={`
                group relative w-full flex items-center gap-3 p-4 rounded-lg
                text-left transition-all duration-200
                stagger-slide-up
                ${action.primary
                  ? "bg-primary text-white hover:bg-primary-hover shadow-[0_1px_3px_rgba(0,102,204,0.2)] hover:shadow-[0_4px_12px_rgba(0,102,204,0.3)] hover:-translate-y-0.5 pulse-glow"
                  : "bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
                }
              `}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${
                action.primary
                  ? "bg-white/20"
                  : "bg-gray-50 dark:bg-gray-700 text-primary"
              }`}>
                <span className="text-lg">{action.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className={`font-semibold text-sm leading-tight ${!action.primary ? "text-gray-900 dark:text-white" : ""}`}>
                  {action.title}
                </div>
                <div className={`text-xs mt-0.5 ${action.primary ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
                  {action.description}
                </div>
              </div>
            </button>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default QuickActions;
