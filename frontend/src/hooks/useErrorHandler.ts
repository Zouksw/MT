import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

export interface ErrorHandlerOptions {
	useNotification?: boolean;
	duration?: number;
	description?: string;
	logError?: boolean;
}

export interface ApiError {
	message?: string;
	error?: string;
	statusCode?: number;
	details?: unknown;
}

export function useErrorHandler() {
	const toast = useToast();

	const parseErrorMessage = useCallback((error: unknown): string => {
		if (typeof error === "string") return error;
		if (error && typeof error === "object") {
			if ("error" in error && typeof error.error === "string") return error.error;
			if ("message" in error && typeof error.message === "string") return error.message;
			if ("response" in error) {
				const response = (error as { response: { data?: ApiError } }).response;
				if (response.data?.error) return response.data.error;
				if (response.data?.message) return response.data.message;
			}
			if (error instanceof Error) return error.message;
		}
		return "An unexpected error occurred";
	}, []);

	const handleError = useCallback(
		(error: unknown, options: ErrorHandlerOptions = {}) => {
			const { logError = true } = options;
			const errorMessage = parseErrorMessage(error);
			if (logError) console.error("Error handled:", error);
			toast.showError(errorMessage, options.description);
			return errorMessage;
		},
		[parseErrorMessage, toast],
	);

	const withErrorHandling = useCallback(
		async <T>(
			operation: () => Promise<T>,
			options: ErrorHandlerOptions = {},
		): Promise<T | null> => {
			try {
				return await operation();
			} catch (error) {
				handleError(error, options);
				return null;
			}
		},
		[handleError],
	);

	const showSuccess = useCallback((msg: string) => toast.showSuccess(msg), [toast]);
	const showInfo = useCallback((msg: string) => toast.showInfo(msg), [toast]);
	const showWarning = useCallback((msg: string) => toast.showWarning(msg), [toast]);

	return { handleError, withErrorHandling, parseErrorMessage, showSuccess, showInfo, showWarning };
}

export function isNetworkError(error: unknown): boolean {
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		const msg = error.message.toLowerCase();
		return (
			msg.includes("network") ||
			msg.includes("fetch") ||
			msg.includes("connection") ||
			msg.includes("timeout")
		);
	}
	return false;
}

export function isAuthError(error: unknown): boolean {
	if (error && typeof error === "object") {
		if ("statusCode" in error) return error.statusCode === 401 || error.statusCode === 403;
		if ("response" in error) {
			const response = (error as { response: { status?: number } }).response;
			return response.status === 401 || response.status === 403;
		}
	}
	return false;
}
