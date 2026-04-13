/**
 * Modern Login Form Component
 */

"use client";

import React from "react";
import { Form, Input, Checkbox, message, Button } from "antd";
import { useRouter } from "next/navigation";
import { MailOutlined, LockOutlined } from "@ant-design/icons";
import axios from "axios";
import Cookies from "js-cookie";

import { validationRules, required } from "@/lib/validation";
import { sanitizer } from "@/lib/sanitizer";
import { errorHandler } from "@/lib/errorHandler";
import { csrfProtection } from "@/lib/csrf";
import { tokenManager } from "@/lib/tokenManager";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function LoginForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

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

      const response = await axiosInstance.post("/auth/login", {
        email: sanitizedEmail,
        password: values.password,
        remember: values.remember,
      });

      const { user, token: authToken } = response.data.data || response.data;

      // Store token securely
      tokenManager.setToken(authToken, Boolean(values.remember));

      // Store non-sensitive user data
      const userData = {
        id: user.id,
        email: user.email,
        name: sanitizer.sanitizeString(user.name || "", 100),
        avatar: user.avatar,
        roles: user.roles || [],
      };

      Cookies.set("auth", JSON.stringify(userData), {
        expires: values.remember ? 30 : 7,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      message.success("Login successful!");
      setTimeout(() => router.push("/"), 500);
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
    minWidth: 0,
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
      >
        <Input
          placeholder="your.email@example.com"
          size="large"
          style={inputStyle}
          prefix={<MailOutlined style={{ fontSize: 16, color: "#9ca3af" }} />}
          autoComplete="email"
        />
      </Form.Item>

      <Form.Item
        label={<span style={{ fontWeight: 500, color: "#374151", fontSize: "15px" }}>Password</span>}
        name="password"
        rules={[validationRules.getAntRule(required("Password"))]}
      >
        <Input.Password
          placeholder="Enter your password"
          size="large"
          style={inputStyle}
          prefix={<LockOutlined style={{ fontSize: 16, color: "#9ca3af" }} />}
          autoComplete="current-password"
        />
      </Form.Item>

      <Form.Item>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox style={{ fontSize: "14px", color: "#374151" }}>Remember me</Checkbox>
          </Form.Item>
          <a
            href="/forgot-password"
            style={{ fontSize: "14px", color: "#0a72ef", textDecoration: "none" }}
          >
            Forgot password?
          </a>
        </div>
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
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </Form.Item>
    </Form>
  );
}
