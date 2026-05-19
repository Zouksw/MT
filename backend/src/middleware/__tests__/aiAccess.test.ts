/**
 * Tests for AI Access Control middleware
 */

import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAIAccess } from "@/middleware/aiAccess";
import type { AuthRequest } from "@/middleware/auth";

// Mock logger
vi.mock("@/lib/logger", () => ({
	logger: {
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

import { logger } from "@/lib/logger";

describe("AI Access Control Middleware", () => {
	let mockReq: Partial<AuthRequest>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();

		// Reset environment variables
		delete process.env.AI_FEATURES_DISABLED;
		delete process.env.AI_ALLOWED_IPS;

		mockReq = {
			method: "GET",
			path: "/api/ai/predict",
			ip: "192.168.1.100",
			socket: { remoteAddress: "192.168.1.100" },
			params: {},
			query: {},
			body: {},
			get: vi.fn((header: string) => {
				if (header === "If-None-Match") return undefined;
				return undefined;
			}),
		};

		mockRes = {
			statusCode: 200,
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
			locals: {},
		};

		mockNext = vi.fn();
	});

	describe("checkAIAccess", () => {
		it("should allow access for authenticated admin user", async () => {
			mockReq.user = {
				id: "admin-123",
				email: "admin@example.com",
				role: "ADMIN",
			};

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("[AI_ACCESS] AI feature accessed by admin@example.com"),
			);
		});

		it("should deny access when AI features are disabled", () => {
			process.env.AI_FEATURES_DISABLED = "true";

			mockReq.user = {
				id: "admin-123",
				email: "admin@example.com",
				role: "ADMIN",
			};

			expect(() => checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext)).toThrow(
				"AI features are currently disabled",
			);

			expect(logger.warn).toHaveBeenCalledWith("[AI_ACCESS] AI features are disabled");
		});

		it("should deny access for unauthenticated user", async () => {
			mockReq.user = undefined;

			expect(() => checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext)).toThrow(
				"Authentication required",
			);

			expect(logger.warn).toHaveBeenCalledWith("[AI_ACCESS] Unauthenticated AI access attempt");
		});

		it("should allow access for EDITOR role", async () => {
			mockReq.user = {
				id: "user-123",
				email: "user@example.com",
				role: "EDITOR",
			};

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("[AI_ACCESS] AI feature accessed by user@example.com"),
			);
		});

		// Note: IP whitelist functionality is tested through integration tests
		// The module-level constant AI_ALLOWED_IPS makes unit testing complex
		// These tests verify the middleware handles IPs correctly in other scenarios

		it("should handle IPv6 addresses in IP extraction", async () => {
			mockReq.user = {
				id: "admin-123",
				email: "admin@example.com",
				role: "ADMIN",
			};
			mockReq.ip = "::ffff:192.168.1.100";

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should extract IP from socket.remoteAddress when req.ip is undefined", async () => {
			process.env.AI_ALLOWED_IPS = "10.0.0.5";

			mockReq.user = {
				id: "admin-123",
				email: "admin@example.com",
				role: "ADMIN",
			};
			mockReq.ip = undefined;
			mockReq.socket = { remoteAddress: "10.0.0.5" };

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should log IP address in access logs", async () => {
			mockReq.user = {
				id: "admin-123",
				email: "admin@example.com",
				role: "ADMIN",
			};
			mockReq.ip = "10.0.0.50";

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("from 10.0.0.50"));
		});

		it.skip("should handle multiple IPs in whitelist", async () => {
			// This test would require jest.isolateModules() which is complex
		});

		it("should allow access for MODERATOR role", async () => {
			mockReq.user = {
				id: "moderator-123",
				email: "moderator@example.com",
				role: "MODERATOR",
			};

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should allow access for VIEWER role", async () => {
			mockReq.user = {
				id: "viewer-123",
				email: "viewer@example.com",
				role: "VIEWER",
			};

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});

	describe("IP Extraction Edge Cases", () => {
		it("should handle unknown IP gracefully", async () => {
			mockReq.user = {
				id: "admin-123",
				email: "admin@example.com",
				role: "ADMIN",
			};
			mockReq.ip = undefined;
			mockReq.socket = { remoteAddress: undefined };

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("from unknown"));
		});

		it("should handle IP with port number", async () => {
			mockReq.user = {
				id: "admin-123",
				email: "admin@example.com",
				role: "ADMIN",
			};
			mockReq.ip = "192.168.1.100:8080";
			mockReq.socket = { remoteAddress: "192.168.1.100:8080" };

			await checkAIAccess(mockReq as AuthRequest, mockRes as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});
	});
});
