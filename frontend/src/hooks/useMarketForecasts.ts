"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { tokenManager } from "@/lib/tokenManager";

/**
 * Market forecast board — weaves AI prediction into the market view.
 *
 * Lists beef commodities that have price history, fetches a 7-day prediction for
 * each via /inference/predict/batch, and returns one row per commodity with the
 * latest price + forecast change. This is the product's core "AI in the market
 * row" experience per PRODUCT-SPEC — predictions live next to prices, not in a
 * subpage.
 *
 * Auth handling: predictions require an EDITOR/ADMIN token. When there is no
 * token (or the request is denied), `permission` reflects that so the UI can
 * show a sign-in/upgrade affordance instead of an empty board.
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

interface PredictionResponse {
	timestamps?: number[];
	values?: number[];
	lowerBound?: number[];
	upperBound?: number[];
}

interface BatchResponse {
	success: boolean;
	data?: PredictionResponse[];
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
	/** First predicted value (next period). */
	forecastValue: number | null;
	/** Last predicted value (end of horizon). */
	forecastEnd: number | null;
	/** Percent change from latestPrice to forecastEnd, in percent units (+2.3 / -1.1). */
	changePct: number | null;
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

	// Only predict for commodities that actually have a latest price — avoids
	// "Insufficient price data" errors polluting the board.
	const predictableSlugs = useMemo(
		() =>
			slugs.filter((s) => {
				const p = latestPriceMap.data?.[s];
				const v = p?.value ?? p?.price;
				return typeof v === "number" && v > 0;
			}),
		[slugs, latestPriceMap.data],
	);

	// 3. Batch-predict for those slugs.
	const batchKey =
		hasToken && predictableSlugs.length > 0
			? ["beef-batch-forecast", predictableSlugs.join(","), horizon]
			: null;

	const batch = useSWR(
		batchKey,
		async ([_key, slugCsv, h]: [string, string, number]) => {
			const slugList = slugCsv.split(",").filter(Boolean);
			const r = await jsonFetch(`${API_URL}/inference/predict/batch`, {
				method: "POST",
				body: JSON.stringify({
					requests: slugList.map((slug) => ({ commodityId: slug, horizon: h, algorithm: "arima" })),
				}),
			});
			const j = (await r.json()) as BatchResponse;
			if (!r.ok || !j.success) {
				const err = new Error(j.error?.message || `HTTP ${r.status}`) as Error & {
					status?: number;
				};
				err.status = r.status;
				throw err;
			}
			// Batch returns an array aligned to the requests.
			return j.data ?? [];
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

	// Merge into rows.
	const rows: MarketForecastRow[] = useMemo(() => {
		return beefCommodities.map((c) => {
			const latest = latestPriceMap.data?.[c.slug];
			const latestPrice = latest?.value ?? latest?.price ?? null;
			const idx = predictableSlugs.indexOf(c.slug);
			const pred = idx >= 0 ? batch.data?.[idx] : undefined;

			let forecastValue: number | null = null;
			let forecastEnd: number | null = null;
			let changePct: number | null = null;
			let lowerBound: number | null = null;
			let upperBound: number | null = null;
			let predError: string | undefined;

			if (pred && "error" in pred && typeof pred.error === "string") {
				predError = pred.error;
			} else if (pred && Array.isArray(pred.values) && pred.values.length > 0) {
				forecastValue = pred.values[0];
				forecastEnd = pred.values[pred.values.length - 1];
				if (latestPrice && latestPrice > 0 && forecastEnd != null) {
					changePct = ((forecastEnd - latestPrice) / latestPrice) * 100;
				}
				if (Array.isArray(pred.lowerBound) && pred.lowerBound.length > 0) {
					lowerBound = pred.lowerBound[pred.lowerBound.length - 1];
				}
				if (Array.isArray(pred.upperBound) && pred.upperBound.length > 0) {
					upperBound = pred.upperBound[pred.upperBound.length - 1];
				}
			}

			return {
				slug: c.slug,
				name: c.name,
				nameCn: c.nameCn,
				unit: c.unit,
				currency: c.currency,
				latestPrice,
				latestDate: latest?.date ?? null,
				forecastValue,
				forecastEnd,
				changePct,
				lowerBound,
				upperBound,
				error: predError,
			};
		});
	}, [beefCommodities, latestPriceMap.data, predictableSlugs, batch.data]);

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
