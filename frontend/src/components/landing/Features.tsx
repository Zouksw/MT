"use client";

import React from "react";
import { Row, Col, Typography, Card } from "antd";
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

const { Title, Paragraph, Text } = Typography;

const features = [
  {
    icon: <ThunderboltOutlined />,
    title: "High Performance",
    description: "Handle millions of data points per second with sub-millisecond query latency. Optimized for high-throughput IoT workloads.",
    details: ["Sub-millisecond queries", "Million+ points/second", "Columnar storage"],
    gradient: "purple" as const,
  },
  {
    icon: <LineChartOutlined />,
    title: "Real-Time Analytics",
    description: "Monitor and analyze your time series data in real-time with powerful visualization tools and customizable dashboards.",
    details: ["Live data streaming", "Custom dashboards", "Advanced aggregations"],
    gradient: "blue" as const,
  },
  {
    icon: <ExperimentOutlined />,
    title: "AI Forecasting",
    description: "Multiple ML algorithms including ARIMA, Prophet, LSTM, and Transformer models for accurate time series predictions.",
    details: ["ARIMA, Prophet, LSTM", "Confidence intervals", "Model comparison"],
    gradient: "purple" as const,
  },
  {
    icon: <AlertOutlined />,
    title: "Anomaly Detection",
    description: "AI-powered anomaly detection identifies unusual patterns automatically. Statistical and ML-based detection methods.",
    details: ["Real-time alerts", "Multiple algorithms", "Severity scoring"],
    gradient: "blue" as const,
  },
  {
    icon: <LockOutlined />,
    title: "Enterprise Security",
    description: "End-to-end encryption, role-based access control (RBAC), API key management, and secure session handling.",
    details: ["256-bit encryption", "JWT authentication", "SOC 2 compliant"],
    gradient: "purple" as const,
  },
  {
    icon: <ApiOutlined />,
    title: "RESTful API",
    description: "Easy-to-use REST API for seamless integration with your existing applications. Full CRUD operations and query capabilities.",
    details: ["OpenAPI spec", "SDK support", "Webhook alerts"],
    gradient: "sunset" as const,
  },
];

const metrics = [
  { value: "10M+", label: "Data Points/Second", icon: <ThunderboltOutlined /> },
  { value: "<1ms", label: "Query Latency", icon: <LineChartOutlined /> },
  { value: "99.99%", label: "Uptime SLA", icon: <FundOutlined /> },
  { value: "10x", label: "Compression Ratio", icon: <DatabaseOutlined /> },
];

const featureColors = {
  purple: "#0066CC",
  blue: "#3B82F6",
  sunset: "#0EA5E9",
};

/**
 * Features Section - Showcase key product features
 */
export const Features: React.FC = () => {
  return (
    <section
      id="features"
      style={{
        padding: "clamp(40px, 6vw, 100px) 24px",
        background: "#FFFFFF",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "clamp(32px, 5vw, 60px)" }}>
          <div
            style={{
              display: "inline-block",
              padding: "clamp(4px, 1vw, 8px) clamp(12px, 2vw, 20px)",
              background: "rgba(0, 102, 204, 0.08)",
              borderRadius: "3px",
              marginBottom: "clamp(10px, 2vw, 16px)",
            }}
          >
            <Text
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#0066CC",
              }}
            >
              FEATURES
            </Text>
          </div>
          <Title
            level={2}
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 600,
              lineHeight: 1.25,
              marginBottom: "16px",
              color: "#111827",
            }}
          >
            Everything You Need
          </Title>
          <Paragraph
            style={{
              fontSize: "clamp(15px, 2.2vw, 18px)",
              color: "#64748b",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            Enterprise-grade features for modern time series applications
          </Paragraph>
        </div>

        {/* Metrics Section */}
        <Row gutter={[12, 12]} style={{ marginBottom: "clamp(32px, 5vw, 60px)" }}>
          {metrics.map((metric, index) => (
            <Col xs={12} sm={12} lg={6} key={index}>
              <div
                style={{
                  padding: "clamp(16px, 3vw, 28px) clamp(12px, 3vw, 20px)",
                  borderRadius: "6px",
                  background: "#fff",
                  border: "1px solid #f1f5f9",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
                  textAlign: "center",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(0, 102, 204, 0.15)";
                  e.currentTarget.style.borderColor = "#0066cc30";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.05)";
                  e.currentTarget.style.borderColor = "#f1f5f9";
                }}
              >
                <div
                  style={{
                    width: "clamp(36px, 5vw, 48px)",
                    height: "clamp(36px, 5vw, 48px)",
                    borderRadius: "4px",
                    background: "rgba(0, 102, 204, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto clamp(10px, 2vw, 16px)",
                  }}
                >
                  <span style={{
                    fontSize: "22px",
                    color: "#0066cc",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {metric.icon}
                  </span>
                </div>
                <Text
                  style={{
                    fontSize: "32px",
                    fontWeight: 700,
                    color: "#0066CC",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  {metric.value}
                </Text>
                <Text style={{ fontSize: "14px", color: "#64748b" }}>
                  {metric.label}
                </Text>
              </div>
            </Col>
          ))}
        </Row>

        {/* Features Grid */}
        <Row gutter={[12, 12]}>
          {features.map((feature, index) => (
            <Col xs={24} sm={12} lg={8} key={index}>
              <Card
                style={{
                  height: "100%",
                  padding: "clamp(12px, 2.5vw, 24px)",
                  background: "#fff",
                  border: "1px solid #f1f5f9",
                  borderRadius: "8px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = `0 12px 40px ${feature.gradient === "purple" ? "rgba(0, 102, 204, 0.2)" : feature.gradient === "blue" ? "rgba(59, 130, 246, 0.2)" : "rgba(79, 172, 254, 0.2)"}`;
                  e.currentTarget.style.borderColor = featureColors[feature.gradient];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.12)";
                  e.currentTarget.style.borderColor = "#f1f5f9";
                }}
              >
                <div
                  style={{
                    width: "clamp(40px, 5vw, 56px)",
                    height: "clamp(40px, 5vw, 56px)",
                    borderRadius: "4px",
                    background: featureColors[feature.gradient],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "clamp(12px, 2vw, 20px)",
                    fontSize: "clamp(18px, 2.5vw, 24px)",
                    color: "#fff",
                  }}
                >
                  {feature.icon}
                </div>
                <Title level={4} style={{ marginBottom: "clamp(8px, 1.5vw, 12px)", fontSize: "clamp(16px, 2.2vw, 18px)" }}>
                  {feature.title}
                </Title>
                <Paragraph style={{ color: "#64748b", marginBottom: "clamp(10px, 2vw, 16px)", lineHeight: 1.5, fontSize: "clamp(13px, 2vw, 14px)" }}>
                  {feature.description}
                </Paragraph>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {feature.details.map((detail, idx) => (
                    <Text
                      key={idx}
                      style={{
                        fontSize: "12px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "rgba(0, 102, 204, 0.08)",
                        color: "#0066cc",
                        fontWeight: 500,
                      }}
                    >
                      {detail}
                    </Text>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};

export default Features;
