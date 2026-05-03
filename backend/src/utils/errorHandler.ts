/**
 * Unified Error Handling Utilities
 *
 * Provides centralized error handling utilities with consistent patterns
 * following the project's fail-closed/fail-open philosophy
 */

import { logger } from "./logger";

/**
 * Error handling options
 */
export interface ErrorHandlerOptions {
	/** Custom error message for production */
	productionMessage?: string;
	/** Whether to throw the error or return it */
	shouldThrow?: true;
}

/**
 * Handles service errors with consistent logging and error messages
 * Uses fail-closed pattern in production for security
 *
 * @param error - The caught error
 * @param context - Service/function name for logging
 * @param options - Error handling options
 * @throws Always throws (for type inference)
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   handleServiceError(error, 'UserService', 'Failed to create user');
 * }
 * ```
 */
export function handleServiceError(
	error: unknown,
	context: string,
	options: ErrorHandlerOptions = {},
): never {
	const { productionMessage = "System error. Please try again later." } =
		options;

	// Log the full error for debugging
	logger.error(`[${context}] Error:`, error);

	// Determine the error message based on environment
	const message =
		process.env.NODE_ENV === "production"
			? productionMessage
			: error instanceof Error
				? error.message
				: String(error);

	throw new Error(message);
}

/**
 * Handles errors with optional fallback value
 * Useful when you want to return a default value instead of throwing
 *
 * @param error - The caught error
 * @param context - Service/function name for logging
 * @param fallback - Fallback value to return
 * @returns The fallback value
 *
 * @example
 * ```typescript
 * try {
 *   return await fetchConfig();
 * } catch (error) {
 *   return handleErrorWithFallback(error, 'ConfigService', getDefaultConfig());
 * }
 * ```
 */
export function handleErrorWithFallback<T>(
	error: unknown,
	context: string,
	fallback: T,
): T {
	logger.error(`[${context}] Error:`, error);
	return fallback;
}

/**
 * Type guard to check if value is an Error instance
 */
export function isError(value: unknown): value is Error {
	return value instanceof Error;
}

/**
 * Type guard to check if value has a message property
 */
export function hasMessage(value: unknown): value is { message: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		"message" in value &&
		typeof (value as { message: unknown }).message === "string"
	);
}

/**
 * Extract error message from unknown error type
 */
export function extractErrorMessage(error: unknown): string {
	if (isError(error)) {
		return error.message;
	}
	if (hasMessage(error)) {
		return error.message;
	}
	return String(error);
}

/**
 * Create a standardized error object for API responses
 */
export interface ApiErrorObject {
	message: string;
	code?: string;
	context?: string;
	isOperational?: boolean;
}

/**
 * Create an API error object
 */
export function createApiError(
	message: string,
	options: {
		code?: string;
		context?: string;
		isOperational?: boolean;
	} = {},
): ApiErrorObject {
	return {
		message,
		...options,
	};
}

/**
 * Async wrapper with error handling
 * Automatically catches and handles errors for async operations
 *
 * @example
 * ```typescript
 * const result = await withErrorHandling(
 *   async () => await fetchData(),
 *   'DataService',
 *   { fallback: [] }
 * );
 * ```
 */
export async function withErrorHandling<T>(
	operation: () => Promise<T>,
	context: string,
	options: {
		productionMessage?: string;
		fallback?: T;
	} = {},
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (options.fallback !== undefined) {
			return handleErrorWithFallback(error, context, options.fallback);
		}
		return handleServiceError(error, context, {
			productionMessage: options.productionMessage,
		});
	}
}
