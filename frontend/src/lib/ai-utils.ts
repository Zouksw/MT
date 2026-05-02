/**
 * Shared AI/accuracy utilities — single source of truth.
 * Replaces duplicated MAPE color functions, model maps, and auth-fetch helpers.
 */

// ── Model metadata (re-exports from types for backward compat) ──

export { MODEL_NAME_MAP, MODEL_COLORS } from "@/types/accuracy";

// ── MAPE color helpers ──

export function getMapeTextColor(mape: number): string {
  if (mape < 5) return "text-green-600 dark:text-green-400";
  if (mape < 10) return "text-primary";
  return "text-red-600 dark:text-red-400";
}

export function getMapeFillColor(mape: number | null): string {
  if (mape === null) return "#6B7280";
  if (mape < 3) return "#10B981";
  if (mape < 7) return "#D4A030";
  if (mape < 12) return "#F97316";
  return "#EF4444";
}

export function formatMape(mape: number | null): string {
  if (mape === null) return "--";
  return `${mape.toFixed(1)}%`;
}

// ── Auth-aware fetch helper ──

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export { API_BASE };

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { tokenManager } = await import("@/lib/tokenManager");
  const token = tokenManager.getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
