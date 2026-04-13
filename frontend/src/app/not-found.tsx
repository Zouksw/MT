"use client";

import React from "react";
import { Button, Typography } from "antd";
import { useRouter } from "next/navigation";
import {
  FileSearchOutlined,
  HomeOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
        padding: "24px",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "600px",
          textAlign: "center",
        }}
      >
        {/* 404 Number */}
        <div
          style={{
            fontSize: "clamp(120px, 20vw, 200px)",
            fontWeight: 900,
            color: "rgba(10, 114, 239, 0.1)",
            lineHeight: 1,
            marginBottom: "-20px",
            userSelect: "none",
          }}
        >
          404
        </div>

        {/* Icon */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "24px",
            background: "#f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 32px",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
          }}
        >
          <FileSearchOutlined style={{ fontSize: "50px", color: "#0a72ef" }} />
        </div>

        {/* Title */}
        <Title
          level={1}
          style={{
            color: "#171717",
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 600,
            marginBottom: "16px",
            lineHeight: 1.2,
          }}
        >
          Page Not Found
        </Title>

        {/* Description */}
        <Paragraph
          style={{
            fontSize: "18px",
            color: "#525252",
            marginBottom: "40px",
            lineHeight: 1.6,
          }}
        >
          Sorry, we couldn&apos;t find the page you&apos;re looking for. The page
          might have been removed or is temporarily unavailable.
        </Paragraph>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Button
            type="primary"
            size="large"
            icon={<HomeOutlined />}
            style={{
              height: "48px",
              padding: "0 32px",
              fontSize: "16px",
              fontWeight: 600,
              borderRadius: "8px",
              background: "#0a72ef",
              color: "#fff",
              border: "none",
            }}
            onClick={() => router.push("/")}
          >
            Go Home
          </Button>
          <Button
            size="large"
            icon={<ArrowLeftOutlined />}
            style={{
              height: "48px",
              padding: "0 32px",
              fontSize: "16px",
              fontWeight: 600,
              borderRadius: "8px",
              background: "#fff",
              color: "#171717",
              border: "1px solid #e5e5e5",
            }}
            onClick={() => router.back()}
          >
            Go Back
          </Button>
        </div>

        {/* Helpful Links */}
        <div style={{ marginTop: "48px" }}>
          <Text style={{ fontSize: "14px", color: "#737373" }}>
            Or try these:
          </Text>
          <div style={{ marginTop: "16px", display: "flex", gap: "24px", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/dashboard"
              style={{
                fontSize: "14px",
                color: "#0a72ef",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Dashboard
            </a>
            <a
              href="/timeseries"
              style={{
                fontSize: "14px",
                color: "#0a72ef",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Time Series
            </a>
            <a
              href="/alerts"
              style={{
                fontSize: "14px",
                color: "#0a72ef",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Alerts
            </a>
            <a
              href="/forecasts"
              style={{
                fontSize: "14px",
                color: "#0a72ef",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Forecasts
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
