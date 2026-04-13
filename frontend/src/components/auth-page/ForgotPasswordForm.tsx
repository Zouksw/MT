/**
 * Modern Forgot Password Form Component
 */

"use client";

import React from "react";
import { Form, Input, message, Button } from "antd";
import { MailOutlined } from "@ant-design/icons";
import axios from "axios";

import { validationRules, required } from "@/lib/validation";
import { sanitizer } from "@/lib/sanitizer";
import { errorHandler } from "@/lib/errorHandler";
import { csrfProtection } from "@/lib/csrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function ForgotPasswordForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

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

      // Sanitize email
      const sanitizedEmail = sanitizer.sanitizeEmail(values.email as string);
      if (!sanitizedEmail) {
        message.error("Invalid email format");
        return;
      }

      await axiosInstance.post("/auth/forgot-password", {
        email: sanitizedEmail,
      });

      message.success("Password reset email sent!");
      form.resetFields();
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
        label={<span style={{ fontWeight: 500, color: "#374151", fontSize: "15px" }}>Email</span>}
        name="email"
        rules={[
          validationRules.getAntRule(required("Email")),
          validationRules.getAntRule(validationRules.email),
        ]}
        extra="We'll send you a password reset link"
      >
        <Input
          placeholder="your.email@example.com"
          size="large"
          style={inputStyle}
          prefix={<MailOutlined style={{ fontSize: 16, color: "#9ca3af" }} />}
          autoComplete="email"
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
          {loading ? "Sending..." : "Send Reset Link"}
        </Button>
      </Form.Item>
    </Form>
  );
}
