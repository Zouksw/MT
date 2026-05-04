/**
 * Responsive Hooks and Utilities
 *
 * Custom hooks for responsive design patterns
 */

"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

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
 * useBreakpoint Hook
 *
 * Returns the current breakpoint based on window width
 *
 * @example
 * const breakpoint = useBreakpoint();
 * if (breakpoint === 'xs') return <MobileView />;
 * if (breakpoint === 'lg') return <DesktopView />;
 */
export function useBreakpoint(): Breakpoint {
	const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
		if (typeof window === "undefined") return "lg";
		return getCurrentBreakpointFromWidth(window.innerWidth);
	});

	useEffect(() => {
		if (typeof window === "undefined") return;

		const handleResize = () => {
			setBreakpoint(getCurrentBreakpointFromWidth(window.innerWidth));
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return breakpoint;
}

function getCurrentBreakpointFromWidth(width: number): Breakpoint {
	if (width < breakpointValues.sm) return "xs";
	if (width < breakpointValues.md) return "sm";
	if (width < breakpointValues.lg) return "md";
	if (width < breakpointValues.xl) return "lg";
	if (width < breakpointValues["2xl"]) return "xl";
	return "2xl";
}

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
 * Convenience hooks for common breakpoints
 */

export function useIsMobile(): boolean {
	return useMediaQuery({ maxWidth: breakpointValues.md - 1 });
}

export function useIsTablet(): boolean {
	return useMediaQuery({
		minWidth: breakpointValues.md,
		maxWidth: breakpointValues.lg - 1,
	});
}

export function useIsDesktop(): boolean {
	return useMediaQuery({ minWidth: breakpointValues.lg });
}

/**
 * useResponsiveValue Hook
 *
 * Returns a value based on the current breakpoint
 *
 * @example
 * const columns = useResponsiveValue({ xs: 1, sm: 2, md: 3, lg: 4 });
 */
export function useResponsiveValue<T>(values: Partial<Record<Breakpoint, T>>): T | undefined {
	const breakpoint = useBreakpoint();

	// Find the largest breakpoint that's <= current
	const sortedBreakpoints = Object.keys(values).sort(
		(a, b) => breakpointValues[a as Breakpoint] - breakpointValues[b as Breakpoint],
	) as Breakpoint[];

	for (const bp of sortedBreakpoints) {
		if (breakpointValues[breakpoint] >= breakpointValues[bp]) {
			return values[bp];
		}
	}

	return undefined;
}

/**
 * useWindowSize Hook
 *
 * Returns current window dimensions
 */
export function useWindowSize(): { width: number; height: number } {
	const [size, setSize] = useState(() => {
		if (typeof window === "undefined") {
			return { width: 1024, height: 768 }; // Default for SSR
		}
		return {
			width: window.innerWidth,
			height: window.innerHeight,
		};
	});

	useEffect(() => {
		if (typeof window === "undefined") return;

		const handleResize = () => {
			setSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return size;
}
