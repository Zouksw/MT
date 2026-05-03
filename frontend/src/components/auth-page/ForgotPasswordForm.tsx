"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { errorHandler } from "@/lib/errorHandler";
import { sanitizer } from "@/lib/sanitizer";
import { required, validationRules } from "@/lib/validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function ForgotPasswordForm() {
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const toast = useToast();

	const validate = (): boolean => {
		const errs: Record<string, string> = {};
		const emailErr = validationRules.validateAll(email, [required("Email"), validationRules.email]);
		if (emailErr) errs.email = emailErr;
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

			const res = await fetch(`${API_URL}/auth/forgot-password`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ email: sanitizedEmail }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || `${res.status} ${res.statusText}`);
			}

			toast.showSuccess("Password reset email sent!");
			setEmail("");
			setErrors({});
		} catch (error: unknown) {
			const safeError = errorHandler.handleApiError(error);
			toast.showError(safeError.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5" noValidate>
			<div>
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
				<p className="mt-1 text-xs text-muted-foreground">
					We&apos;ll send you a password reset link
				</p>
			</div>

			<Button
				type="submit"
				variant="primary"
				fullWidth
				isLoading={loading}
				className="h-12 text-base"
			>
				{loading ? "Sending..." : "Send Reset Link"}
			</Button>
		</form>
	);
}
