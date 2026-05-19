/**
 * JWT utility functions
 * Centralized token generation and verification
 */

import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config";

export interface TokenPayload {
	userId: string;
	type?: "access" | "refresh";
	jti?: string;
	exp?: number;
	iat?: number;
}

/**
 * Generate an access token for the given user ID
 */
export function generateToken(userId: string): string {
	return jwt.sign({ userId, jti: uuidv4() }, config.jwt.secret, {
		expiresIn: config.jwt.expiresIn,
	} as jwt.SignOptions);
}

/**
 * Generate a refresh token for the given user ID
 */
export function generateRefreshToken(userId: string): string {
	return jwt.sign({ userId, type: "refresh", jti: uuidv4() }, config.jwt.secret, {
		expiresIn: `${config.session.expiresDays}d`,
	} as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 * @throws {Error} If token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload {
	try {
		return jwt.verify(token, config.jwt.secret) as TokenPayload;
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			throw new Error("Token expired");
		}
		if (error instanceof jwt.JsonWebTokenError) {
			throw new Error("Invalid token");
		}
		throw error;
	}
}

/**
 * Verify a refresh token specifically
 */
export function verifyRefreshToken(token: string): { userId: string } {
	const payload = verifyToken(token);
	if (payload.type !== "refresh") {
		throw new Error("Invalid refresh token");
	}
	return { userId: payload.userId };
}

/**
 * Extract token from Authorization header
 * @returns The token without "Bearer " prefix, or null if not found
 */
export function extractToken(authHeader: string | undefined): string | null {
	if (!authHeader?.startsWith("Bearer ")) {
		return null;
	}
	return authHeader.substring(7);
}

/**
 * Decode a token without verification (for blacklist extraction)
 * WARNING: Do not use for authentication decisions
 */
export function decodeToken(token: string): TokenPayload | null {
	try {
		return jwt.decode(token) as TokenPayload;
	} catch {
		// intentionally ignored — decode is for informational purposes only
		return null;
	}
}

// Export as a grouped utility object
export const jwtUtils = {
	generateToken,
	generateRefreshToken,
	verifyToken,
	verifyRefreshToken,
	extractToken,
	decodeToken,
};

export default jwtUtils;
