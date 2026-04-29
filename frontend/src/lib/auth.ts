"use client";

import Cookies from "js-cookie";
import axios from "axios";
import { tokenManager } from "@/lib/tokenManager";
import { errorHandler } from "@/lib/errorHandler";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      tokenManager.removeToken();
      Cookies.remove("auth", { path: "/" });
    }
    return Promise.reject(errorHandler.handleApiError(error));
  }
);

export interface AuthResult {
  success: boolean;
  error?: { name: string; message: string };
  redirectTo?: string;
}

export interface UserData {
  id: string;
  email: string;
  name: string | null;
  avatar?: string;
  roles?: string[];
}

function _persistUser(user: UserData, remember?: boolean) {
  tokenManager.setToken(
    (user as any).token || "",
    remember
  );
  Cookies.set("auth", JSON.stringify(user), {
    expires: remember ? 30 : 7,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
}

export async function login(
  email: string,
  password: string,
  remember?: boolean
): Promise<AuthResult> {
  try {
    const response = await axiosInstance.post("/auth/login", {
      email,
      password,
    });
    const { user, token } = response.data;
    tokenManager.setToken(token, remember);
    const userData: UserData = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      roles: user.roles || [],
    };
    Cookies.set("auth", JSON.stringify(userData), {
      expires: remember ? 30 : 7,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return { success: true, redirectTo: "/" };
  } catch (error: any) {
    const safeError = errorHandler.handleApiError(error);
    return {
      success: false,
      error: { name: "LoginError", message: safeError.message },
    };
  }
}

export async function register(data: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResult> {
  try {
    const response = await axiosInstance.post("/auth/register", {
      email: data.email,
      password: data.password,
      name: data.name || "",
    });
    const { user, token } = response.data;
    tokenManager.setToken(token);
    const userData: UserData = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      roles: user.roles || [],
    };
    Cookies.set("auth", JSON.stringify(userData), {
      expires: 30,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return { success: true, redirectTo: "/" };
  } catch (error: any) {
    const safeError = errorHandler.handleApiError(error);
    return {
      success: false,
      error: { name: "RegisterError", message: safeError.message },
    };
  }
}

export async function forgotPassword(email: string): Promise<AuthResult> {
  try {
    await axiosInstance.post("/auth/forgot-password", { email });
    return { success: true };
  } catch (error: any) {
    const safeError = errorHandler.handleApiError(error);
    return {
      success: false,
      error: { name: "ForgotPasswordError", message: safeError.message },
    };
  }
}

export async function updatePassword(
  token: string,
  password: string
): Promise<AuthResult> {
  try {
    await axiosInstance.post("/auth/reset-password", { token, password });
    return { success: true };
  } catch (error: any) {
    const safeError = errorHandler.handleApiError(error);
    return {
      success: false,
      error: { name: "UpdatePasswordError", message: safeError.message },
    };
  }
}

export async function logout(): Promise<AuthResult> {
  try {
    await axiosInstance.post("/auth/logout");
  } catch (error: any) {
    console.error("Logout error:", errorHandler.handleApiError(error));
  } finally {
    tokenManager.removeToken();
    Cookies.remove("auth", { path: "/" });
  }
  return { success: true, redirectTo: "/login" };
}

export async function checkAuth(): Promise<boolean> {
  const auth = Cookies.get("auth");
  if (!auth) return false;

  const token = tokenManager.getToken();
  if (!token || !tokenManager.isTokenValid(token)) {
    tokenManager.removeToken();
    return false;
  }

  try {
    await axiosInstance.get("/auth/verify");
    return true;
  } catch {
    tokenManager.removeToken();
    Cookies.remove("auth", { path: "/" });
    return false;
  }
}

export function getIdentity(): UserData | null {
  const auth = Cookies.get("auth");
  if (!auth) return null;
  try {
    return JSON.parse(auth);
  } catch {
    return null;
  }
}

export function getPermissions(): string[] {
  const user = getIdentity();
  return user?.roles || [];
}
