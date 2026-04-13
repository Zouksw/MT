"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ThunderboltOutlined,
  LineChartOutlined,
  SafetyOutlined,
  GithubOutlined,
} from "@ant-design/icons";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { UpdatePasswordForm } from "./UpdatePasswordForm";
import type { AuthPageProps } from "./auth-types";

export function AuthPage(props: AuthPageProps) {
  const router = useRouter();

  const renderFooter = () => {
    switch (props.type) {
      case "login":
        return (
          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <button
              onClick={() => router.push("/register")}
              className="font-semibold text-primary hover:text-primary-hover"
            >
              Sign up
            </button>
          </p>
        );
      case "register":
        return (
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <button
              onClick={() => router.push("/login")}
              className="font-semibold text-primary hover:text-primary-hover"
            >
              Sign in
            </button>
          </p>
        );
      case "forgotPassword":
      case "updatePassword":
        return (
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to login
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTitle = () => {
    switch (props.type) {
      case "login": return "Welcome back";
      case "register": return "Create your account";
      case "forgotPassword": return "Reset your password";
      case "updatePassword": return "Create new password";
      default: return "Welcome";
    }
  };

  const renderDescription = () => {
    switch (props.type) {
      case "login": return "Enter your credentials to access your account";
      case "register": return "Start your 14-day free trial. No credit card required.";
      case "forgotPassword": return "Enter your email and we'll send you a reset link";
      case "updatePassword": return "Create a strong password for your account";
      default: return "";
    }
  };

  const renderForm = () => {
    switch (props.type) {
      case "login": return <LoginForm />;
      case "register": return <RegisterForm />;
      case "forgotPassword": return <ForgotPasswordForm />;
      case "updatePassword": return <UpdatePasswordForm token={(props as { token?: string }).token || ""} />;
      default: return <LoginForm />;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side — Deep brand gradient with noise texture */}
      <div className="hidden md:flex md:w-[45%] lg:w-[50%] flex-col justify-between relative overflow-hidden bg-gradient-to-br from-primary to-blue-700 text-white p-12">
        {/* Subtle mesh gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(at 30% 20%, rgba(255,255,255,0.15), transparent 50%), radial-gradient(at 70% 80%, rgba(14,165,233,0.2), transparent 50%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
            <ThunderboltOutlined className="text-3xl text-white" />
          </div>

          <h1 className="font-display text-4xl font-semibold leading-tight">
            IoTDB Enhanced
          </h1>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-white/80">
            Enterprise-grade time series database platform with AI-powered forecasting and real-time analytics
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-6">
          {[
            { icon: <ThunderboltOutlined />, title: "Lightning Fast", desc: "Millions of data points per second" },
            { icon: <LineChartOutlined />, title: "AI-Powered Insights", desc: "Built-in forecasting and anomaly detection" },
            { icon: <SafetyOutlined />, title: "Enterprise Security", desc: "End-to-end encryption and access control" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <span className="text-xl">{f.icon}</span>
              </div>
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-white/70">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social */}
        <div className="relative z-10 flex items-center gap-4 text-white/60">
          <span className="text-sm">Follow us</span>
          <GithubOutlined className="cursor-pointer text-xl text-white/70 transition-colors hover:text-white" />
        </div>
      </div>

      {/* Right Side — Clean form */}
      <div className="flex flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6 py-12 md:px-12">
        <div className="w-full max-w-md">
          {/* Blue accent bar */}
          <div className="mb-8 h-1 w-12 rounded-full bg-primary" />

          <h2 className="font-display text-3xl font-semibold text-gray-900 dark:text-white">
            {renderTitle()}
          </h2>
          <p className="mt-3 text-base text-gray-500 dark:text-gray-400">
            {renderDescription()}
          </p>

          {/* Form */}
          <div className="mt-8">
            {renderForm()}
          </div>

          {/* Footer */}
          {renderFooter()}

          {/* Terms */}
          <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-6 text-center">
            <p className="text-xs text-gray-400">
              By continuing, you agree to our{" "}
              <a href="#" className="text-gray-500 hover:text-gray-700">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-gray-500 hover:text-gray-700">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
