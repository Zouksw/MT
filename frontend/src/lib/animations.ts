/**
 * Motion preference helper.
 *
 * The full animation-constant library that used to live here (DURATION, EASING,
 * ANIMATIONS, TRANSITIONS, KEYFRAMES, createAnimation, …) had zero importers
 * across the app — components define their own transitions inline or via
 * tokens.css. Only the reduced-motion guard is actually consumed
 * (PageTransition.tsx), so that's all this module keeps.
 */

// Respect the user's OS-level reduced-motion preference.
export const shouldReduceMotion = (): boolean => {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
