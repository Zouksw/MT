/**
 * Auth Page Helpers
 *
 * Common utilities, styles, and configuration for auth pages.
 */

import type { AuthType, AuthFormConfig } from "./auth-types";

/**
 * Get title for auth page
 */
export function getTitle(type: AuthType): string {
  switch (type) {
    case "login":
      return "Welcome Back";
    case "register":
      return "Create Account";
    case "forgotPassword":
      return "Reset Password";
    case "updatePassword":
      return "Update Password";
    default:
      return "IoTDB Enhanced";
  }
}

/**
 * Get description for auth page
 */
export function getDescription(type: AuthType): string {
  switch (type) {
    case "login":
      return "Sign in to your account to continue";
    case "register":
      return "Join us to manage your time series data";
    case "forgotPassword":
      return "Enter your email to reset your password";
    case "updatePassword":
      return "Create a new secure password";
    default:
      return "";
  }
}

/**
 * Get form configuration for auth type
 */
export function getFormConfig(type: AuthType): AuthFormConfig {
  switch (type) {
    case "login":
      return {
        title: "Welcome Back",
        description: "Sign in to your account to continue",
        submitText: "Sign In",
      };
    case "register":
      return {
        title: "Create Account",
        description: "Join us to manage your time series data",
        submitText: "Create Account",
        showNameField: true,
        showConfirmPassword: true,
      };
    case "forgotPassword":
      return {
        title: "Reset Password",
        description: "Enter your email to reset your password",
        submitText: "Send Reset Link",
      };
    case "updatePassword":
      return {
        title: "Update Password",
        description: "Create a new secure password",
        submitText: "Update Password",
        showTokenField: true,
      };
    default:
      return {
        title: "IoTDB Enhanced",
        description: "",
        submitText: "Submit",
      };
  }
}

/**
 * Common input style
 */
export const inputStyle = {
  height: 48,
  borderRadius: 3,
  border: "1px solid #E5E7EB",
  background: "#FFFFFF",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
};

/**
 * Common button style
 */
export const buttonStyle = {
  height: 50,
  borderRadius: 3,
  fontSize: 16,
  fontWeight: 600,
  background: "#171717",
  border: "none",
  boxShadow: "0 1px 3px rgba(0, 102, 204, 0.2)",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
};

/**
 * API URL constant
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
