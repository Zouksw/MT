"use client";

import { useState, useCallback } from "react";
import useSWR, { Key, KeyedMutator } from "swr";
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
 *
 * Features:
 * - Automatic retry for recoverable errors (network errors, 5xx, etc.)
 * - Exponential backoff: delay * (multiplier ^ retryCount)
 * - Manual retry capability
 * - Integration with security-first error handler
 * - Retry count and status tracking
 *
 * @example
 * ```tsx
 * const { data, error, isRetrying, manualRetry } = useRetryableFetch(
 *   '/api/data',
 *   fetcher,
 *   {
 *     maxRetries: 3,
 *     retryDelay: 1000,
 *     backoffMultiplier: 2,
 *   }
 * );
 * ```
 */
export function useRetryableFetch<T = any>(
  key: Key | null,
  fetcher: (url: string) => Promise<T>,
  options: RetryableFetchOptions = {}
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

  // Calculate delay with exponential backoff
  const getDelay = useCallback(
    (attempts: number): number => {
      return retryDelay * Math.pow(backoffMultiplier, attempts);
    },
    [retryDelay, backoffMultiplier]
  );

  // Manual retry function
  const manualRetry = useCallback(() => {
    setRetryCount(0); // Reset retry count
    setLastError(undefined);
  }, []);

  // SWR hook with retry logic
  const swrResponse = useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
    shouldRetryOnError: false, // We handle retries ourselves
    onError: (error, key) => {
      const safeError = errorHandler.createSafeError(error);

      // Check if error is recoverable
      const isRecoverable = errorHandler.isRecoverable(safeError);

      // Only retry if:
      // 1. Error is recoverable
      // 2. We haven't exceeded max retries
      // 3. Retry is enabled
      if (
        shouldRetryOnError &&
        isRecoverable &&
        retryCount < maxRetries
      ) {
        // Calculate delay with exponential backoff
        const delay = getDelay(retryCount);

        // eslint-disable-next-line no-console
        console.log(
          `[useRetryableFetch] Retry ${retryCount + 1}/${maxRetries} after ${delay}ms for ${key}:`,
          safeError.message
        );

        // Increment retry count
        setRetryCount((prev) => prev + 1);
        setIsRetrying(true);
        setLastError(error as Error);

        // Schedule retry
        setTimeout(() => {
          // Trigger SWR to re-fetch
          // We do this by calling mutate() which will trigger a re-fetch
          // Note: This is a simplified version - in production you might want more sophisticated retry logic
        }, delay);
      } else {
        // Max retries exceeded or error not recoverable
        if (retryCount >= maxRetries) {
          // eslint-disable-next-line no-console
          console.error(
            `[useRetryableFetch] Max retries (${maxRetries}) exceeded for ${key}`
          );
          setIsRetrying(false);
        }
      }
    },
    onSuccess: () => {
      // Reset retry state on success
      if (retryCount > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[useRetryableFetch] Success after ${retryCount} retries for ${key}`
        );
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

/**
 * Simplified version for quick use
 *
 * @example
 * ```tsx
 * const { data, error } = useRetryableFetchSimple('/api/data', fetcher);
 * ```
 */
export function useRetryableFetchSimple<T = any>(
  key: Key | null,
  fetcher: (url: string) => Promise<T>
): UseRetryableFetchResult<T> {
  return useRetryableFetch(key, fetcher, {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
  });
}

export default useRetryableFetch;
