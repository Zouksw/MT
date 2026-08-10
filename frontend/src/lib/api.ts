"use client";

import useSWR, { mutate } from "swr";
import { API_BASE } from "@/lib/config";
import { swrFetcher } from "@/lib/swr-fetcher";
import { tokenManager } from "@/lib/tokenManager";
import { authFetch } from "@/utils/auth";

// ── SWR fetcher with auth ──────────────────────────────────────────────────
// Round-91: delegates to the shared swrFetcher (wraps authFetch) instead of
// reimplementing the token + credentials + error-throw contract. The /api
// prefix is prepended here because callers use paths like "/datasets" (without
// the prefix); swrFetcher expects the full path from API_BASE root.

async function apiFetcher(url: string) {
	return swrFetcher(`${API_BASE}/api${url}`);
}

// ── Query hooks (replace Refine useList / useOne) ──────────────────────────

export interface ListParams {
	page?: number;
	pageSize?: number;
	sort?: string;
	order?: "asc" | "desc";
	filters?: Record<string, string | number | boolean>;
}

interface ListResult<T> {
	data: T[];
	total: number;
	loading: boolean;
	error: Error | undefined;
	mutate: () => void;
}

/** Replace Refine's useList */
export function useList<T = Record<string, unknown>>(
	resource: string,
	params?: ListParams,
): ListResult<T> {
	const searchParams = new URLSearchParams();
	if (params?.page) searchParams.set("page", String(params.page));
	if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
	if (params?.sort) searchParams.set("sort", params.sort);
	if (params?.order) searchParams.set("order", params.order);
	if (params?.filters) {
		Object.entries(params.filters).forEach(([k, v]) => {
			searchParams.set(k, String(v));
		});
	}

	const qs = searchParams.toString();
	const key = `/${resource}${qs ? `?${qs}` : ""}`;

	const {
		data,
		error,
		isLoading,
		mutate: swrMutate,
	} = useSWR<{
		data: T[];
		total?: number;
	}>(key, apiFetcher, { revalidateOnFocus: false });

	return {
		data: data?.data ?? [],
		total: data?.total ?? 0,
		loading: isLoading,
		error,
		mutate: () => swrMutate(),
	};
}

/** Replace Refine's useOne */
export function useOne<T = Record<string, unknown>>(
	resource: string,
	id: string | null,
): {
	data: T | undefined;
	loading: boolean;
	error: Error | undefined;
	mutate: () => void;
} {
	const {
		data,
		error,
		isLoading,
		mutate: swrMutate,
	} = useSWR<{ data: T }>(id ? `/${resource}/${id}` : null, apiFetcher, {
		revalidateOnFocus: false,
	});

	return {
		data: data?.data,
		loading: isLoading,
		error,
		mutate: () => swrMutate(),
	};
}

// ── Mutation helpers (replace Refine dataProvider mutations) ────────────────

export async function createRecord<T = Record<string, unknown>>(
	resource: string,
	payload: Partial<T>,
): Promise<T> {
	const res = await authFetch(`/api/${resource}`, {
		method: "POST",
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message || `${res.status} ${res.statusText}`);
	}

	const json = await res.json();
	// Invalidate every cached key for this resource — useList caches under
	// `/${resource}?page=...&limit=...`, so the bare `/${resource}` key SWR used
	// before never matched and lists never refreshed after create/edit/delete.
	mutate((key) => typeof key === "string" && key.startsWith(`/${resource}`), undefined, {
		revalidate: true,
	});
	return json.data ?? json;
}

export async function updateRecord<T = Record<string, unknown>>(
	resource: string,
	id: string,
	payload: Partial<T>,
): Promise<T> {
	// PATCH, not PUT — every backend resource route registers router.patch
	// (alerts, anomalies, apiKeys, datasets, marketNews, models, portfolios,
	// watchlist). The old PUT here 404'd against the PATCH-only routes,
	// breaking every edit flow (timeseries/edit, and any future news edit).
	const res = await authFetch(`/api/${resource}/${id}`, {
		method: "PATCH",
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message || `${res.status} ${res.statusText}`);
	}

	const json = await res.json();
	mutate((key) => typeof key === "string" && key.startsWith(`/${resource}`), undefined, {
		revalidate: true,
	});
	return json.data ?? json;
}

export async function deleteRecord(resource: string, id: string): Promise<void> {
	const res = await authFetch(`/api/${resource}/${id}`, {
		method: "DELETE",
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message || `${res.status} ${res.statusText}`);
	}

	mutate((key) => typeof key === "string" && key.startsWith(`/${resource}`), undefined, {
		revalidate: true,
	});
}
