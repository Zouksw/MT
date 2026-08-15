"use client";

import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/config";
import { tokenManager } from "@/lib/tokenManager";

/**
 * useBeefImport — wraps the admin beef-price CSV upload (POST /api/beef/import).
 *
 * The backend accepts multipart form-data with a single `file` field and
 * returns { imported, updated, skipped, errors: [{row, message}] }. This hook
 * builds the FormData, attaches the bearer token, and surfaces a clean
 * { status, result, error, upload } tuple so the import page can render the
 * per-row outcome without scattered fetch logic.
 *
 * This is intentionally a plain callback hook (not SWR): the upload is a
 * one-shot POST with side effects, not a cacheable GET — useRetryableFetch
 * does not apply.
 */
export interface BeefImportError {
	row: number;
	message: string;
}

export interface BeefImportResult {
	imported: number;
	updated: number;
	skipped: number;
	errors: BeefImportError[];
}

export type UploadStatus = "idle" | "uploading" | "success" | "error";

const API_URL = `${API_BASE}/api`;

export function useBeefImport() {
	const [status, setStatus] = useState<UploadStatus>("idle");
	const [result, setResult] = useState<BeefImportResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const upload = useCallback(async (file: File) => {
		setStatus("uploading");
		setError(null);
		setResult(null);

		try {
			const token = tokenManager.getToken();
			const formData = new FormData();
			formData.append("file", file);

			const res = await fetch(`${API_URL}/beef/import`, {
				method: "POST",
				credentials: "include",
				headers: {
					// Let the browser set the multipart boundary — do NOT set
					// Content-Type manually for FormData.
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: formData,
			});

			const json = await res.json();

			if (!res.ok) {
				// For permission errors, surface the admin-specific guidance
				// rather than whatever opaque message the backend sent — the
				// caller needs to know it's a role issue, not a data issue.
				const msg =
					res.status === 403
						? "Only administrators can import beef prices."
						: json?.error?.message || `Upload failed (HTTP ${res.status})`;
				setStatus("error");
				setError(msg);
				return;
			}

			// success(res, result, 201) → { success: true, data: result }
			const data: BeefImportResult = json?.data ?? json;
			setResult(data);
			setStatus("success");
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Network error during upload";
			setStatus("error");
			setError(msg);
		}
	}, []);

	const reset = useCallback(() => {
		setStatus("idle");
		setResult(null);
		setError(null);
	}, []);

	return { status, result, error, upload, reset };
}
