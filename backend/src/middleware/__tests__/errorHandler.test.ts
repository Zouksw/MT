/**
 * Tests for Error Handler middleware
 * Security-critical middleware that handles all errors in the application
 */

import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import {
	ApiError,
	asyncHandler,
	BadRequestError,
	ConflictError,
	errorHandler,
	ForbiddenError,
	NotFoundError,
	ServiceUnavailableError,
	UnauthorizedError,
	ValidationError,
} from "@/middleware/errorHandler";
import { logger } from "@/utils/logger";

// Mock logger
vi.mock("@/utils/logger", () => ({
	logger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}));

const mockLogger = logger as vi.Mocked<typeof logger>;

describe("Error Handler Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();

		mockReq = {
			path: "/test/path",
			method: "GET",
		};

		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		};

		mockNext = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("errorHandler", () => {
		it("should handle Zod validation errors", () => {
			const zodError = new ZodError([
				{
					code: "invalid_type",
					expected: "string",
					received: "number",
					path: ["email"],
					message: "Expected string, received number",
				},
			]);

			errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Validation error",
					code: "VALIDATION_ERROR",
					details: zodError.errors,
				},
			});
			expect(mockLogger.error).toHaveBeenCalled();
		});

		it("should handle Prisma unique constraint violations", () => {
			const prismaError: any = new Error("Unique constraint failed");
			prismaError.constructor = { name: "PrismaClientKnownRequestError" };
			prismaError.code = "P2002";
			prismaError.meta = { target: ["email"] };

			errorHandler(
				prismaError,
				mockReq as Request,
				mockRes as Response,
				mockNext,
			);

			expect(mockRes.status).toHaveBeenCalledWith(409);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Resource already exists",
					code: "CONFLICT",
					details: ["email"],
				},
			});
		});

		it("should handle Prisma record not found errors", () => {
			const prismaError: any = new Error("Record not found");
			prismaError.constructor = { name: "PrismaClientKnownRequestError" };
			prismaError.code = "P2025";

			errorHandler(
				prismaError,
				mockReq as Request,
				mockRes as Response,
				mockNext,
			);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Resource not found",
					code: "NOT_FOUND",
				},
			});
		});

		it("should handle Prisma foreign key constraint errors", () => {
			const prismaError: any = new Error("Foreign key constraint failed");
			prismaError.constructor = { name: "PrismaClientKnownRequestError" };
			prismaError.code = "P2003";

			errorHandler(
				prismaError,
				mockReq as Request,
				mockRes as Response,
				mockNext,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Invalid reference",
					code: "BAD_REQUEST",
					details: "Related resource not found",
				},
			});
		});

		it("should handle JWT invalid token errors", () => {
			const jwtError: any = new Error("Invalid token");
			jwtError.name = "JsonWebTokenError";

			errorHandler(jwtError, mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Invalid token",
					code: "UNAUTHORIZED",
				},
			});
		});

		it("should handle JWT token expired errors", () => {
			const jwtError: any = new Error("Token expired");
			jwtError.name = "TokenExpiredError";

			errorHandler(jwtError, mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Token expired",
					code: "UNAUTHORIZED",
				},
			});
		});

		it("should handle operational errors with custom message", () => {
			const error = new ApiError(400, "Bad request", true);

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Bad request",
					code: "BAD_REQUEST",
				},
			});
		});

		it("should handle non-operational errors in production", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			const error = new Error("Internal error details");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Internal server error",
					code: "SERVER_ERROR",
				},
			});

			process.env.NODE_ENV = originalEnv;
		});

		it("should handle non-operational errors in development", () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "development";

			const error = new Error("Internal error details");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: {
					message: "Internal error details",
					code: "SERVER_ERROR",
				},
			});

			process.env.NODE_ENV = originalEnv;
		});

		it("should use correct error codes for different status codes", () => {
			const testCases = [
				[400, "BAD_REQUEST"],
				[401, "UNAUTHORIZED"],
				[403, "FORBIDDEN"],
				[404, "NOT_FOUND"],
				[409, "CONFLICT"],
				[429, "RATE_LIMIT_EXCEEDED"],
				[500, "SERVER_ERROR"],
				[503, "SERVICE_UNAVAILABLE"],
			];

			testCases.forEach(([statusCode, expectedCode]) => {
				vi.clearAllMocks();
				const error = new ApiError(statusCode as number, "Test error", true);

				errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

				expect(mockRes.status).toHaveBeenCalledWith(statusCode);
				expect(mockRes.json).toHaveBeenCalledWith({
					success: false,
					error: {
						message: "Test error",
						code: expectedCode,
					},
				});
			});
		});

		it("should log error details", () => {
			const error = new Error("Test error");
			error.stack = "Error: Test error\n    at test.js:10:15";

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(mockLogger.error).toHaveBeenCalledWith("Error occurred:", {
				message: "Test error",
				stack: error.stack,
				path: "/test/path",
				method: "GET",
			});
		});
	});

	describe("asyncHandler", () => {
		it("should catch errors in async handlers", async () => {
			const handler = vi.fn().mockRejectedValue(new Error("Async error"));

			const wrappedHandler = asyncHandler(handler);

			await wrappedHandler(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Async error",
				}),
			);
		});

		it("should pass through successful async handlers", async () => {
			const handler = vi.fn().mockResolvedValue("Success");

			const wrappedHandler = asyncHandler(handler);

			await wrappedHandler(mockReq as Request, mockRes as Response, mockNext);

			expect(mockNext).not.toHaveBeenCalled();
		});
	});

	describe("Error Classes", () => {
		describe("BadRequestError", () => {
			it("should create 400 error", () => {
				const error = new BadRequestError("Invalid input");

				expect(error).toBeInstanceOf(ApiError);
				expect(error.statusCode).toBe(400);
				expect(error.message).toBe("Invalid input");
				expect(error.isOperational).toBe(true);
			});
		});

		describe("UnauthorizedError", () => {
			it("should create 401 error with default message", () => {
				const error = new UnauthorizedError();

				expect(error.statusCode).toBe(401);
				expect(error.message).toBe("Unauthorized");
				expect(error.isOperational).toBe(true);
			});

			it("should create 401 error with custom message", () => {
				const error = new UnauthorizedError("Custom message");

				expect(error.message).toBe("Custom message");
			});
		});

		describe("ForbiddenError", () => {
			it("should create 403 error with default message", () => {
				const error = new ForbiddenError();

				expect(error.statusCode).toBe(403);
				expect(error.message).toBe("Forbidden");
				expect(error.isOperational).toBe(true);
			});

			it("should create 403 error with custom message", () => {
				const error = new ForbiddenError("Custom message");

				expect(error.message).toBe("Custom message");
			});
		});

		describe("NotFoundError", () => {
			it("should create 404 error with default message", () => {
				const error = new NotFoundError();

				expect(error.statusCode).toBe(404);
				expect(error.message).toBe("Resource not found");
				expect(error.isOperational).toBe(true);
			});

			it("should create 404 error with custom resource", () => {
				const error = new NotFoundError("User");

				expect(error.message).toBe("User not found");
			});
		});

		describe("ConflictError", () => {
			it("should create 409 error", () => {
				const error = new ConflictError("Resource already exists");

				expect(error.statusCode).toBe(409);
				expect(error.message).toBe("Resource already exists");
				expect(error.isOperational).toBe(true);
			});
		});

		describe("ValidationError", () => {
			it("should create 400 error with details", () => {
				const details = { field: "email", issue: "Invalid format" };
				const error = new ValidationError(details);

				expect(error.statusCode).toBe(400);
				expect(error.message).toBe("Validation failed");
				expect(error.details).toEqual(details);
				expect(error.isOperational).toBe(true);
			});
		});

		describe("ServiceUnavailableError", () => {
			it("should create 503 error with default message", () => {
				const error = new ServiceUnavailableError();

				expect(error.statusCode).toBe(503);
				expect(error.message).toBe("Service temporarily unavailable");
				expect(error.isOperational).toBe(true);
			});

			it("should create 503 error with custom message", () => {
				const error = new ServiceUnavailableError("Database down");

				expect(error.message).toBe("Database down");
			});
		});
	});
});
