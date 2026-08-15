"use client";

/**
 * AuthContext — the single session state machine for the SPA (round-104).
 *
 * Before this provider the frontend had four disconnected login states: the
 * in-memory token (tokenManager, lost on every refresh), a js-cookie `auth`
 * flag (read only by the login/register server redirect), a localStorage
 * `user` cache (written only by the profile page), and the backend's HttpOnly
 * `auth_token` cookie (used by middleware). Nothing reconciled them, so a
 * page refresh left the dashboard rendering its signed-out prompt forever —
 * despite a perfectly valid cookie session (audit C8).
 *
 * This provider is authoritative:
 * - On mount it verifies the session through the cookie-capable backend
 *   endpoints (/auth/verify, then /auth/me) and publishes
 *   status: checking → authenticated | unauthenticated, plus the profile.
 * - logout() revokes the backend session and clears every local store
 *   (memory token, js-cookie `auth`, localStorage `user`) in one place —
 *   previously the app had NO logout anywhere.
 */

import Cookies from "js-cookie";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { authFetch, clearCachedUser, removeAuthToken, setCachedUser } from "@/utils/auth";

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export interface AuthUser {
	id: string;
	email: string;
	name: string | null;
	avatar?: string | null;
	role?: string;
}

interface AuthContextValue {
	status: AuthStatus;
	user: AuthUser | null;
	/** Re-run the cookie-session verification (e.g. after login on another tab). */
	refresh: () => Promise<void>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [status, setStatus] = useState<AuthStatus>("checking");
	const [user, setUser] = useState<AuthUser | null>(null);
	const mounted = useRef(true);

	const refresh = useCallback(async () => {
		try {
			// /verify accepts the HttpOnly cookie OR the Bearer header — this is
			// what makes refresh-survival possible.
			const verifyRes = await authFetch("/api/auth/verify", { method: "GET" });
			if (!verifyRes.ok) {
				if (mounted.current) {
					setStatus("unauthenticated");
					setUser(null);
				}
				return;
			}
			// Session is alive — load the profile (cookie-capable since round-104)
			// and mirror it into the localStorage cache the profile page reads.
			const meRes = await authFetch("/api/auth/me", { method: "GET" });
			if (!meRes.ok) throw new Error(`auth/me ${meRes.status}`);
			const body = await meRes.json();
			const profile: AuthUser | undefined = body?.data?.user ?? body?.user;
			if (!profile) throw new Error("auth/me returned no user");
			setCachedUser({
				id: profile.id,
				email: profile.email,
				name: profile.name ?? null,
				avatar: profile.avatar ?? undefined,
			});
			if (mounted.current) {
				setUser(profile);
				setStatus("authenticated");
			}
		} catch {
			if (mounted.current) {
				setStatus("unauthenticated");
				setUser(null);
			}
		}
	}, []);

	const logout = useCallback(async () => {
		// Revoke server-side first (best effort — local state clears regardless).
		try {
			await authFetch("/api/auth/logout", { method: "POST" });
		} catch {
			// network failure must not trap the user in a signed-in UI
		}
		removeAuthToken();
		clearCachedUser();
		Cookies.remove("auth", { path: "/" });
		if (mounted.current) {
			setUser(null);
			setStatus("unauthenticated");
		}
	}, []);

	useEffect(() => {
		mounted.current = true;
		void refresh();
		return () => {
			mounted.current = false;
		};
	}, [refresh]);

	const value = useMemo(() => ({ status, user, refresh, logout }), [status, user, refresh, logout]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
	return ctx;
}
