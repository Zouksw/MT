"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

import { validationRules, required, } from "@/lib/validation";
import { sanitizer } from "@/lib/sanitizer";
import { errorHandler } from "@/lib/errorHandler";
import { tokenManager } from "@/lib/tokenManager";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function RegisterForm() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const toast = useToast();

  const calculateStrength = (pw: string): number => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s += 20;
    if (pw.length >= 12) s += 20;
    if (/[a-z]/.test(pw)) s += 15;
    if (/[A-Z]/.test(pw)) s += 15;
    if (/[0-9]/.test(pw)) s += 15;
    if (/[^a-zA-Z0-9]/.test(pw)) s += 15;
    return Math.min(s, 100);
  };

  const strengthColor = (s: number) =>
    s < 40 ? "bg-red-500" : s < 70 ? "bg-amber-500" : "bg-green-500";
  const strengthText = (s: number) =>
    s < 40 ? "Weak" : s < 70 ? "Medium" : "Strong";

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const nameErr = validationRules.validateAll(name, [required("Name")]);
    if (nameErr) errs.name = nameErr;
    const emailErr = validationRules.validateAll(email, [
      required("Email"),
      validationRules.email,
    ]);
    if (emailErr) errs.email = emailErr;
    const pwErr = validationRules.validateAll(password, [
      required("Password"),
    ]);
    if (pwErr) errs.password = pwErr;
    if (!confirmPassword.trim()) {
      errs.confirmPassword = "Confirm Password is required";
    } else if (confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const sanitizedEmail = sanitizer.sanitizeEmail(email);
      const sanitizedName = sanitizer.sanitizeString(name || "", 100);

      if (!sanitizedEmail) {
        toast.showError("Invalid email format");
        return;
      }

      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: sanitizedEmail,
          password,
          name: sanitizedName,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const { user, token: authToken } = data.data || data;

      tokenManager.setToken(authToken);
      Cookies.set(
        "auth",
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: sanitizedName,
          avatar: user.avatar,
          roles: user.roles || [],
        }),
        {
          expires: 30,
          path: "/",
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        }
      );

      toast.showSuccess("Registration successful!");
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
        label="Full Name"
        placeholder="John Doe"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        fullWidth
        autoComplete="name"
      />

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

      <div>
        <Input
          label="Password"
          type="password"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordStrength(calculateStrength(e.target.value));
          }}
          error={errors.password}
          fullWidth
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          At least 8 characters with uppercase, lowercase, and numbers
        </p>
        {passwordStrength > 0 && (
          <div className="mt-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${strengthColor(passwordStrength)}`}
                style={{ width: `${passwordStrength}%` }}
              />
            </div>
            <p
              className={`text-xs mt-1 ${passwordStrength < 40 ? "text-red-500" : passwordStrength < 70 ? "text-amber-500" : "text-green-500"}`}
            >
              Password strength: {strengthText(passwordStrength)}
            </p>
          </div>
        )}
      </div>

      <Input
        label="Confirm Password"
        type="password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
        fullWidth
        autoComplete="new-password"
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={loading}
        className="h-12 text-base"
      >
        {loading ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
