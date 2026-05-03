/**
 * Authentication utility functions
 * Provides helper functions for managing authentication tokens and user data
 * Now uses the centralized tokenManager for secure token management
 */

import { tokenManager } from "@/lib/tokenManager";

/**
 * Cached user data
 */
interface CachedUser {
	id: string;
	email: string;
	name: string | null;
	avatar?: string;
	roles?: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Get the authentication token
 * @returns The JWT token or null
 */
export const getAuthToken = (): string | null => {
	return tokenManager.getToken();
};

/**
 * Set the authentication token
 * @param token - The JWT token to store
 * @param rememberMe - Whether to persist the session
 */
export const setAuthToken = (token: string, rememberMe?: boolean): void => {
	tokenManager.setToken(token, rememberMe);
};

/**
 * Remove the authentication token
 */
export const removeAuthToken = (): void => {
	tokenManager.removeToken();
};

/**
 * Clear all authentication tokens
 */
export const clearAuthTokens = (): void => {
	tokenManager.removeToken();
	// Note: HttpOnly cookie is cleared by backend logout endpoint
};

/**
 * Get the Authorization header value for API requests
 * @returns The Authorization header value or undefined
 */
export const getAuthHeader = (): { Authorization: string } | undefined => {
	const token = tokenManager.getToken();
	if (token) {
		return { Authorization: `Bearer ${token}` };
	}
	return undefined;
};

/**
 * Fetch with authentication headers and CSRF protection
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns The fetch response
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
	const token = tokenManager.getToken();

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		...options.headers,
	};

	// Add auth header if token exists
	if (token) {
		(headers as Record<string, string>).Authorization = `Bearer ${token}`;
	}

	return fetch(`${API_BASE}${url}`, {
		...options,
		credentials: "include", // Include cookies
		headers,
	});
};

/**
 * Check if user is authenticated (DEPRECATED - may return false after page refresh)
 * @deprecated Use verifyAuthentication() instead - this only checks memory token
 * @returns True if user has a valid token in memory (may be false even if logged in)
 */
export const isAuthenticated = (): boolean => {
	const token = tokenManager.getToken();
	const valid = token !== null && tokenManager.isTokenValid(token);

	// Warn in development that this function is deprecated
	if (process.env.NODE_ENV === "development" && !valid) {
		// eslint-disable-next-line no-console
		console.warn(
			"[DEPRECATED] isAuthenticated() only checks memory. Use verifyAuthentication() instead.",
		);
	}

	return valid;
};

/**
 * Verify authentication status with server
 * This checks the HttpOnly cookie which persists across page refreshes
 * @returns Promise<boolean> - true if user is authenticated via server session
 */
export async function verifyAuthentication(): Promise<boolean> {
	try {
		const response = await authFetch("/api/auth/verify", {
			method: "GET",
		});
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Get the current user info from localStorage cache
 * @returns The cached user object or null
 */
export const getCachedUser = (): CachedUser | null => {
	if (typeof window !== "undefined") {
		const userStr = localStorage.getItem("user");
		if (userStr) {
			try {
				return JSON.parse(userStr);
			} catch {
				return null;
			}
		}
	}
	return null;
};

/**
 * Cache the current user info in localStorage
 * @param user - The user object to cache
 */
export const setCachedUser = (user: CachedUser): void => {
	if (typeof window !== "undefined") {
		// Only store non-sensitive data
		const safeUser = {
			id: user.id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			roles: user.roles || [],
		};
		localStorage.setItem("user", JSON.stringify(safeUser));
	}
};

/**
 * Clear the cached user info
 */
export const clearCachedUser = (): void => {
	if (typeof window !== "undefined") {
		localStorage.removeItem("user");
	}
};

/**
 * Check if the current token is expiring soon (within 5 minutes)
 * @returns True if token will expire within 5 minutes
 */
export const isTokenExpiringSoon = (): boolean => {
	return tokenManager.isTokenExpiringSoon();
};

/**
 * Get user ID from current token
 * @returns User ID or null
 */
export const getUserId = (): string | null => {
	return tokenManager.getUserId();
};

/**
 * Get user role from current token
 * @returns User role or null
 */
export const getUserRole = (): string | null => {
	return tokenManager.getUserRole();
};
