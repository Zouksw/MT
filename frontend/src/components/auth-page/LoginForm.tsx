"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

import { validationRules, required } from "@/lib/validation";
import { sanitizer } from "@/lib/sanitizer";
import { errorHandler } from "@/lib/errorHandler";
import { tokenManager } from "@/lib/tokenManager";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const toast = useToast();

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const emailErr = validationRules.validateAll(email, [required("Email"), validationRules.email]);
    if (emailErr) errs.email = emailErr;
    const pwErr = validationRules.validateAll(password, [required("Password")]);
    if (pwErr) errs.password = pwErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const sanitizedEmail = sanitizer.sanitizeEmail(email);
      if (!sanitizedEmail) {
        toast.showError("Invalid email format");
        return;
      }

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: sanitizedEmail, password, remember }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const { user, token: authToken } = data.data || data;

      tokenManager.setToken(authToken, remember);
      Cookies.set(
        "auth",
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: sanitizer.sanitizeString(user.name || "", 100),
          avatar: user.avatar,
          roles: user.roles || [],
        }),
        {
          expires: remember ? 30 : 7,
          path: "/",
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        }
      );

      toast.showSuccess("Login successful!");
      setTimeout(() => router.push("/"), 500);
    } catch (error: unknown) {
      const safeError = errorHandler.handleApiError(error);
      toast.showError(safeError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Input
        label="Email"
        type="email"
        placeholder="your.email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        fullWidth
        autoComplete="email"
      />

      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        fullWidth
        autoComplete="current-password"
      />

      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary"
          />
          Remember me
        </label>
        <a
          href="/forgot-password"
          className="text-sm text-primary hover:text-primary-hover"
        >
          Forgot password?
        </a>
      </div>

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={loading}
        className="h-12 text-base"
      >
        {loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
