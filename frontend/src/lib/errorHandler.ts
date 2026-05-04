/**
 * Security-First Error Handler
 *
 * Centralized error handling that prevents information leakage
 * and provides user-friendly error messages.
 */

export interface SafeError {
	message: string;
	code?: string;
	shouldNotify: boolean;
	statusCode?: number;
}

export interface ApiError {
	response?: {
		status?: number;
		data?: {
			success?: boolean;
			error?:
				| {
						message?: string;
						code?: string;
						details?: unknown;
				  }
				| string; // Support both old (string) and new (object) formats
			message?: string; // Legacy support
			code?: string; // Legacy support
		};
	};
	message?: string;
	code?: string;
}

// Patterns that might expose sensitive information
const SENSITIVE_PATTERNS = [
	/password/i,
	/token/i,
	/secret/i,
	/api[_-]?key/i,
	/authorization/i,
	/bearer/i,
	/sql/i,
	/database/i,
	/connection/i,
	/stack trace/i,
	/internal server error/i,
	/undefined/i,
	/null/i,
	/cannot read/i,
	/is not a function/i,
	/unexpected token/i,
];

class SecurityErrorHandler {
	/**
	 * Handle API errors and return safe, user-friendly messages
	 * @param error - Error object from API call
	 * @returns Safe error with sanitized message
	 */
	handleApiError(error: unknown): SafeError {
		// Network error (no response)
		if (!this.hasResponse(error)) {
			return {
				message: this.sanitizeMessage("Network error. Please check your connection and try again."),
				code: "NETWORK_ERROR",
				shouldNotify: true,
				statusCode: undefined,
			};
		}

		const apiError = error as ApiError;
		const status = apiError.response?.status;
		const data = apiError.response?.data;

		// Extract error code and message from new backend format
		// New format: { success: false, error: { message, code, details } }
		// Old format: { error: string } or { message: string, code: string }
		let errorCode: string | undefined;
		let rawMessage: string;

		if (data?.error && typeof data.error === "object") {
			// New format - error is an object
			errorCode = data.error.code;
			rawMessage = data.error.message || apiError.message || "An error occurred";
		} else if (typeof data?.error === "string") {
			// Old format - error is a string
			rawMessage = data.error;
		} else {
			// Fallback - try legacy format
			errorCode = data?.code;
			rawMessage = data?.message || apiError.message || "An error occurred";
		}

		// Use extracted error code or derive from status code
		const finalErrorCode = errorCode || this.getErrorCodeFromStatus(status);

		// Handle based on status code
		return this.handleStatusCode(status, rawMessage, finalErrorCode);
	}

	/**
	 * Handle errors by HTTP status code
	 */
	private handleStatusCode(
		status: number | undefined,
		rawMessage: string,
		errorCode?: string,
	): SafeError {
		switch (status) {
			case 400:
				return {
					message: this.sanitizeMessage("Invalid request. Please check your input and try again."),
					code: errorCode || "BAD_REQUEST",
					shouldNotify: true,
					statusCode: 400,
				};

			case 401:
				return {
					message: "Session expired. Please login again.",
					code: errorCode || "UNAUTHORIZED",
					shouldNotify: true,
					statusCode: 401,
				};

			case 403:
				return {
					message: "You do not have permission to perform this action.",
					code: errorCode || "FORBIDDEN",
					shouldNotify: true,
					statusCode: 403,
				};

			case 404:
				return {
					message: "The requested resource was not found.",
					code: errorCode || "NOT_FOUND",
					shouldNotify: false, // Don't notify for 404s to reduce noise
					statusCode: 404,
				};

			case 409:
				return {
					message: this.sanitizeMessage(
						rawMessage || "This resource already exists or conflicts with existing data.",
					),
					code: errorCode || "CONFLICT",
					shouldNotify: true,
					statusCode: 409,
				};

			case 422:
				return {
					message: this.sanitizeMessage(
						rawMessage || "Invalid data provided. Please check your input.",
					),
					code: errorCode || "UNPROCESSABLE_ENTITY",
					shouldNotify: true,
					statusCode: 422,
				};

			case 429:
				return {
					message: "Too many requests. Please wait a moment and try again.",
					code: errorCode || "RATE_LIMIT_EXCEEDED",
					shouldNotify: true,
					statusCode: 429,
				};

			case 500:
				return {
					message: "Server error. Please try again later.",
					code: errorCode || "SERVER_ERROR",
					shouldNotify: true,
					statusCode: 500,
				};

			case 502:
			case 503:
			case 504:
				return {
					message: "Service temporarily unavailable. Please try again later.",
					code: errorCode || "SERVICE_UNAVAILABLE",
					shouldNotify: true,
					statusCode: status,
				};

			default:
				return {
					message: this.sanitizeMessage(rawMessage),
					code: errorCode || "UNKNOWN_ERROR",
					shouldNotify: true,
					statusCode: status,
				};
		}
	}

