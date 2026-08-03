/**
 * Responsive Hooks and Utilities
 *
 * Custom hooks for responsive design patterns.
 *
 * Note (round-68): useBreakpoint/useResponsiveValue/useIsTablet/useIsDesktop/
 * useWindowSize were removed — each had 0 callers across the app (only
 * useIsMobile, at 26 callers, was live). useMediaQuery is retained because
 * useIsMobile builds on it.
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";

type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const breakpointValues: Record<Breakpoint, number> = {
	xs: 320,
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	"2xl": 1536,
};

/**
 * useMediaQuery Hook
 *
 * Returns whether the current viewport matches the given media query
 *
 * @example
 * const isMobile = useMediaQuery({ maxWidth: 768 });
 * const isDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
 */
export function useMediaQuery(query: {
	minWidth?: number;
	maxWidth?: number;
	query?: string;
}): boolean {
	// Build media query string
	let mediaQuery: string = query.query ?? "";
	if (!mediaQuery) {
		const parts: string[] = [];
		if (query.minWidth) parts.push(`(min-width: ${query.minWidth}px)`);
		if (query.maxWidth) parts.push(`(max-width: ${query.maxWidth}px)`);
		mediaQuery = parts.join(" and ");
	}

	const subscribe = useCallback(
		(callback: () => void) => {
			const mediaQueryList = window.matchMedia(mediaQuery);
			mediaQueryList.addEventListener("change", callback);
			return () => mediaQueryList.removeEventListener("change", callback);
		},
		[mediaQuery],
	);

	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(mediaQuery).matches,
		() => false,
	);
}

/**
 * Convenience hook for the mobile breakpoint (the only breakpoint the app
 * currently branches on — 26 call sites).
 */
export function useIsMobile(): boolean {
	return useMediaQuery({ maxWidth: breakpointValues.md - 1 });
}
