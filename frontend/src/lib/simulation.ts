"use client";

import useSWR from "swr";
import { fetcher } from "./market-data";

export interface SimAccountSummary {
	id: string;
	name: string;
	initialBalance: number;
	currentBalance: number;
	totalPnl: number;
	totalRealizedPnl: number;
	openTradeCount: number;
	closedTradeCount: number;
	pendingOrderCount: number;
	isActive: boolean;
	recentTrades: Array<{
		id: string;
		side: string;
		quantity: number;
		entryPrice: number;
		exitPrice: number | null;
		realizedPnl: number | null;
		commission: number;
		commodity: { slug: string; name: string; unit: string };
		openedAt: string;
		closedAt: string | null;
	}>;
	recentOrders: Array<{
		id: string;
		side: string;
		type: string;
		quantity: number;
		price: number | null;
		status: string;
		filledPrice: number | null;
		commodity: { slug: string; name: string; unit: string };
		placedAt: string;
	}>;
}

export function useSimAccounts() {
	const { data, error, mutate } = useSWR<{
		success: boolean;
		data: {
			accounts: Array<{
				id: string;
				name: string;
				initialBalance: number;
				currentBalance: number;
				pnl: number;
				orderCount: number;
				tradeCount: number;
				isActive: boolean;
			}>;
		};
	}>("/sim/accounts", fetcher, { refreshInterval: 10000 });

	return {
		accounts: data?.data?.accounts ?? [],
		loading: !data && !error,
		error,
		mutate,
	};
}

export function useSimAccount(accountId: string | null) {
	const { data, error } = useSWR<{ success: boolean; data: { account: SimAccountSummary } }>(
		accountId ? `/sim/accounts/${accountId}` : null,
		fetcher,
		{ refreshInterval: 10000 },
	);

	return {
		account: data?.data?.account ?? null,
		loading: !data && !error,
		error,
	};
}

export function useSimOrders(accountId: string | null) {
	const { data, error } = useSWR<{
		success: boolean;
		data: { orders: Array<Record<string, unknown>> };
	}>(accountId ? `/sim/accounts/${accountId}/orders` : null, fetcher, { refreshInterval: 5000 });

	return {
		orders: data?.data?.orders ?? [],
		loading: !data && !error,
	};
}

export function useSimTrades(accountId: string | null) {
	const { data, error } = useSWR<{
		success: boolean;
		data: { trades: Array<Record<string, unknown>> };
	}>(accountId ? `/sim/accounts/${accountId}/trades` : null, fetcher, { refreshInterval: 10000 });

	return {
		trades: data?.data?.trades ?? [],
		loading: !data && !error,
	};
}
