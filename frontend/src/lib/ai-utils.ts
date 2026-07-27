/**
 * Shared AI/accuracy utilities — single source of truth.
 * Replaces duplicated MAPE color functions, model maps, and auth-fetch helpers.
 */

// ── Model metadata (re-exports from types for backward compat) ──

export { MODEL_COLORS, MODEL_NAME_MAP } from "@/types/accuracy";

import { formatPercentValue } from "@/lib/format";

// ── MAPE color helpers ──

export function getMapeTextColor(mape: number): string {
	if (mape < 5) return "text-green-600 dark:text-green-400";
	if (mape < 10) return "text-primary";
	return "text-red-600 dark:text-red-400";
}

export function getMapeFillColor(mape: number | null): string {
	if (mape === null) return "#6B7280";
	if (mape < 3) return "#16A34A";
	if (mape < 7) return "#A8821C";
	if (mape < 12) return "#F97316";
	return "#DC2626";
}

export function formatMape(mape: number | null): string {
	if (mape === null) return "--";
	return formatPercentValue(mape, 1);
}

// ── Auth-aware fetch helper ──

// Re-export the shared base URL so existing callers (e.g. backtest/page.tsx)
// don't need to change their import. The value now comes from lib/config,
// the single source of truth.
export { API_BASE } from "@/lib/config";

export async function getAuthHeaders(): Promise<Record<string, string>> {
	const { tokenManager } = await import("@/lib/tokenManager");
	const token = tokenManager.getToken();
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}
