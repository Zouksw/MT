"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { tokenManager } from "@/lib/tokenManager";

/**
 * Market forecast board — weaves AI prediction into the market view.
 *
 * Lists beef commodities that have price history, fetches a 7-day consensus
 * forecast for each via /api/signals/batch, and returns one row per commodity
 * with the latest price + the full consensus (direction / change / confidence /
 * model agreement / range). This is the product's core "AI in the market row"
 * experience per PRODUCT-SPEC §5.3 — predictions live next to prices, not in a
 * subpage, and each row surfaces the multi-model consensus (not just a single
 * model's value array).
 *
 * Auth handling: forecasts require authentication. When there is no token (or
 * the request is denied), `permission` reflects that so the UI can show a
 * sign-in/upgrade affordance instead of an empty board.
 *
 * Fetcher convention (R3 unification): this hook intentionally uses raw
 * `useSWR` rather than `useRetryableFetch`. Three concrete reasons it is the
 * documented exception to the "GET → useRetryableFetch" rule:
 *   1. Array keys — the latest-price and batch keys are `[tag, slugCsv]` /
 *      `[tag, slugCsv, horizon]` tuples, not a single URL. useRetryableFetch's
 *      fetcher signature is `(url: string) => Promise<T>`.
 *   2. POST + custom body — the consensus call is a POST with a JSON body,
 *      not a GET the shared fetcher can issue from a URL alone.
 *   3. No-retry-on-auth — the batch call sets `shouldRetryOnError: false`
 *      because 401/403 must surface as `permission: "denied"`, not trigger
 *      three retries. useRetryableFetch's auto-retry would fight that.
 * If a future change makes any of these a plain GET, switch that call to
 * useRetryableFetch and shrink this exception list.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface Commodity {
	id: string;
	slug: string;
	name: string;
	nameCn?: string;
	category: string;
	unit?: string;
	currency?: string;
}

interface CommodityLatest {
	value?: number;
	price?: number;
	date?: string;
}

/** Consensus forecast shape returned by /api/signals/batch (mirrors PriceForecast). */
interface ConsensusForecast {
	direction: "up" | "down" | "flat";
	confidence: number;
	modelsAgree: number;
	totalModels: number;
	availableModels: number;
	predictedChange: number;
	currentPrice: number;
	predictedPrice: number;
	horizon: number;
	range: { lower: number; upper: number };
}

interface BatchForecastEntry {
	slug: string;
	ok: boolean;
	forecast?: ConsensusForecast;
	error?: string;
}

interface BatchSignalsResponse {
	success: boolean;
	data?: { forecasts: BatchForecastEntry[] };
	error?: { message?: string };
}

export interface MarketForecastRow {
	slug: string;
	name: string;
	nameCn?: string;
	unit?: string;
	currency?: string;
	latestPrice: number | null;
	latestDate: string | null;
	/** Consensus predicted price at end of horizon (median across models). */
	forecastEnd: number | null;
	/** Consensus predicted % change at end of horizon. */
	changePct: number | null;
	/** Consensus direction (up/down/flat across models). */
	direction: "up" | "down" | "flat" | null;
	/** Blended confidence [0,1] = agreement ratio + magnitude. */
	confidence: number | null;
	/** Number of models agreeing with the consensus direction. */
	modelsAgree: number | null;
	/** Total models the consensus was attempted across. */
	totalModels: number | null;
	/** Min/max predicted price across models (model-disagreement spread). */
	lowerBound: number | null;
	upperBound: number | null;
	error?: string;
}

export type ForecastPermission = "loading" | "allowed" | "no-token" | "denied";

async function jsonFetch(url: string, opts: RequestInit = {}) {
	const token = tokenManager.getToken();
	const res = await fetch(url, {
		...opts,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...opts.headers,
		},
	});
	return res;
}

