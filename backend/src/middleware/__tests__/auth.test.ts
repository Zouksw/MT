import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type AuthRequest,
	authenticate,
	authorize,
	optionalAuth,
} from "@/middleware/auth";

// vi.hoisted() ensures these are available inside hoisted vi.mock() factories
const { mockVerifyToken, mockUserFindUnique, mockIsTokenBlacklisted } =
	vi.hoisted(() => ({
		mockVerifyToken: vi.fn(),
		mockUserFindUnique: vi.fn(),
		mockIsTokenBlacklisted: vi.fn(),
	}));

vi.mock("@/lib", () => ({
	prisma: {
		user: {
			findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
			count: vi.fn().mockResolvedValue(0),
		},
	},
	jwtUtils: {
		verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
	},
	logger: {
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@/services/tokenBlacklist", () => ({
	isTokenBlacklisted: (...args: unknown[]) => mockIsTokenBlacklisted(...args),
}));

describe("authenticate middleware", () => {
	let mockReq: Partial<AuthRequest>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();
		mockReq = { headers: {}, ip: "127.0.0.1" };
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		};
		mockNext = vi.fn();
	});

	it("should return 401 when no authorization header", async () => {
		await authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(401);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "No token provided", code: "UNAUTHORIZED" },
		});
		expect(mockNext).not.toHaveBeenCalled();
	});

	it("should return 401 when authorization header does not start with Bearer", async () => {
		mockReq.headers = { authorization: "InvalidFormat token" };

		await authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(401);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "No token provided", code: "UNAUTHORIZED" },
		});
	});

	it("should return 401 when token is blacklisted", async () => {
		mockReq.headers = { authorization: "Bearer blacklisted-token" };
		mockIsTokenBlacklisted.mockResolvedValue(true);

		await authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockIsTokenBlacklisted).toHaveBeenCalledWith("blacklisted-token");
		expect(mockRes.status).toHaveBeenCalledWith(401);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "Token has been revoked", code: "UNAUTHORIZED" },
		});
	});

	it("should return 401 when token is invalid", async () => {
		mockReq.headers = { authorization: "Bearer invalid-token" };
		mockIsTokenBlacklisted.mockResolvedValue(false);
		mockVerifyToken.mockImplementation(() => {
			throw new Error("Invalid token");
		});

		await authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockVerifyToken).toHaveBeenCalledWith("invalid-token");
		expect(mockRes.status).toHaveBeenCalledWith(401);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "Invalid or expired token", code: "UNAUTHORIZED" },
		});
	});

	it("should return 401 when user not found", async () => {
		mockReq.headers = { authorization: "Bearer valid-token" };
		mockIsTokenBlacklisted.mockResolvedValue(false);
		mockVerifyToken.mockReturnValue({ userId: "user-123" });
		mockUserFindUnique.mockResolvedValue(null);

		await authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockUserFindUnique).toHaveBeenCalledWith({
			where: { id: "user-123" },
			select: { id: true, email: true, name: true, role: true },
		});
		expect(mockRes.status).toHaveBeenCalledWith(401);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "User not found", code: "UNAUTHORIZED" },
		});
	});

	it("should authenticate and set user when token is valid", async () => {
		const mockUser = {
			id: "user-123",
			email: "test@example.com",
			name: "Test User",
			role: "user",
		};
		mockReq.headers = { authorization: "Bearer valid-token" };
		mockIsTokenBlacklisted.mockResolvedValue(false);
		mockVerifyToken.mockReturnValue({ userId: "user-123" });
		mockUserFindUnique.mockResolvedValue(mockUser);

		await authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockReq.userId).toBe("user-123");
		expect(mockReq.user).toEqual(mockUser);
		expect(mockNext).toHaveBeenCalledWith();
	});

	it("should handle errors gracefully", async () => {
		mockReq.headers = { authorization: "Bearer token" };
		mockIsTokenBlacklisted.mockRejectedValue(new Error("Database error"));

		await authenticate(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(500);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "Authentication failed", code: "INTERNAL_ERROR" },
		});
	});
});

