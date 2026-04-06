"use client";

import type { AuthProvider } from "@refinedev/core";
import Cookies from "js-cookie";
import axios from "axios";
import { tokenManager } from "@/lib/tokenManager";
import { errorHandler } from "@/lib/errorHandler";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for HttpOnly auth cookies
});

// Set up interceptor to include auth token in requests
axiosInstance.interceptors.request.use((config) => {
  // Use tokenManager to get token
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const safeError = errorHandler.handleApiError(error);

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Clear invalid token
      tokenManager.removeToken();
      Cookies.remove("auth", { path: "/" });
    }

    return Promise.reject(safeError);
  }
);

export const authProviderClient: AuthProvider = {
  login: async ({ email, password, remember }) => {
    try {
      const response = await axiosInstance.post("/auth/login", {
        email,
        password,
      });

      const { user, token } = response.data;

      // Use tokenManager to store token
      tokenManager.setToken(token, remember);

      // Store user info in cookie (non-sensitive data only)
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        roles: user.roles || [],
      };

      Cookies.set("auth", JSON.stringify(userData), {
        expires: remember ? 30 : 7,
        path: "/",
        secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
        sameSite: 'strict', // CSRF protection
      });

      return {
        success: true,
        redirectTo: "/",
      };
    } catch (error) {
      const safeError = errorHandler.handleApiError(error);
      // eslint-disable-next-line no-console
      console.error("Login error:", safeError);
      return {
        success: false,
        error: {
          name: "LoginError",
          message: safeError.message,
        },
      };
    }
  },

  register: async (params) => {
    try {
      const response = await axiosInstance.post("/auth/register", {
        email: params.email,
        password: params.password,
        name: params.name || "",
      });

      const { user, token } = response.data;

      // Use tokenManager to store token
      tokenManager.setToken(token);

      // Store user info in cookie
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        roles: user.roles || [],
      };

      Cookies.set("auth", JSON.stringify(userData), {
        expires: 30,
        path: "/",
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      return {
        success: true,
        redirectTo: "/",
      };
    } catch (error) {
      const safeError = errorHandler.handleApiError(error);
      // eslint-disable-next-line no-console
      console.error("Registration error:", safeError);
      return {
        success: false,
        error: {
          name: "RegisterError",
          message: safeError.message,
        },
      };
    }
  },

  forgotPassword: async (params) => {
    try {
      await axiosInstance.post("/auth/forgot-password", {
        email: params.email,
      });

      return {
        success: true,
        notification: {
          message: "Password reset email sent",
          description: "Check your email for password reset instructions",
          type: "success",
        },
      };
    } catch (error) {
      const safeError = errorHandler.handleApiError(error);
      return {
        success: false,
        error: {
          name: "ForgotPasswordError",
          message: safeError.message,
        },
      };
    }
  },

  updatePassword: async (params) => {
    try {
      await axiosInstance.post("/auth/reset-password", {
        token: params.token,
        password: params.password,
      });

      return {
        success: true,
        notification: {
          message: "Password updated successfully",
          type: "success",
        },
      };
    } catch (error) {
      const safeError = errorHandler.handleApiError(error);
      return {
        success: false,
        error: {
          name: "UpdatePasswordError",
          message: safeError.message,
        },
      };
    }
  },

  logout: async () => {
    try {
      // Call backend logout endpoint to invalidate token
      await axiosInstance.post("/auth/logout");
    } catch (error) {
      // Log but don't block logout
      // eslint-disable-next-line no-console
      console.error("Logout error:", errorHandler.handleApiError(error));
    } finally {
      // Always clear local tokens
      tokenManager.removeToken();
      Cookies.remove("auth", { path: "/" });
    }

    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    // Check if user cookie exists
    const auth = Cookies.get("auth");
    if (!auth) {
      return {
        authenticated: false,
      };
    }

    // Check if token exists and is valid
    const token = tokenManager.getToken();
    if (!token) {
      return {
        authenticated: false,
      };
    }

    // Validate token expiration
    if (!tokenManager.isTokenValid(token)) {
      // Token expired, clear it
      tokenManager.removeToken();
      return {
        authenticated: false,
      };
    }

    // Optionally verify token with backend
    try {
      await axiosInstance.get("/auth/verify");
      return {
        authenticated: true,
      };
    } catch (error) {
      // Backend verification failed - clear tokens but don't force redirect
      const safeError = errorHandler.handleApiError(error);
      if (safeError.statusCode === 401) {
        tokenManager.removeToken();
        Cookies.remove("auth", { path: "/" });
      }
      return {
        authenticated: false,
      };
    }
  },

  getPermissions: async () => {
    const auth = Cookies.get("auth");
    if (auth) {
      try {
        const parsedAuth = JSON.parse(auth);
        return parsedAuth.roles || [];
      } catch {
        return [];
      }
    }
    return [];
  },

  getIdentity: async () => {
    const auth = Cookies.get("auth");
    if (auth) {
      try {
        const parsedAuth = JSON.parse(auth);
        return {
          id: parsedAuth.id,
          name: parsedAuth.name,
          email: parsedAuth.email,
          avatar: parsedAuth.avatar,
          roles: parsedAuth.roles,
        };
      } catch {
        return null;
      }
    }
    return null;
  },

  onError: async (error) => {
    const safeError = errorHandler.createSafeError(error);

    if (safeError.statusCode === 401 || errorHandler.requiresReauth(safeError)) {
      return {
        logout: true,
      };
    }

    // Return error in format Refine expects
    // Create an Error object from our safe error
    const refineError = new Error(safeError.message);
    (refineError as any).statusCode = safeError.statusCode;
    (refineError as any).code = safeError.code;

    return { error: refineError };
  },
};
