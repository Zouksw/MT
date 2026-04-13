"use client";

import React from "react";
import { Button, Typography } from "antd";
import {
  BugOutlined,
  HomeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

const { Title, Paragraph } = Typography;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        {/* Error Icon */}
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "30px",
            background: "#f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 32px",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
          }}
        >
          <BugOutlined style={{ fontSize: "60px", color: "#0a72ef" }} />
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
          Something went wrong
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
          We encountered an unexpected error. Don&apos;t worry, our team has been
          notified and we&apos;re working to fix it.
        </Paragraph>

        {/* Error Details (Development only) */}
        {process.env.NODE_ENV === "development" && error.message && (
          <div
            style={{
              background: "#f5f5f5",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "32px",
              textAlign: "left",
              border: "1px solid #e5e5e5",
            }}
          >
            <Paragraph
              style={{
                fontSize: "13px",
                color: "#525252",
                margin: 0,
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </Paragraph>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Button
            type="primary"
            size="large"
            icon={<ReloadOutlined />}
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
            onClick={() => reset()}
          >
            Try Again
          </Button>
          <Button
            size="large"
            icon={<HomeOutlined />}
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
            href="/"
          >
            Go Home
          </Button>
        </div>

        {/* Additional Help */}
        <div style={{ marginTop: "48px" }}>
          <Paragraph
            style={{
              fontSize: "14px",
              color: "#737373",
              marginBottom: "16px",
            }}
          >
            Need help? Here are some useful links:
          </Paragraph>
          <div style={{ display: "flex", gap: "24px", justifyContent: "center", flexWrap: "wrap" }}>
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
              href="/login"
              style={{
                fontSize: "14px",
                color: "#0a72ef",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
