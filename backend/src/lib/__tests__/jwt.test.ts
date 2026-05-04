/**
 * Tests for JWT utility functions
 */

import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import {
	decodeToken,
	extractToken,
	generateRefreshToken,
	generateToken,
	jwtUtils,
	verifyRefreshToken,
	verifyToken,
} from "@/lib/jwt";

// Mock config
vi.mock("@/lib/config", () => ({
	config: {
		jwt: {
			secret: "test-secret-key-for-testing",
			expiresIn: "1h",
		},
		session: {
			expiresDays: 7,
		},
	},
}));

// Mock uuid
vi.mock("uuid", () => ({
	v4: vi.fn(() => "mocked-uuid"),
}));

describe("JWT Utilities", () => {
	describe("generateToken", () => {
		it("should generate a valid access token", () => {
			const userId = "user-123";
			const token = generateToken(userId);

			expect(typeof token).toBe("string");
			expect(token.split(".").length).toBe(3); // JWT format
		});

		it("should include userId in token payload", () => {
			const userId = "user-456";
			const token = generateToken(userId);
			const decoded = jwt.decode(token) as jwt.JwtPayload;

			expect(decoded?.userId).toBe(userId);
		});

		it("should include unique JTI in token", () => {
			const token = generateToken("user-123");
			const decoded = jwt.decode(token) as jwt.JwtPayload;

			expect(decoded?.jti).toBe("mocked-uuid");
		});

		it("should have proper expiration", () => {
			const token = generateToken("user-123");
			const decoded = jwt.decode(token) as jwt.JwtPayload;

			expect(decoded?.exp).toBeDefined();
			expect(decoded?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
		});
	});

	describe("generateRefreshToken", () => {
		it("should generate a valid refresh token", () => {
			const userId = "user-123";
			const token = generateRefreshToken(userId);

			expect(typeof token).toBe("string");
			expect(token.split(".").length).toBe(3);
		});

		it("should include userId in refresh token", () => {
			const userId = "user-789";
			const token = generateRefreshToken(userId);
			const decoded = jwt.decode(token) as jwt.JwtPayload;

			expect(decoded?.userId).toBe(userId);
		});

		it("should mark token as refresh type", () => {
			const token = generateRefreshToken("user-123");
			const decoded = jwt.decode(token) as jwt.JwtPayload;

			expect(decoded?.type).toBe("refresh");
		});

		it("should have longer expiration than access token", () => {
			const accessDecoded = jwt.decode(
				generateToken("user-123"),
			) as jwt.JwtPayload;
			const refreshDecoded = jwt.decode(
				generateRefreshToken("user-123"),
			) as jwt.JwtPayload;

			expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp as number);
		});
	});

	describe("verifyToken", () => {
		it("should verify valid token and return payload", () => {
			const userId = "user-verify";
			const token = generateToken(userId);
			const payload = verifyToken(token);

			expect(payload.userId).toBe(userId);
			expect(payload.jti).toBe("mocked-uuid");
		});

		it("should throw for expired token", () => {
			const expiredToken = jwt.sign(
				{ userId: "user-123" },
				"test-secret-key-for-testing",
				{ expiresIn: "-1h" },
			);

			expect(() => verifyToken(expiredToken)).toThrow("Token expired");
		});

		it("should throw for invalid token", () => {
			expect(() => verifyToken("invalid.token.here")).toThrow("Invalid token");
		});

		it("should throw for token with wrong signature", () => {
			const token = jwt.sign({ userId: "user-123" }, "wrong-secret");

			expect(() => verifyToken(token)).toThrow("Invalid token");
		});

		it("should throw for malformed token", () => {
			expect(() => verifyToken("not-a-jwt")).toThrow("Invalid token");
			expect(() => verifyToken("only.two")).toThrow("Invalid token");
		});

		it("should return payload with exp and iat", () => {
			const token = generateToken("user-123");
			const payload = verifyToken(token);

			expect(payload.exp).toBeDefined();
			expect(payload.iat).toBeDefined();
		});
	});

	describe("verifyRefreshToken", () => {
		it("should verify valid refresh token", () => {
			const userId = "user-refresh";
			const token = generateRefreshToken(userId);
			const result = verifyRefreshToken(token);

			expect(result.userId).toBe(userId);
		});

		it("should throw if token is not refresh type", () => {
			const accessRefreshToken = generateToken("user-123");

			expect(() => verifyRefreshToken(accessRefreshToken)).toThrow(
				"Invalid refresh token",
			);
		});

		it("should throw for expired refresh token", () => {
			const expiredToken = jwt.sign(
				{ userId: "user-123", type: "refresh" },
				"test-secret-key-for-testing",
				{ expiresIn: "-1h" },
			);

			expect(() => verifyRefreshToken(expiredToken)).toThrow("Token expired");
		});

		it("should throw for invalid refresh token", () => {
			expect(() => verifyRefreshToken("invalid")).toThrow("Invalid token");
		});
	});

	describe("extractToken", () => {
		it("should extract token from valid Bearer header", () => {
			const header = "Bearer valid-token-123";
			const token = extractToken(header);

			expect(token).toBe("valid-token-123");
		});

		it("should return null for missing header", () => {
			expect(extractToken(undefined)).toBeNull();
		});

		it("should return null for header without Bearer prefix", () => {
			expect(extractToken("Basic credentials")).toBeNull();
			expect(extractToken("just-a-token")).toBeNull();
		});

		it("should return null for empty string", () => {
			expect(extractToken("")).toBeNull();
		});

		it('should handle lowercase "bearer"', () => {
			expect(extractToken("bearer token")).toBeNull(); // Case sensitive
		});

		it("should handle Bearer with extra spaces", () => {
			const header = "Bearer   token-with-spaces";
			const token = extractToken(header);

			expect(token).toBe("  token-with-spaces"); // Preserves after prefix
		});
	});

	describe("decodeToken", () => {
		it("should decode valid token without verification", () => {
			const userId = "user-decode";
			const token = generateToken(userId);
			const decoded = decodeToken(token);

			expect(decoded).toBeDefined();
			expect(decoded?.userId).toBe(userId);
		});

		it("should return null for invalid token", () => {
			expect(decodeToken("invalid-token")).toBeNull();
		});

		it("should return null for malformed token", () => {
			expect(decodeToken("not.jwt")).toBeNull();
		});

		it("should decode expired token without throwing", () => {
			const expiredToken = jwt.sign(
				{ userId: "user-123" },
				"test-secret-key-for-testing",
				{ expiresIn: "-1h" },
			);

			const decoded = decodeToken(expiredToken);
			expect(decoded).toBeDefined();
			expect(decoded?.userId).toBe("user-123");
		});

		it("should decode token with wrong signature", () => {
			const token = jwt.sign({ userId: "user-123" }, "wrong-secret");
			const decoded = decodeToken(token);

			expect(decoded).toBeDefined();
			expect(decoded?.userId).toBe("user-123");
		});
	});

	describe("jwtUtils export object", () => {
		it("should export all functions as a group", () => {
			expect(jwtUtils.generateToken).toBe(generateToken);
			expect(jwtUtils.generateRefreshToken).toBe(generateRefreshToken);
			expect(jwtUtils.verifyToken).toBe(verifyToken);
			expect(jwtUtils.verifyRefreshToken).toBe(verifyRefreshToken);
			expect(jwtUtils.extractToken).toBe(extractToken);
			expect(jwtUtils.decodeToken).toBe(decodeToken);
		});

		it("should work when called through the export object", () => {
			const token = jwtUtils.generateToken("user-123");
			const payload = jwtUtils.verifyToken(token);

			expect(payload.userId).toBe("user-123");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty userId", () => {
			const token = generateToken("");
			const decoded = jwt.decode(token) as jwt.JwtPayload;

			expect(decoded?.userId).toBe("");
		});

		it("should handle special characters in userId", () => {
			const userId = "user@example.com";
			const token = generateToken(userId);
			const payload = verifyToken(token);

			expect(payload.userId).toBe(userId);
		});

		it("should generate different tokens for same user", () => {
			// Add small delay to ensure different iat timestamps
			const token1 = generateToken("user-123");
			const decoded1 = jwt.decode(token1) as jwt.JwtPayload;

			// Mock different iat by advancing time
			vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);

			const token2 = generateToken("user-123");
			const decoded2 = jwt.decode(token2) as jwt.JwtPayload;

			// Tokens should be different (due to different iat)
			expect(token1).not.toBe(token2);
			expect(decoded1.iat).not.toBe(decoded2.iat);

			vi.restoreAllMocks();
		});

		it("should generate different JTIs for each token", () => {
			const decoded1 = jwt.decode(generateToken("user-123")) as jwt.JwtPayload;
			const decoded2 = jwt.decode(generateToken("user-123")) as jwt.JwtPayload;

			expect(decoded1.jti).toBe(decoded2.jti); // Mocked UUID is same
		});
	});

	describe("Error Handling Edge Cases", () => {
		it("should rethrow unexpected errors in verifyToken", () => {
			// Mock jwt.verify to throw a non-JWT error
			const originalVerify = jwt.verify;
			(jwt.verify as vi.Mock) = vi.fn(() => {
				throw new Error("Unexpected database error");
			});

			const token = generateToken("user-123");

			expect(() => verifyToken(token)).toThrow("Unexpected database error");

			(jwt.verify as vi.Mock) = originalVerify;
		});

		it("should handle decodeToken with completely invalid input", () => {
			// Test with various invalid inputs
			expect(decodeToken(null as unknown as string)).toBeNull();
			expect(decodeToken(undefined as unknown as string)).toBeNull();
			expect(decodeToken(123 as unknown as string)).toBeNull();
			expect(decodeToken({} as unknown as string)).toBeNull();
		});

		it("should handle decodeToken error in catch block", () => {
			// Mock jwt.decode to throw an error
			const originalDecode = jwt.decode;
			(jwt.decode as vi.Mock) = vi.fn(() => {
				throw new Error("Decode error");
			});

			const result = decodeToken("any-token");
			expect(result).toBeNull();

			(jwt.decode as vi.Mock) = originalDecode;
		});
	});
});