export function useMarketForecasts(horizon = 7) {
	const hasToken = typeof window !== "undefined" && !!tokenManager.getToken();

	// 1. Fetch beef-cut commodities.
	const { data: commoditiesData, isLoading: commoditiesLoading } = useSWR<{
		success: boolean;
		data?: { commodities: Commodity[] };
	}>(`${API_URL}/market/commodities`, (url: string) => jsonFetch(url).then((r) => r.json()), {
		revalidateOnFocus: false,
	});

	const beefCommodities = useMemo(() => {
		const all = commoditiesData?.data?.commodities ?? [];
		return all.filter((c) => c.category === "beef_cuts");
	}, [commoditiesData]);

	// 2. Fetch latest price per beef commodity (parallel, lightweight).
	const slugs = useMemo(() => beefCommodities.map((c) => c.slug), [beefCommodities]);

	const latestPriceMap = useSWR<{
		[slug: string]: CommodityLatest;
	}>(
		slugs.length > 0 ? ["beef-latest-prices", slugs.join(",")] : null,
		async ([_key, slugCsv]: [string, string]) => {
			const slugList = slugCsv.split(",").filter(Boolean);
			const entries = await Promise.all(
				slugList.map(async (slug) => {
					try {
						const r = await jsonFetch(`${API_URL}/market/commodities/${slug}/latest`);
						const j = await r.json();
						const d = j?.data ?? {};
						return [slug, { value: d.value, price: d.price, date: d.date }] as const;
					} catch {
						return [slug, {}] as const;
					}
				}),
			);
			return Object.fromEntries(entries) as { [slug: string]: CommodityLatest };
		},
		{ revalidateOnFocus: false },
	);

	// Only forecast commodities that actually have a latest price — avoids
	// "Insufficient price data" entries polluting the board.
	const predictableSlugs = useMemo(
		() =>
			slugs.filter((s) => {
				const p = latestPriceMap.data?.[s];
				const v = p?.value ?? p?.price;
				return typeof v === "number" && v > 0;
			}),
		[slugs, latestPriceMap.data],
	);

	// 3. Batch consensus forecast for predictable slugs. The /signals/batch
	// endpoint returns the full consensus shape per slug (direction /
	// confidence / modelsAgree / range) so each market row surfaces the
	// multi-model agreement — the spec's "model count" + "confidence" columns
	// the raw /inference/predict/batch array never carried.
	const batchKey =
		hasToken && predictableSlugs.length > 0
			? ["beef-signals-batch", predictableSlugs.join(","), horizon]
			: null;

	const batch = useSWR(
		batchKey,
		async ([_key, slugCsv, h]: [string, string, number]) => {
			const slugList = slugCsv.split(",").filter(Boolean);
			const r = await jsonFetch(`${API_URL}/signals/batch`, {
				method: "POST",
				body: JSON.stringify({ slugs: slugList, horizon: h }),
			});
			const j = (await r.json()) as BatchSignalsResponse;
			if (!r.ok || !j.success) {
				const err = new Error(j.error?.message || `HTTP ${r.status}`) as Error & {
					status?: number;
				};
				err.status = r.status;
				throw err;
			}
			return j.data?.forecasts ?? [];
		},
		{ revalidateOnFocus: false, shouldRetryOnError: false },
	);

	// Determine permission state from the batch request outcome.
	const permission: ForecastPermission = (() => {
		if (!hasToken) return "no-token";
		if (predictableSlugs.length === 0) return "loading";
		if (batch.isLoading) return "loading";
		if (batch.error) {
			const status = (batch.error as Error & { status?: number }).status;
			if (status === 401 || status === 403) return "denied";
		}
		return "allowed";
	})();

	// Index batch results by slug for O(1) merge.
	const forecastBySlug = useMemo(() => {
		const m = new Map<string, BatchForecastEntry>();
		for (const f of batch.data ?? []) m.set(f.slug, f);
		return m;
	}, [batch.data]);

	// Merge into rows.
	const rows: MarketForecastRow[] = useMemo(() => {
		return beefCommodities.map((c) => {
			const latest = latestPriceMap.data?.[c.slug];
			const latestPrice = latest?.value ?? latest?.price ?? null;
			const entry = forecastBySlug.get(c.slug);
			const fc = entry?.ok ? entry.forecast : undefined;

			return {
				slug: c.slug,
				name: c.name,
				nameCn: c.nameCn,
				unit: c.unit,
				currency: c.currency,
				latestPrice,
				latestDate: latest?.date ?? null,
				forecastEnd: fc?.predictedPrice ?? null,
				changePct: fc?.predictedChange ?? null,
				direction: fc?.direction ?? null,
				confidence: fc?.confidence ?? null,
				modelsAgree: fc?.modelsAgree ?? null,
				totalModels: fc?.totalModels ?? null,
				lowerBound: fc?.range.lower ?? null,
				upperBound: fc?.range.upper ?? null,
				error: entry && !entry.ok ? entry.error : undefined,
			};
		});
	}, [beefCommodities, latestPriceMap.data, forecastBySlug]);

	const loading =
		commoditiesLoading ||
		latestPriceMap.isLoading ||
		(hasToken && predictableSlugs.length > 0 && batch.isLoading);

	return {
		rows,
		loading,
		permission,
		horizon,
	};
}
