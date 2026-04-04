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
        background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        padding: "24px",
      }}
    >
      {/* Animated background elements */}
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)",
          top: "-200px",
          left: "-200px",
          filter: "blur(60px)",
          animation: "float 20s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)",
          bottom: "-150px",
          right: "-150px",
          filter: "blur(60px)",
          animation: "float 25s ease-in-out infinite reverse",
        }}
      />

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
            background: "rgba(255, 255, 255, 0.25)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 32px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          }}
        >
          <BugOutlined style={{ fontSize: "60px", color: "#fff" }} />
        </div>

        {/* Title */}
        <Title
          level={1}
          style={{
            color: "#fff",
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 700,
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
            color: "rgba(255, 255, 255, 0.9)",
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
              background: "rgba(0, 0, 0, 0.2)",
              backdropFilter: "blur(10px)",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "32px",
              textAlign: "left",
            }}
          >
            <Paragraph
              style={{
                fontSize: "13px",
                color: "rgba(255, 255, 255, 0.8)",
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
              background: "#fff",
              color: "#f5576c",
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
              background: "rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(10px)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
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
              color: "rgba(255, 255, 255, 0.8)",
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
                color: "#fff",
                textDecoration: "none",
                opacity: 0.9,
                transition: "opacity 0.2s",
              }}
            >
              Dashboard
            </a>
            <a
              href="/login"
              style={{
                fontSize: "14px",
                color: "#fff",
                textDecoration: "none",
                opacity: 0.9,
                transition: "opacity 0.2s",
              }}
            >
              Login
            </a>
            <a
              href="https://github.com/your-repo/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "14px",
                color: "#fff",
                textDecoration: "none",
                opacity: 0.9,
                transition: "opacity 0.2s",
              }}
            >
              Report Issue
            </a>
          </div>
        </div>
      </div>

      {/* Add animation keyframes */}
      <style>{`
        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(30px, -30px);
          }
        }
      `}</style>
    </div>
  );
}
