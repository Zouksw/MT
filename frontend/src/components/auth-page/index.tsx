/**
 * Modern Auth Page Component
 * Features:
 * - Split-screen layout with gradient background
 * - Modern glassmorphism effects
 * - Responsive design
 * - Smooth animations
 */

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Typography, Divider } from "antd";
import {
  ThunderboltOutlined,
  LineChartOutlined,
  SafetyOutlined,
  RocketOutlined,
  GithubOutlined,
  TwitterOutlined,
} from "@ant-design/icons";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { UpdatePasswordForm } from "./UpdatePasswordForm";
import type { AuthPageProps } from "./auth-types";

const { Text, Link, Title } = Typography;

export function AuthPage(props: AuthPageProps) {
  const router = useRouter();

  const renderFooter = () => {
    switch (props.type) {
      case "login":
        return (
          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <Text style={{ fontSize: "14px", color: "#64748b" }}>
              Don&apos;t have an account?{" "}
              <Link
                onClick={() => router.push("/register")}
                style={{ cursor: "pointer", fontWeight: 600, color: "#0066CC" }}
              >
                Sign up
              </Link>
            </Text>
            <br />
            <Link
              onClick={() => router.push("/forgot-password")}
              style={{ cursor: "pointer", fontSize: "14px", color: "#64748b" }}
            >
              Forgot password?
            </Link>
          </div>
        );
      case "register":
        return (
          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <Text style={{ fontSize: "14px", color: "#64748b" }}>
              Already have an account?{" "}
              <Link
                onClick={() => router.push("/login")}
                style={{ cursor: "pointer", fontWeight: 600, color: "#0066CC" }}
              >
                Sign in
              </Link>
            </Text>
          </div>
        );
      case "forgotPassword":
      case "updatePassword":
        return (
          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <Link
              onClick={() => router.push("/login")}
              style={{ cursor: "pointer", fontSize: "14px", color: "#64748b" }}
            >
              ← Back to login
            </Link>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTitle = () => {
    switch (props.type) {
      case "login":
        return "Welcome back";
      case "register":
        return "Create your account";
      case "forgotPassword":
        return "Reset your password";
      case "updatePassword":
        return "Create new password";
      default:
        return "Welcome";
    }
  };

  const renderDescription = () => {
    switch (props.type) {
      case "login":
        return "Enter your credentials to access your account";
      case "register":
        return "Start your 14-day free trial today. No credit card required.";
      case "forgotPassword":
        return "Enter your email and we'll send you a reset link";
      case "updatePassword":
        return "Create a strong password for your account";
      default:
        return "";
    }
  };

  const renderForm = () => {
    switch (props.type) {
      case "login":
        return <LoginForm />;
      case "register":
        return <RegisterForm />;
      case "forgotPassword":
        return <ForgotPasswordForm />;
      case "updatePassword":
        return <UpdatePasswordForm token={(props as { token?: string }).token || ""} />;
      default:
        return <LoginForm />;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: `
          linear-gradient(135deg, #667eea 0%, #764ba2 100%)
        `,
      }}
    >
      {/* Left Side - Branding */}
      <div
        className="auth-page-left"
        style={{
          flex: "1",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px 40px",
          background: `
            linear-gradient(135deg, rgba(0, 102, 204, 0.95) 0%, rgba(0, 168, 232, 0.95) 100%)
          `,
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated background elements */}
        <div
          style={{
            position: "absolute",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)",
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
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%)",
            bottom: "-150px",
            right: "-150px",
            filter: "blur(60px)",
            animation: "float 25s ease-in-out infinite reverse",
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "480px" }}>
          {/* Logo */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "16px",
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "32px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            }}
          >
            <ThunderboltOutlined style={{ fontSize: "40px", color: "#fff" }} />
          </div>

          <Title level={1} style={{ color: "#fff", fontSize: "42px", fontWeight: 700, marginBottom: "16px", lineHeight: 1.2 }}>
            IoTDB Enhanced
          </Title>

          <Text style={{ fontSize: "18px", color: "rgba(255, 255, 255, 0.9)", display: "block", marginBottom: "48px", lineHeight: 1.6 }}>
            Enterprise-grade time series database platform with AI-powered forecasting and real-time analytics
          </Text>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ThunderboltOutlined style={{ fontSize: "24px", color: "#fff" }} />
              </div>
              <div>
                <Text style={{ fontSize: "16px", fontWeight: 600, color: "#fff", display: "block" }}>
                  Lightning Fast
                </Text>
                <Text style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.8)" }}>
                  Process millions of data points per second
                </Text>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LineChartOutlined style={{ fontSize: "24px", color: "#fff" }} />
              </div>
              <div>
                <Text style={{ fontSize: "16px", fontWeight: 600, color: "#fff", display: "block" }}>
                  AI-Powered Insights
                </Text>
                <Text style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.8)" }}>
                  Built-in forecasting and anomaly detection
                </Text>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SafetyOutlined style={{ fontSize: "24px", color: "#fff" }} />
              </div>
              <div>
                <Text style={{ fontSize: "16px", fontWeight: 600, color: "#fff", display: "block" }}>
                  Enterprise Security
                </Text>
                <Text style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.8)" }}>
                  End-to-end encryption and access control
                </Text>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div style={{ position: "absolute", bottom: "40px", left: "40px", zIndex: 1 }}>
          <Text style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.7)", display: "block", marginBottom: "16px" }}>
            Follow us
          </Text>
          <div style={{ display: "flex", gap: "16px" }}>
            <GithubOutlined style={{ fontSize: "24px", color: "rgba(255, 255, 255, 0.8)", cursor: "pointer" }} />
            <TwitterOutlined style={{ fontSize: "24px", color: "rgba(255, 255, 255, 0.8)", cursor: "pointer" }} />
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 40px",
          background: "#fff",
        }}
      >
        <div style={{ width: "100%", maxWidth: "440px" }}>
          {/* Header */}
          <div style={{ marginBottom: "40px" }}>
            <Title level={2} style={{ fontSize: "32px", fontWeight: 700, color: "#111827", marginBottom: "12px" }}>
              {renderTitle()}
            </Title>
            <Text style={{ fontSize: "16px", color: "#64748b", lineHeight: 1.6 }}>
              {renderDescription()}
            </Text>
          </div>

          {/* Form */}
          {renderForm()}

          {/* Footer */}
          {renderFooter()}

          {/* Bottom branding */}
          <Divider style={{ margin: "32px 0 24px", borderColor: "#e5e7eb" }} />
          <div style={{ textAlign: "center" }}>
            <Text style={{ fontSize: "13px", color: "#94a3b8" }}>
              By continuing, you agree to our{" "}
              <Link href="#" style={{ color: "#64748b" }}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="#" style={{ color: "#64748b" }}>
                Privacy Policy
              </Link>
            </Text>
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

        @media (max-width: 968px) {
          @media (min-width: 769px) {
            .auth-page-left {
              flex: 0 0 50% !important;
            }
          }
        }
      `}</style>
    </div>
  );
}

export default AuthPage;
