"use client";

import React from "react";
import {
  ThunderboltOutlined,
  LineChartOutlined,
  AlertOutlined,
  ApiOutlined,
  LockOutlined,
  ExperimentOutlined,
  FundOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";

const features = [
  {
    icon: <ThunderboltOutlined />,
    title: "High Performance",
    description:
      "Handle millions of data points per second with sub-millisecond query latency. Optimized for high-throughput IoT workloads.",
    details: ["Sub-ms queries", "1M+ points/sec", "Columnar storage"],
    color: "bg-primary",
  },
  {
    icon: <LineChartOutlined />,
    title: "Real-Time Analytics",
    description:
      "Monitor and analyze your time series data in real-time with powerful visualization tools and customizable dashboards.",
    details: ["Live streaming", "Custom dashboards", "Aggregations"],
    color: "bg-indigo-500",
  },
  {
    icon: <ExperimentOutlined />,
    title: "AI Forecasting",
    description:
      "Multiple ML algorithms including ARIMA, Prophet, LSTM, and Transformer models for accurate time series predictions.",
    details: ["ARIMA, Prophet, LSTM", "Confidence intervals", "Model compare"],
    color: "bg-violet-500",
  },
  {
    icon: <AlertOutlined />,
    title: "Anomaly Detection",
    description:
      "AI-powered anomaly detection identifies unusual patterns automatically. Statistical and ML-based detection methods.",
    details: ["Real-time alerts", "Multiple algorithms", "Severity scoring"],
    color: "bg-sky-500",
  },
  {
    icon: <LockOutlined />,
    title: "Enterprise Security",
    description:
      "End-to-end encryption, role-based access control (RBAC), API key management, and secure session handling.",
    details: ["256-bit encryption", "JWT authentication", "Audit logs"],
    color: "bg-emerald-500",
  },
  {
    icon: <ApiOutlined />,
    title: "RESTful API",
    description:
      "Easy-to-use REST API for seamless integration with your existing applications. Full CRUD operations and query capabilities.",
    details: ["OpenAPI spec", "SDK support", "Webhook alerts"],
    color: "bg-cyan-500",
  },
];

const metrics = [
  { value: "10M+", label: "Data Points/Second", icon: <ThunderboltOutlined /> },
  { value: "<1ms", label: "Query Latency", icon: <LineChartOutlined /> },
  { value: "99.99%", label: "Uptime SLA", icon: <FundOutlined /> },
  { value: "10x", label: "Compression Ratio", icon: <DatabaseOutlined /> },
];

/**
 * Features Section — Tailwind-first, no inline styles
 */
export const Features: React.FC = () => {
  return (
    <section id="features" className="bg-white dark:bg-gray-900 px-6 py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16 lg:mb-20">
          <div className="mb-4 inline-block rounded border border-primary/20 bg-primary/8 px-4 py-1.5">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Features
            </span>
          </div>
          <h2 className="font-display text-3xl font-semibold text-gray-900 dark:text-white md:text-4xl lg:text-5xl">
            Everything You Need
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-gray-500 dark:text-gray-400">
            Enterprise-grade features for modern time series applications
          </p>
        </div>

        {/* Metrics */}
        <div className="mb-16 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 lg:mb-20">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="group rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,#fafafa_0px_0px_0px_1px] dark:shadow-[rgba(255,255,255,0.08)_0px_0px_0px_1px,rgba(255,255,255,0.04)_0px_2px_2px] bg-white dark:bg-gray-800/50 p-5 md:p-7 text-center transition-all duration-300 hover:shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.06)_0px_4px_4px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary md:h-12 md:w-12">
                <span className="text-lg md:text-xl">{metric.icon}</span>
              </div>
              <div className="font-mono text-2xl font-semibold text-primary md:text-3xl">
                {metric.value}
              </div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,#fafafa_0px_0px_0px_1px] dark:shadow-[rgba(255,255,255,0.08)_0px_0px_0px_1px,rgba(255,255,255,0.04)_0px_2px_2px] bg-white dark:bg-gray-800/50 p-5 md:p-6 transition-all duration-300 hover:shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.06)_0px_4px_4px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg text-xl text-white ${feature.color} transition-transform duration-200 group-hover:scale-110`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {feature.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {feature.details.map((detail, idx) => (
                  <span
                    key={idx}
                    className="data-text rounded-md bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {detail}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
