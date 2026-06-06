import { tokenManager } from "@/lib/tokenManager";

interface CachedUser {
	id: string;
	email: string;
	name: string | null;
	avatar?: string;
	roles?: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getAuthToken = (): string | null => {
	return tokenManager.getToken();
};

export const setAuthToken = (token: string, rememberMe?: boolean): void => {
	tokenManager.setToken(token, rememberMe);
};

export const removeAuthToken = (): void => {
	tokenManager.removeToken();
};

export const clearAuthTokens = (): void => {
	tokenManager.removeToken();
};

export const getAuthHeader = (): { Authorization: string } | undefined => {
	const token = tokenManager.getToken();
	if (token) {
		return { Authorization: `Bearer ${token}` };
	}
	return undefined;
};

export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
	const token = tokenManager.getToken();

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		...options.headers,
	};

	if (token) {
		(headers as Record<string, string>).Authorization = `Bearer ${token}`;
	}

	return fetch(`${API_BASE}${url}`, {
		...options,
		credentials: "include",
		headers,
	});
};

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

export const setCachedUser = (user: CachedUser): void => {
	if (typeof window !== "undefined") {
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

export const clearCachedUser = (): void => {
	if (typeof window !== "undefined") {
		localStorage.removeItem("user");
	}
};

export const isTokenExpiringSoon = (): boolean => {
	return tokenManager.isTokenExpiringSoon();
};

export const getUserId = (): string | null => {
	return tokenManager.getUserId();
};

export const getUserRole = (): string | null => {
	return tokenManager.getUserRole();
};
