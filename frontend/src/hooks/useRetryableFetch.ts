"use client";

import { useCallback, useState } from "react";
import useSWR, { type Key, type KeyedMutator } from "swr";
import { errorHandler } from "@/lib/errorHandler";

export interface RetryableFetchOptions {
	maxRetries?: number;
	retryDelay?: number;
	backoffMultiplier?: number;
	shouldRetryOnError?: boolean;
}

export interface UseRetryableFetchResult<T> {
	data: T | undefined;
	error: Error | undefined;
	isLoading: boolean;
	isValidating: boolean;
	isRetrying: boolean;
	retryCount: number;
	manualRetry: () => void;
	mutate: KeyedMutator<T>;
}

/**
 * useRetryableFetch - SWR with automatic retry and exponential backoff
 */
export function useRetryableFetch<T = unknown>(
	key: Key | null,
	fetcher: (url: string) => Promise<T>,
	options: RetryableFetchOptions = {},
): UseRetryableFetchResult<T> {
	const {
		maxRetries = 3,
		retryDelay = 1000,
		backoffMultiplier = 2,
		shouldRetryOnError = true,
	} = options;

	const [retryCount, setRetryCount] = useState(0);
	const [isRetrying, setIsRetrying] = useState(false);
	const [lastError, setLastError] = useState<Error | undefined>(undefined);

	const getDelay = useCallback(
		(attempts: number): number => {
			return retryDelay * backoffMultiplier ** attempts;
		},
		[retryDelay, backoffMultiplier],
	);

	const manualRetry = useCallback(() => {
		setRetryCount(0);
		setLastError(undefined);
	}, []);

	const swrResponse = useSWR<T>(key, fetcher, {
		revalidateOnFocus: false,
		dedupingInterval: 30000,
		shouldRetryOnError: false,
		onError: (error, key) => {
			const safeError = errorHandler.createSafeError(error);
			const isRecoverable = errorHandler.isRecoverable(safeError);

			if (shouldRetryOnError && isRecoverable && retryCount < maxRetries) {
				const delay = getDelay(retryCount);

				if (process.env.NODE_ENV === "development") {
					console.log(
						`[useRetryableFetch] Retry ${retryCount + 1}/${maxRetries} after ${delay}ms for ${key}:`,
						safeError.message,
					);
				}

				setRetryCount((prev) => prev + 1);
				setIsRetrying(true);
				setLastError(error as Error);

				setTimeout(() => {
					swrResponse.mutate();
				}, delay);
			} else {
				if (retryCount >= maxRetries) {
					if (process.env.NODE_ENV === "development") {
						console.error(`[useRetryableFetch] Max retries (${maxRetries}) exceeded for ${key}`);
					}
					setIsRetrying(false);
				}
			}
		},
		onSuccess: () => {
			if (retryCount > 0) {
				if (process.env.NODE_ENV === "development") {
					console.log(`[useRetryableFetch] Success after ${retryCount} retries for ${key}`);
				}
				setRetryCount(0);
				setIsRetrying(false);
				setLastError(undefined);
			}
		},
	});

	return {
		data: swrResponse.data,
		error: lastError || swrResponse.error,
		isLoading: !swrResponse.error && !swrResponse.data,
		isValidating: swrResponse.isValidating,
		isRetrying,
		retryCount,
		manualRetry,
		mutate: swrResponse.mutate,
	};
}

export function useRetryableFetchSimple<T = unknown>(
	key: Key | null,
	fetcher: (url: string) => Promise<T>,
): UseRetryableFetchResult<T> {
	return useRetryableFetch(key, fetcher, {
		maxRetries: 3,
		retryDelay: 1000,
		backoffMultiplier: 2,
	});
}

export default useRetryableFetch;
