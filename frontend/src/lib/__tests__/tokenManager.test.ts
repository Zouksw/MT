/**
 * Token Manager Unit Tests
 *
 * Tests for secure token storage and validation functionality
 */

import { tokenManager } from "../tokenManager";

// Mock console methods to reduce test noise
global.console = {
	...console,
	log: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

describe("tokenManager", () => {
	beforeEach(() => {
		// Clear tokens before each test
		tokenManager.removeToken();
		// Clear localStorage
		if (typeof window !== "undefined") {
			localStorage.clear();
			sessionStorage.clear();
		}
	});

	describe("setToken and getToken", () => {
		it("should store and retrieve token from memory", () => {
			const testToken = "test-jwt-token";
			tokenManager.setToken(testToken);

			expect(tokenManager.getToken()).toBe(testToken);
		});

		it("should handle remember me flag correctly", () => {
			const testToken = "test-jwt-token";
			tokenManager.setToken(testToken, true);

			expect(tokenManager.getToken()).toBe(testToken);
		});

		it("should return null when no token is set", () => {
			expect(tokenManager.getToken()).toBeNull();
		});

		it("should replace existing token", () => {
			const firstToken = "first-token";
			const secondToken = "second-token";

			tokenManager.setToken(firstToken);
			expect(tokenManager.getToken()).toBe(firstToken);

			tokenManager.setToken(secondToken);
			expect(tokenManager.getToken()).toBe(secondToken);
		});
	});

	describe("removeToken", () => {
		it("should remove token from memory", () => {
			tokenManager.setToken("test-token");
			expect(tokenManager.getToken()).toBe("test-token");

			tokenManager.removeToken();
			expect(tokenManager.getToken()).toBeNull();
		});

		it("should handle removing when no token exists", () => {
			expect(() => tokenManager.removeToken()).not.toThrow();
			expect(tokenManager.getToken()).toBeNull();
		});
	});

	describe("isTokenValid", () => {
		it("should validate a valid JWT token", () => {
			// Create a mock JWT token (header.payload.signature)
			const now = Math.floor(Date.now() / 1000);
			const exp = now + 3600; // Expires in 1 hour
			const payload = btoa(JSON.stringify({ userId: "123", exp }));
			const validToken = `mockHeader.${payload}.mockSignature`;

			expect(tokenManager.isTokenValid(validToken)).toBe(true);
		});

		it("should reject an expired JWT token", () => {
			// Create an expired token
			const now = Math.floor(Date.now() / 1000);
			const exp = now - 3600; // Expired 1 hour ago
			const payload = btoa(JSON.stringify({ userId: "123", exp }));
			const expiredToken = `mockHeader.${payload}.mockSignature`;

			expect(tokenManager.isTokenValid(expiredToken)).toBe(false);
		});

		it("should reject a malformed JWT token", () => {
			expect(tokenManager.isTokenValid("invalid-token")).toBe(false);
			expect(tokenManager.isTokenValid("only.two")).toBe(false);
			expect(tokenManager.isTokenValid("")).toBe(false);
		});

		it("should reject token with invalid JSON in payload", () => {
			const invalidToken = "mockHeader.not-valid-json.mockSignature";
			expect(tokenManager.isTokenValid(invalidToken)).toBe(false);
		});

		it("should reject token without exp claim", () => {
			const payload = btoa(JSON.stringify({ userId: "123" }));
			const noExpToken = `mockHeader.${payload}.mockSignature`;

			expect(tokenManager.isTokenValid(noExpToken)).toBe(false);
		});
	});

	describe("parseJwt", () => {
		it("should parse JWT payload correctly", () => {
			const payload = { userId: "user123", email: "test@example.com", exp: 1234567890 };
			const encodedPayload = btoa(JSON.stringify(payload));
			const token = `header.${encodedPayload}.signature`;

			// Access private method through testing
			const parsed = (tokenManager as any).parseJwt(token);

			expect(parsed).toEqual(payload);
		});

		it("should handle URL-safe base64 encoding", () => {
			// JWT uses URL-safe base64 (replace + with -, / with _)
			const payload = { userId: "user+1/2", exp: 1234567890 };
			const encodedPayload = btoa(JSON.stringify(payload))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");
			const token = `header.${encodedPayload}.signature`;

			const parsed = (tokenManager as any).parseJwt(token);

			expect(parsed.userId).toBe("user+1/2");
		});
	});

	describe("edge cases", () => {
		it("should handle null and undefined gracefully", () => {
			expect(tokenManager.getToken()).toBeNull();
			expect(tokenManager.isTokenValid("")).toBe(false);
			expect(tokenManager.isTokenValid(null as any)).toBe(false);
			expect(tokenManager.isTokenValid(undefined as any)).toBe(false);
		});

		it("should handle very long tokens", () => {
			const longToken = "a".repeat(10000);
			tokenManager.setToken(longToken);
			expect(tokenManager.getToken()).toBe(longToken);
		});

		it("should handle special characters in tokens", () => {
			const specialToken = "token.with-dashes_and_underscores";
			tokenManager.setToken(specialToken);
			expect(tokenManager.getToken()).toBe(specialToken);
		});
	});
});
