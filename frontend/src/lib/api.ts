"use client";

import useSWR, { mutate } from "swr";
import { tokenManager } from "@/lib/tokenManager";
import { authFetch } from "@/utils/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── SWR fetcher with auth ──────────────────────────────────────────────────

async function apiFetcher(url: string) {
	const token = tokenManager.getToken();
	const res = await fetch(`${API_BASE}/api${url}`, {
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		credentials: "include",
	});

	if (!res.ok) {
		const error = new Error(`${res.status} ${res.statusText}`);
		(error as { status?: number }).status = res.status;
		throw error;
	}

	return res.json();
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
export function useList<T = Record<string, unknown>>(resource: string, params?: ListParams): ListResult<T> {
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

export async function createRecord<T = Record<string, unknown>>(resource: string, payload: Partial<T>): Promise<T> {
	const res = await authFetch(`/api/${resource}`, {
		method: "POST",
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message || `${res.status} ${res.statusText}`);
	}

	const json = await res.json();
	mutate(`/${resource}`);
	return json.data ?? json;
}

export async function updateRecord<T = Record<string, unknown>>(
	resource: string,
	id: string,
	payload: Partial<T>,
): Promise<T> {
	const res = await authFetch(`/api/${resource}/${id}`, {
		method: "PUT",
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message || `${res.status} ${res.statusText}`);
	}

	const json = await res.json();
	mutate(`/${resource}`);
	mutate(`/${resource}/${id}`);
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

	mutate(`/${resource}`);
	mutate(`/${resource}/${id}`);
}