describe("optionalAuth middleware", () => {
	let mockReq: Partial<AuthRequest>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();
		mockReq = { headers: {}, ip: "127.0.0.1" };
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		};
		mockNext = vi.fn();
	});

	it("should call next without auth when no authorization header", async () => {
		await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledWith();
		expect(mockReq.userId).toBeUndefined();
	});

	it("should skip auth when token is blacklisted", async () => {
		mockReq.headers = { authorization: "Bearer blacklisted-token" };
		mockIsTokenBlacklisted.mockResolvedValue(true);

		await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledWith();
		expect(mockReq.userId).toBeUndefined();
	});

	it("should set user when token is valid", async () => {
		const mockUser = {
			id: "user-123",
			email: "test@example.com",
			name: "Test User",
			role: "user",
		};
		mockReq.headers = { authorization: "Bearer valid-token" };
		mockIsTokenBlacklisted.mockResolvedValue(false);
		mockVerifyToken.mockReturnValue({ userId: "user-123" });
		mockUserFindUnique.mockResolvedValue(mockUser);

		await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockReq.userId).toBe("user-123");
		expect(mockReq.user).toEqual(mockUser);
		expect(mockNext).toHaveBeenCalledWith();
	});

	it("should continue without auth when token is invalid", async () => {
		mockReq.headers = { authorization: "Bearer invalid-token" };
		mockIsTokenBlacklisted.mockResolvedValue(false);
		mockVerifyToken.mockImplementation(() => {
			throw new Error("Invalid token");
		});

		await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledWith();
		expect(mockReq.userId).toBeUndefined();
	});

	it("should continue without auth when user not found", async () => {
		mockReq.headers = { authorization: "Bearer valid-token" };
		mockIsTokenBlacklisted.mockResolvedValue(false);
		mockVerifyToken.mockReturnValue({ userId: "user-123" });
		mockUserFindUnique.mockResolvedValue(null);

		await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledWith();
		expect(mockReq.userId).toBe("user-123");
		expect(mockReq.user).toBeUndefined();
	});

	it("should handle errors and continue to next", async () => {
		mockReq.headers = { authorization: "Bearer token" };
		mockIsTokenBlacklisted.mockRejectedValue(new Error("Error"));

		await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledWith();
	});
});

describe("authorize middleware", () => {
	let mockReq: Partial<AuthRequest>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();
		mockReq = {
			userId: "user-123",
			user: {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
				role: "user",
			},
		};
		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		};
		mockNext = vi.fn();
	});

	it("should return 401 when no userId", async () => {
		delete mockReq.userId;
		const adminAuth = authorize("admin");
		await adminAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(401);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "Authentication required", code: "UNAUTHORIZED" },
		});
	});

	it("should return 401 when no user object", async () => {
		delete mockReq.user;
		const adminAuth = authorize("admin");
		await adminAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(401);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: { message: "User information not found", code: "UNAUTHORIZED" },
		});
	});

	it("should return 403 when user role not in allowed roles", async () => {
		mockReq.user = { ...mockReq.user!, role: "user" };
		const adminAuth = authorize("admin");
		await adminAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(403);
		expect(mockRes.json).toHaveBeenCalledWith({
			success: false,
			error: {
				message: "Insufficient permissions",
				code: "FORBIDDEN",
			},
		});
	});

	it("should allow access when user role is in allowed roles", async () => {
		mockReq.user = { ...mockReq.user!, role: "admin" };
		const adminAuth = authorize("admin");
		await adminAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledWith();
	});

	it("should allow access for any of multiple roles", async () => {
		mockReq.user = { ...mockReq.user!, role: "moderator" };
		const multiAuth = authorize("admin", "moderator", "user");
		await multiAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledWith();
	});
});
