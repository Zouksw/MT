/**
 * Secure Token Manager
 *
 * Centralized token management with dual storage strategy:
 * 1. PRIMARY: HttpOnly cookies (set by backend, sent automatically with requests)
 * 2. FALLBACK: Session storage (for SPA navigation within same tab)
 *
 * SECURITY ARCHITECTURE:
 * - HttpOnly cookies prevent XSS attacks on token
 * - Session storage provides immediate access without blocking
 * - No localStorage usage (vulnerable to XSS)
 *
 * BEST PRACTICES:
 * - For authentication checks: use verifyAuthentication() from @/utils/auth
 * - Token is automatically sent via HttpOnly cookie
 * - This manager is mainly for immediate token access when needed
 */

interface TokenStorage {
	getToken(): string | null;
	setToken(token: string, rememberMe?: boolean): void;
	removeToken(): void;
	isTokenValid(token: string): boolean;
}

class SecureTokenManager implements TokenStorage {
	// Memory storage for immediate access
	private memoryToken: string | null = null;

	/**
	 * Get the current auth token from memory or session storage
	 * Returns null if not found (token may still exist in HttpOnly cookie)
	 *
	 * IMPORTANT: This returns token from memory/sessionStorage for immediate use.
	 * The HttpOnly cookie is sent automatically by the browser with each request.
	 * For authentication verification, always use verifyAuthentication() from @/utils/auth
	 */
	getToken(): string | null {
		// Check memory only — the HttpOnly cookie is sent automatically by the browser
		// Do NOT read from sessionStorage/localStorage (XSS risk)
		if (this.memoryToken) {
			return this.memoryToken;
		}

		return null;
	}

	/**
	 * Set the auth token in memory and session storage
	 * @param token - JWT token from backend
	 * @param rememberMe - Whether to persist session (handled by HttpOnly cookie)
	 *
	 * NOTE: The backend sets the HttpOnly cookie. This method stores in memory/session
	 * for immediate use during SPA navigation without additional API calls.
	 */
	setToken(token: string, _rememberMe: boolean = false): void {
		// Store in memory only — the backend sets the HttpOnly cookie
		this.memoryToken = token;
	}

	/**
	 * Remove the auth token from memory and session storage
	 * @note Call the backend logout endpoint to clear the HttpOnly cookie
	 */
	removeToken(): void {
		// Clear memory only — call backend logout to clear HttpOnly cookie
		this.memoryToken = null;
	}

	/**
	 * Validate JWT token expiration
	 * @param token - JWT token to validate
	 * @returns true if token is valid and not expired
	 */
	isTokenValid(token: string): boolean {
		try {
			const payload = this.parseJwt(token);
			const now = Date.now() / 1000;
			return (payload.exp ?? 0) > now;
		} catch {
			return false;
		}
	}

	/**
	 * Get token expiration time
	 * @returns expiration timestamp in milliseconds, or null if invalid
	 */
	getTokenExpiration(token: string): number | null {
		try {
			const payload = this.parseJwt(token);
			return (payload.exp ?? 0) * 1000; // Convert to milliseconds
		} catch {
			return null;
		}
	}

	/**
	 * Check if current token will expire soon (within 5 minutes)
	 */
	isTokenExpiringSoon(): boolean {
		const token = this.getToken();
		if (!token) return false;

		const expiration = this.getTokenExpiration(token);
		if (!expiration) return false;

		const fiveMinutes = 5 * 60 * 1000;
		return expiration - Date.now() < fiveMinutes;
	}

	/**
	 * Parse JWT payload without verification (for client-side metadata only)
	 * @private
	 */
	private parseJwt(token: string): { exp?: number; sub?: string; userId?: string; id?: string; role?: string } {
		const parts = token.split(".");
		if (parts.length !== 3) {
			throw new Error("Invalid token format");
		}

		const base64Url = parts[1];
		const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

		try {
			const payload = atob(base64);
			return JSON.parse(payload);
		} catch {
			throw new Error("Failed to parse token");
		}
	}

	/**
	 * Get user ID from current token
	 */
	getUserId(): string | null {
		const token = this.getToken();
		if (!token) return null;

		try {
			const payload = this.parseJwt(token);
			return payload.sub || payload.userId || payload.id || null;
		} catch {
			return null;
		}
	}

	/**
	 * Get user role from current token
	 */
	getUserRole(): string | null {
		const token = this.getToken();
		if (!token) return null;

		try {
			const payload = this.parseJwt(token);
			return payload.role || null;
		} catch {
			return null;
		}
	}
}

// Export singleton instance
export const tokenManager = new SecureTokenManager();

// Export type for dependency injection (useful for testing)
export type { TokenStorage };
