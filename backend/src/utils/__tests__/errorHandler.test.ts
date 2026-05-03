/**
 * Tests for errorHandler utilities
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createApiError,
	extractErrorMessage,
	handleErrorWithFallback,
	handleServiceError,
	hasMessage,
	isError,
	withErrorHandling,
} from "@/utils/errorHandler";

// Mock logger
vi.mock("@/utils/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import { logger } from "../logger";

describe("errorHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("handleServiceError", () => {
		const originalEnv = process.env.NODE_ENV;

		afterAll(() => {
			process.env.NODE_ENV = originalEnv;
		});

		it("should throw error with message in development", () => {
			process.env.NODE_ENV = "development";
			const error = new Error("Test error");

			expect(() => handleServiceError(error, "TestService")).toThrow(
				"Test error",
			);
			expect(logger.error).toHaveBeenCalledWith("[TestService] Error:", error);
		});

		it("should throw generic message in production", () => {
			process.env.NODE_ENV = "production";
			const error = new Error("Detailed error message");

			expect(() => handleServiceError(error, "TestService")).toThrow(
				"System error. Please try again later.",
			);
			expect(logger.error).toHaveBeenCalledWith("[TestService] Error:", error);
		});

		it("should use custom production message when provided", () => {
			process.env.NODE_ENV = "production";
			const error = new Error("Detailed error");

			expect(() =>
				handleServiceError(error, "TestService", {
					productionMessage: "Custom production message",
				}),
			).toThrow("Custom production message");
		});

		it("should handle non-Error objects", () => {
			process.env.NODE_ENV = "development";

			expect(() => handleServiceError("String error", "TestService")).toThrow(
				"String error",
			);
			expect(() => handleServiceError(12345, "TestService")).toThrow("12345");
		});

		it("should handle null and undefined", () => {
			process.env.NODE_ENV = "development";

			expect(() => handleServiceError(null, "TestService")).toThrow("null");
			expect(() => handleServiceError(undefined, "TestService")).toThrow(
				"undefined",
			);
		});
	});

	describe("handleErrorWithFallback", () => {
		it("should log error and return fallback value", () => {
			const error = new Error("Test error");
			const fallback = { data: "default" };

			const result = handleErrorWithFallback(error, "TestService", fallback);

			expect(result).toEqual(fallback);
			expect(logger.error).toHaveBeenCalledWith("[TestService] Error:", error);
		});

		it("should return different fallback types", () => {
			const error = new Error("Test error");

			expect(handleErrorWithFallback(error, "Service", "default string")).toBe(
				"default string",
			);
			expect(handleErrorWithFallback(error, "Service", 42)).toBe(42);
			expect(handleErrorWithFallback(error, "Service", null)).toBeNull();
			expect(handleErrorWithFallback(error, "Service", [])).toEqual([]);
		});
	});

	describe("isError", () => {
		it("should return true for Error instances", () => {
			const error = new Error("Test");
			expect(isError(error)).toBe(true);
		});

		it("should return true for Error subclasses", () => {
			const typeError = new TypeError("Type error");
			const rangeError = new RangeError("Range error");

			expect(isError(typeError)).toBe(true);
			expect(isError(rangeError)).toBe(true);
		});

		it("should return false for non-Error values", () => {
			expect(isError("string")).toBe(false);
			expect(isError(123)).toBe(false);
			expect(isError(null)).toBe(false);
			expect(isError(undefined)).toBe(false);
			expect(isError({})).toBe(false);
			expect(isError({ message: "fake" })).toBe(false);
		});
	});

	describe("hasMessage", () => {
		it("should return true for objects with string message property", () => {
			expect(hasMessage({ message: "test" })).toBe(true);
			expect(hasMessage({ message: "", other: 123 })).toBe(true);
		});

		it("should return false for objects without message or wrong type", () => {
			expect(hasMessage({})).toBe(false);
			expect(hasMessage({ message: 123 })).toBe(false);
			expect(hasMessage({ message: null })).toBe(false);
			expect(hasMessage(null)).toBe(false);
			expect(hasMessage(undefined)).toBe(false);
			expect(hasMessage("string")).toBe(false);
		});
	});

	describe("extractErrorMessage", () => {
		it("should extract message from Error instance", () => {
			const error = new Error("Error message");
			expect(extractErrorMessage(error)).toBe("Error message");
		});

		it("should extract message from object with message property", () => {
			const obj = { message: "Object message" };
			expect(extractErrorMessage(obj)).toBe("Object message");
		});

		it("should convert other types to string", () => {
			expect(extractErrorMessage("string")).toBe("string");
			expect(extractErrorMessage(123)).toBe("123");
			expect(extractErrorMessage(null)).toBe("null");
			expect(extractErrorMessage(undefined)).toBe("undefined");
		});
	});

	describe("createApiError", () => {
		it("should create error object with message only", () => {
			const error = createApiError("Test error");
			expect(error).toEqual({ message: "Test error" });
		});

		it("should create error object with all options", () => {
			const error = createApiError("Test error", {
				code: "TEST_ERROR",
				context: "TestContext",
				isOperational: true,
			});

			expect(error).toEqual({
				message: "Test error",
				code: "TEST_ERROR",
				context: "TestContext",
				isOperational: true,
			});
		});

		it("should handle partial options", () => {
			const error = createApiError("Test error", {
				code: "PARTIAL",
			});

			expect(error).toEqual({
				message: "Test error",
				code: "PARTIAL",
			});
		});
	});

	describe("withErrorHandling", () => {
		it("should return operation result when successful", async () => {
			const operation = async () => "success";
			const result = await withErrorHandling(operation, "TestService");

			expect(result).toBe("success");
		});

		it("should throw when operation fails and no fallback", async () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			const operation = async () => {
				throw new Error("Operation failed");
			};

			await expect(withErrorHandling(operation, "TestService")).rejects.toThrow(
				"Operation failed",
			);

			process.env.NODE_ENV = originalEnv;
		});

		it("should return fallback when operation fails", async () => {
			const operation = async () => {
				throw new Error("Operation failed");
			};

			const result = await withErrorHandling(operation, "TestService", {
				fallback: "fallback value",
			});

			expect(result).toBe("fallback value");
			expect(logger.error).toHaveBeenCalled();
		});

		it("should use custom production message", async () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const operation = async () => {
				throw new Error("Detailed error");
			};

			await expect(
				withErrorHandling(operation, "TestService", {
					productionMessage: "Custom error",
				}),
			).rejects.toThrow("Custom error");

			process.env.NODE_ENV = originalEnv;
		});

		it("should handle different return types", async () => {
			const operation1 = async () => 42;
			const result1 = await withErrorHandling(operation1, "Service");
			expect(result1).toBe(42);

			const operation2 = async () => ({ data: "test" });
			const result2 = await withErrorHandling(operation2, "Service");
			expect(result2).toEqual({ data: "test" });

			const operation3 = async () => [1, 2, 3];
			const result3 = await withErrorHandling(operation3, "Service");
			expect(result3).toEqual([1, 2, 3]);
		});

		it("should handle fallback with different types", async () => {
			const operation = async () => {
				throw new Error("Fail");
			};

			expect(
				await withErrorHandling(operation, "Service", { fallback: null }),
			).toBeNull();
			expect(
				await withErrorHandling(operation, "Service", { fallback: 0 }),
			).toBe(0);
			expect(
				await withErrorHandling(operation, "Service", { fallback: false }),
			).toBe(false);
			expect(
				await withErrorHandling(operation, "Service", { fallback: [] }),
			).toEqual([]);
		});
	});
});
