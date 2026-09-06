"use client";

/**
 * Import landing-cost calculator state (v3.2.0 批 3).
 *
 * Thin client over the public GET /api/tools/landing-cost — the math and the
 * honesty rules (whitelisted base series, dated/staleness-flagged live
 * inputs, user-supplied duty assumptions) live server-side in
 * services/landingCost.ts so they are testable and identical for every
 * consumer. The hook owns form params + fetch lifecycle; computation runs on
 * explicit recalculate (button) plus once on mount with defaults.
 */

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

export type LandingBaseSeries =
	| "beef_90cl_us"
	| "beef_carcass_us"
	| "live_cattle_cme"
	| "feeder_cattle_cme";
export type LandingOriginFx = "none" | "aud_usd" | "brl_usd";

export interface LandingCostParamsState {
	baseSeries: LandingBaseSeries;
	originFx: LandingOriginFx;
	tariffPct: number;
	vatPct: number;
	freightUsdPerKg: number;
	feesUsdPerKg: number;
	lossPct: number;
}

export const DEFAULT_LANDING_COST_PARAMS: LandingCostParamsState = {
	baseSeries: "beef_carcass_us",
	originFx: "none",
	tariffPct: 0,
	vatPct: 0,
	freightUsdPerKg: 0,
	feesUsdPerKg: 0,
	lossPct: 0,
};

/** Mirrors the backend LandingCostQuote shape (services/landingCost.ts). */
export interface LandedCostBreakdown {
	baseUsdPerKg: number;
	freightUsdPerKg: number;
	feesUsdPerKg: number;
	costBaseUsdPerKg: number;
	dutyUsdPerKg: number;
	vatUsdPerKg: number;
	landedUsdPerKg: number;
	cnyPerKg: number | null;
}

export interface LandingCostQuote {
	status: "ok" | "insufficient_data";
	reason?: string;
	params: LandingCostParamsState;
	base?: {
		slug: string;
		label: string;
		unit: string;
		latestClose: number;
		latestDate: string;
		interval: string;
		source: string;
		stale: boolean;
		daysOld: number;
		usdPerKg: number;
		window: { points: number; description: string; lowClose: number; highClose: number };
	};
	fx?: {
		usdCny: { rate: number; date: string; stale: boolean } | null;
		originRef: { slug: string; label: string; rate: number; date: string } | null;
	};
	/** Live ocean-freight benchmark (Drewry WCI, USD/40ft — round-161 批2).
	 * Per-container quote, reference-only; never auto-converted to per-kg. */
	freightBenchmark?: {
		usdPer40ft: number;
		date: string;
		daysOld: number;
		stale: boolean;
	};
	landed?: {
		low: LandedCostBreakdown;
		mid: LandedCostBreakdown;
		high: LandedCostBreakdown;
	};
	notes: string[];
	timestamp: string;
}

export function useLandingCost() {
	const [params, setParams] = useState<LandingCostParamsState>(DEFAULT_LANDING_COST_PARAMS);
	const [quote, setQuote] = useState<LandingCostQuote | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const recalculate = useCallback(async (p: LandingCostParamsState) => {
		setLoading(true);
		setError(null);
		try {
			const qs = new URLSearchParams({
				baseSeries: p.baseSeries,
				originFx: p.originFx,
				tariffPct: String(p.tariffPct),
				vatPct: String(p.vatPct),
				freightUsdPerKg: String(p.freightUsdPerKg),
				feesUsdPerKg: String(p.feesUsdPerKg),
				lossPct: String(p.lossPct),
			});
			const res = await apiFetch<{ success: boolean; data: LandingCostQuote }>(
				`/api/tools/landing-cost?${qs.toString()}`,
			);
			setQuote(res.data);
		} catch (e) {
			setQuote(null);
			setError(e instanceof Error ? e.message : "计算请求失败");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void recalculate(DEFAULT_LANDING_COST_PARAMS);
	}, [recalculate]);

	return { params, setParams, quote, loading, error, recalculate };
}
