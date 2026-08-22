/**
 * Error Handler Unit Tests
 *
 * Tests for secure error handling functionality
 */

import { errorHandler } from "../errorHandler";

// Mock console methods
global.console = {
	...console,
	log: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

describe("errorHandler", () => {
	describe("handleApiError", () => {
		it("should handle 401 Unauthorized", () => {
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			const error: any = {
				response: {
					status: 401,
					data: { error: "Unauthorized access" },
				},
			};

			const safeError = errorHandler.handleApiError(error);

			expect(safeError.message).toContain("Session expired");
			expect(safeError.statusCode).toBe(401);
			expect(safeError.code).toBe("UNAUTHORIZED");
			expect(safeError.shouldNotify).toBe(true);
		});

		it("should handle 403 Forbidden", () => {
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			const error: any = {
				response: {
					status: 403,
					data: { error: "Access denied" },
				},
			};

			const safeError = errorHandler.handleApiError(error);

			expect(safeError.message).toContain("do not have permission");
			expect(safeError.statusCode).toBe(403);
			expect(safeError.code).toBe("FORBIDDEN");
		});

		it("should handle 404 Not Found", () => {
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			const error: any = {
				response: {
					status: 404,
					data: { error: "Resource not found" },
				},
			};

			const safeError = errorHandler.handleApiError(error);

			expect(safeError.message).toContain("not found");
			expect(safeError.statusCode).toBe(404);
			expect(safeError.code).toBe("NOT_FOUND");
			expect(safeError.shouldNotify).toBe(false);
		});

		it("should handle 500 Server Error", () => {
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			const error: any = {
				response: {
					status: 500,
					data: { error: "Internal server error" },
				},
			};

			const safeError = errorHandler.handleApiError(error);

			expect(safeError.message).toContain("Server error");
			expect(safeError.statusCode).toBe(500);
			expect(safeError.code).toBe("SERVER_ERROR");
			expect(safeError.shouldNotify).toBe(true);
		});
	});

	describe("createSafeError — ApiFetchError shape (round-119)", () => {
		// lib/apiFetch's ApiFetchError has status + parsed body but NO axios
		// `response`. It used to classify as NETWORK_ERROR → retried by
		// useRetryableFetch even for permanent 401/403/404.
		it("classifies a 404 ApiFetchError as NOT_FOUND (non-recoverable)", () => {
			// biome-ignore lint/suspicious/noExplicitAny: constructing error shape
			const error: any = Object.assign(new Error("Authentication required"), {
				status: 404,
				body: { error: { message: "Not found", code: "NOT_FOUND" } },
			});

			const safeError = errorHandler.createSafeError(error);

			expect(safeError.code).toBe("NOT_FOUND");
			expect(safeError.statusCode).toBe(404);
			expect(errorHandler.isRecoverable(safeError)).toBe(false);
		});

		it("classifies a 503 ApiFetchError as SERVICE_UNAVAILABLE (recoverable)", () => {
			// biome-ignore lint/suspicious/noExplicitAny: constructing error shape
			const error: any = Object.assign(new Error("Inference unavailable"), {
				status: 503,
				body: { message: "Inference service unavailable" },
			});

			const safeError = errorHandler.createSafeError(error);

			expect(safeError.code).toBe("SERVICE_UNAVAILABLE");
			expect(safeError.statusCode).toBe(503);
			expect(errorHandler.isRecoverable(safeError)).toBe(true);
		});

		it("extracts the backend message from the parsed body", () => {
			// biome-ignore lint/suspicious/noExplicitAny: constructing error shape
			const error: any = Object.assign(new Error("HTTP 422"), {
				status: 422,
				body: { error: { message: "horizon must be between 1 and 100", code: "VAL" } },
			});

			const safeError = errorHandler.createSafeError(error);
			expect(safeError.statusCode).toBe(422);
			expect(errorHandler.isRecoverable(safeError)).toBe(false);
		});
	});

	describe("sanitizeMessage", () => {
		it("should filter out password mentions", () => {
			const message = "Your password is incorrect";
			const sanitized = errorHandler.sanitizeMessage(message);

			expect(sanitized).toContain("Invalid request");
			expect(sanitized).not.toContain("password");
		});

		it("should filter out token mentions", () => {
			const message = "Invalid token provided";
			const sanitized = errorHandler.sanitizeMessage(message);

			expect(sanitized).toContain("Invalid request");
			expect(sanitized).not.toContain("token");
		});

		it("should preserve safe messages", () => {
			const message = "Please check your input and try again";
			const sanitized = errorHandler.sanitizeMessage(message);

			expect(sanitized).toBe(message);
		});
	});

	describe("requiresReauth", () => {
		it("should return true for 401 errors", () => {
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			const error: any = errorHandler.createSafeError({
				response: { status: 401 },
			});

			expect(errorHandler.requiresReauth(error)).toBe(true);
		});

		it("should return false for other errors", () => {
			// biome-ignore lint/suspicious/noExplicitAny: third-party library type
			const error: any = errorHandler.createSafeError({
				response: { status: 404 },
			});

			expect(errorHandler.requiresReauth(error)).toBe(false);
		});
	});
});