	/**
	 * Sanitize error message to remove sensitive information
	 * @param message - Raw error message
	 * @returns Sanitized message safe for user display
	 */
	sanitizeMessage(message: string): string {
		let sanitized = message;

		// Check for sensitive patterns
		for (const pattern of SENSITIVE_PATTERNS) {
			if (pattern.test(sanitized)) {
				// If sensitive info detected, return generic message
				return "Invalid request. Please check your input and try again.";
			}
		}

		// Remove any potential file paths
		sanitized = sanitized.replace(/\/[a-zA-Z0-9_.\-/]+\.(js|ts|tsx|jsx)/g, "[file]");

		// Remove stack traces
		sanitized = sanitized.split(/\n\s*at /)[0];

		// Limit length
		if (sanitized.length > 200) {
			sanitized = `${sanitized.substring(0, 200)}...`;
		}

		return sanitized.trim();
	}

	/**
	 * Check if error has a response property
	 */
	private hasResponse(error: unknown): boolean {
		return error !== null && typeof error === "object" && "response" in error;
	}

	/**
	 * Get error code from HTTP status code
	 */
	private getErrorCodeFromStatus(status: number | undefined): string {
		const statusToCode: Record<number, string> = {
			400: "BAD_REQUEST",
			401: "UNAUTHORIZED",
			403: "FORBIDDEN",
			404: "NOT_FOUND",
			409: "CONFLICT",
			422: "UNPROCESSABLE_ENTITY",
			429: "RATE_LIMIT_EXCEEDED",
			500: "SERVER_ERROR",
			502: "BAD_GATEWAY",
			503: "SERVICE_UNAVAILABLE",
			504: "GATEWAY_TIMEOUT",
		};
		return status ? statusToCode[status] || "UNKNOWN_ERROR" : "UNKNOWN_ERROR";
	}

	/**
	 * Handle client-side validation errors
	 */
	handleValidationError(field: string, message: string): SafeError {
		return {
			message: `${field}: ${this.sanitizeMessage(message)}`,
			code: "VALIDATION_ERROR",
			shouldNotify: true,
		};
	}

	/**
	 * Handle unexpected errors
	 */
	handleUnexpectedError(error: unknown): SafeError {
		// Log full error for debugging (in development)
		if (process.env.NODE_ENV === "development") {
			// eslint-disable-next-line no-console
			console.error("Unexpected error:", error);
		}

		return {
			message: "An unexpected error occurred. Please try again.",
			code: "UNEXPECTED_ERROR",
			shouldNotify: true,
		};
	}

	/**
	 * Create a safe error from any error type
	 */
	createSafeError(error: unknown): SafeError {
		if (this.isApiError(error)) {
			return this.handleApiError(error);
		} else if (error instanceof Error) {
			return {
				message: this.sanitizeMessage(error.message),
				code: "CLIENT_ERROR",
				shouldNotify: true,
			};
		} else if (typeof error === "string") {
			return {
				message: this.sanitizeMessage(error),
				code: "GENERIC_ERROR",
				shouldNotify: true,
			};
		} else {
			return this.handleUnexpectedError(error);
		}
	}

	/**
	 * Check if error is an API error
	 */
	private isApiError(error: unknown): error is ApiError {
		if (error === null || typeof error !== "object") {
			return false;
		}

		// Check for axios/fetch error structure
		if ("response" in error) {
			return true;
		}

		// Check for error with message
		if ("message" in error) {
			return true;
		}

		return false;
	}

	/**
	 * Extract error code from error
	 */
	getErrorCode(error: unknown): string {
		if (this.isApiError(error)) {
			const apiError = error as ApiError;
			const data = apiError.response?.data;

			// Try new format first: { success: false, error: { code } }
			if (data?.error && typeof data.error === "object") {
				return data.error.code || "UNKNOWN_ERROR";
			}

			// Try legacy format
			return data?.code || apiError.code || "UNKNOWN_ERROR";
		}
		return "UNKNOWN_ERROR";
	}

	/**
	 * Check if error is recoverable (user can retry)
	 */
	isRecoverable(error: SafeError): boolean {
		const recoverableCodes = [
			"NETWORK_ERROR",
			"RATE_LIMIT_EXCEEDED",
			"SERVICE_UNAVAILABLE",
			"SERVER_ERROR",
		];

		return recoverableCodes.includes(error.code || "");
	}

	/**
	 * Check if error requires re-authentication
	 */
	requiresReauth(error: SafeError): boolean {
		return error.code === "UNAUTHORIZED" || error.statusCode === 401;
	}
}

// Export singleton instance
export const errorHandler = new SecurityErrorHandler();

/**
 * Utility function to handle errors in async functions
 * Automatically shows notification with safe error message
 */
export async function withErrorHandling<T>(
	operation: () => Promise<T>,
	options: {
		showNotification?: boolean;
		notificationApi?: { error: (message: string) => void }; // Ant Design message API
		fallbackMessage?: string;
	} = {},
): Promise<T | null> {
	const { showNotification = true, notificationApi } = options;

	try {
		return await operation();
	} catch (error) {
		const safeError = errorHandler.createSafeError(error);

		if (showNotification && notificationApi) {
			if (safeError.shouldNotify) {
				notificationApi.error(safeError.message);
			}
		}

		// Log for debugging
		if (process.env.NODE_ENV === "development") {
			// eslint-disable-next-line no-console
			console.error("Operation failed:", safeError);
		}

		return null;
	}
}
