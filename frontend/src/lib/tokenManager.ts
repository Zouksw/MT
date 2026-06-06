/**
 * Secure Token Manager — memory-only storage.
 * HttpOnly cookie (set by backend) is the primary auth mechanism;
 * this provides immediate access for SPA navigation.
 */

interface TokenStorage {
	getToken(): string | null;
	setToken(token: string, rememberMe?: boolean): void;
	removeToken(): void;
	isTokenValid(token: string): boolean;
}

class SecureTokenManager implements TokenStorage {
	private memoryToken: string | null = null;

	getToken(): string | null {
		return this.memoryToken;
	}

	setToken(token: string, _rememberMe: boolean = false): void {
		this.memoryToken = token;
	}

	removeToken(): void {
		this.memoryToken = null;
	}

	isTokenValid(token: string): boolean {
		try {
			const payload = this.parseJwt(token);
			return (payload.exp ?? 0) > Date.now() / 1000;
		} catch {
			return false;
		}
	}

	getTokenExpiration(token: string): number | null {
		try {
			const payload = this.parseJwt(token);
			return (payload.exp ?? 0) * 1000;
		} catch {
			return null;
		}
	}

	isTokenExpiringSoon(): boolean {
		const token = this.getToken();
		if (!token) return false;
		const expiration = this.getTokenExpiration(token);
		if (!expiration) return false;
		return expiration - Date.now() < 5 * 60 * 1000;
	}

	private parseJwt(token: string): {
		exp?: number;
		sub?: string;
		userId?: string;
		id?: string;
		role?: string;
	} {
		const parts = token.split(".");
		if (parts.length !== 3) {
			throw new Error("Invalid token format");
		}
		const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		return JSON.parse(atob(base64));
	}

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

export const tokenManager = new SecureTokenManager();
export type { TokenStorage };
