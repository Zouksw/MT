/**
 * Modern Update Password Form Component
 */

"use client";

import React from "react";
import { Form, Input, message, Button, Progress } from "antd";
import { useRouter } from "next/navigation";
import { LockOutlined } from "@ant-design/icons";
import axios from "axios";

import { validationRules, required, confirmation } from "@/lib/validation";
import { sanitizer } from "@/lib/sanitizer";
import { errorHandler } from "@/lib/errorHandler";
import { csrfProtection } from "@/lib/csrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function UpdatePasswordForm({ token }: { token: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [passwordStrength, setPasswordStrength] = React.useState(0);
  const router = useRouter();

  // Calculate password strength
  const calculatePasswordStrength = (password: string): number => {
    if (!password) return 0;

    let strength = 0;
    // Length check (up to 40 points)
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 20;

    // Character variety (up to 60 points)
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

    return Math.min(strength, 100);
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 40) return "#EF4444"; // error red
    if (strength < 70) return "#F59E0B"; // warning orange
    return "#10B981"; // success green
  };

  const getPasswordStrengthText = (strength: number): string => {
    if (strength < 40) return "Weak";
    if (strength < 70) return "Medium";
    return "Strong";
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const axiosInstance = axios.create({
        baseURL: API_URL,
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      // Add CSRF token
      const csrfHeaders = csrfProtection.getHeaders();
      axiosInstance.defaults.headers.common = {
        ...axiosInstance.defaults.headers.common,
        ...csrfHeaders,
      };

      await axiosInstance.post("/auth/reset-password", {
        token: sanitizer.sanitizeString(token, 500),
        password: values.password,
      });

      message.success("Password updated successfully!");
      setTimeout(() => router.push("/login"), 500);
    } catch (error: unknown) {
      const safeError = errorHandler.handleApiError(error);
      message.error(safeError.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "15px",
    border: "1px solid #e5e7eb",
    transition: "all 0.2s",
  };

  const buttonStyle: React.CSSProperties = {
    height: "48px",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: 600,
    background: "#171717",
    border: "none",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      validateTrigger="onBlur"
      requiredMark={false}
    >
      <Form.Item
        label={<span style={{ fontWeight: 500, color: "#374151", fontSize: "15px" }}>New Password</span>}
        name="password"
        rules={[validationRules.getAntRule(required("Password"))]}
        extra={
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: "#6B7280" }}>
              Must be at least 8 characters with uppercase, lowercase, and numbers
            </div>
            {passwordStrength > 0 && (
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={passwordStrength}
                  strokeColor={getPasswordStrengthColor(passwordStrength)}
                  showInfo={false}
                  size="small"
                />
                <div style={{ fontSize: 11, color: getPasswordStrengthColor(passwordStrength), marginTop: 2 }}>
                  Password strength: {getPasswordStrengthText(passwordStrength)}
                </div>
              </div>
            )}
          </div>
        }
      >
        <Input.Password
          placeholder="Enter your new password"
          size="large"
          style={inputStyle}
          prefix={<LockOutlined style={{ fontSize: 16, color: "#9ca3af" }} />}
          autoComplete="new-password"
          onChange={handlePasswordChange}
        />
      </Form.Item>

      <Form.Item
        label={<span style={{ fontWeight: 500, color: "#374151", fontSize: "15px" }}>Confirm Password</span>}
        name="confirmPassword"
        dependencies={["password"]}
        rules={[
          validationRules.getAntRule(required("Confirm Password")),
          validationRules.getAntRule(confirmation("password")),
        ]}
      >
        <Input.Password
          placeholder="Confirm your new password"
          size="large"
          style={inputStyle}
          prefix={<LockOutlined style={{ fontSize: 16, color: "#9ca3af" }} />}
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button
          type="primary"
          htmlType="submit"
          style={buttonStyle}
          className="w-full"
          disabled={loading}
          loading={loading}
        >
          {loading ? "Updating..." : "Update Password"}
        </Button>
      </Form.Item>
    </Form>
  );
}
