/**
 * Animation Utility Library
 *
 * Centralized animation constants and utilities for consistent motion design
 * across the MT application.
 *
 * Design Principles:
 * - Micro: 50-100ms - Tooltips, tiny state changes
 * - Short: 150-250ms - Button hover, dropdowns
 * - Medium: 250-400ms - Modals, page transitions
 * - Long: 400-700ms - Complex animations
 *
 * Easing Functions:
 * - Enter: ease-out (cubic-bezier(0, 0, 0.2, 1))
 * - Exit: ease-in (cubic-bezier(0.4, 0, 1, 1))
 * - Move: ease-in-out (cubic-bezier(0.4, 0, 0.2, 1))
 */

// Animation durations (in ms)
export const DURATION = {
	MICRO: 100, // 50-100ms - Tooltips, tiny state changes
	SHORT: 200, // 150-250ms - Button hover, dropdowns
	MEDIUM: 300, // 250-400ms - Modals, page transitions
	LONG: 500, // 400-700ms - Complex animations
} as const;

// Easing functions (CSS cubic-bezier)
export const EASING = {
	ENTER: "cubic-bezier(0, 0, 0.2, 1)", // ease-out
	EXIT: "cubic-bezier(0.4, 0, 1, 1)", // ease-in
	MOVE: "cubic-bezier(0.4, 0, 0.2, 1)", // ease-in-out
	SPRING: "cubic-bezier(0.34, 1.56, 0.64, 1)", // spring-like overshoot
	SMOOTH: "cubic-bezier(0.16, 1, 0.3, 1)", // premium deceleration
} as const;

// Animation combinations (duration + easing)
export const ANIMATIONS = {
	FADE_IN: `${DURATION.SHORT}ms ${EASING.ENTER}`,
	SLIDE_UP: `${DURATION.MEDIUM}ms ${EASING.ENTER}`,
	SLIDE_DOWN: `${DURATION.MEDIUM}ms ${EASING.ENTER}`,
	SLIDE_LEFT: `${DURATION.MEDIUM}ms ${EASING.ENTER}`,
	SLIDE_RIGHT: `${DURATION.MEDIUM}ms ${EASING.ENTER}`,
	MODAL_IN: `${DURATION.MEDIUM}ms ${EASING.ENTER}`,
	MODAL_OUT: `${DURATION.SHORT}ms ${EASING.EXIT}`,
	BUTTON_HOVER: `${DURATION.SHORT}ms ${EASING.MOVE}`,
	CARD_HOVER: `${DURATION.SHORT}ms ${EASING.MOVE}`,
	TOOLTIP: `${DURATION.MICRO}ms ${EASING.ENTER}`,
	DROPDOWN: `${DURATION.SHORT}ms ${EASING.ENTER}`,
} as const;

// Stagger delays for list animations
export const createStaggerDelay = (index: number, baseDelay = 50): string => {
	return `${index * baseDelay}ms`;
};

// CSS custom properties for animations
export const ANIMATION_CSS_VARS = {
	"--duration-micro": `${DURATION.MICRO}ms`,
	"--duration-short": `${DURATION.SHORT}ms`,
	"--duration-medium": `${DURATION.MEDIUM}ms`,
	"--duration-long": `${DURATION.LONG}ms`,
	"--easing-enter": EASING.ENTER,
	"--easing-exit": EASING.EXIT,
	"--easing-move": EASING.MOVE,
} as const;

// Transition utilities for common components
export const TRANSITIONS = {
	// Button transitions
	button: `all ${DURATION.SHORT}ms ${EASING.MOVE}`,

	// Card transitions
	card: `all ${DURATION.SHORT}ms ${EASING.MOVE}`,

	// Modal transitions
	modal: `all ${DURATION.MEDIUM}ms ${EASING.ENTER}`,

	// Page transitions
	page: `all ${DURATION.MEDIUM}ms ${EASING.ENTER}`,

	// Input transitions
	input: `all ${DURATION.SHORT}ms ${EASING.MOVE}`,

	// Tooltip transitions
	tooltip: `all ${DURATION.MICRO}ms ${EASING.ENTER}`,
} as const;

// Animation keyframe names (should match @keyframes in globals.css)
export const KEYFRAMES = {
	FADE_IN: "fadeIn",
	FADE_OUT: "fadeOut",
	SLIDE_UP: "slideUp",
	SLIDE_DOWN: "slideDown",
	SLIDE_LEFT: "slideLeft",
	SLIDE_RIGHT: "slideRight",
	SCALE_IN: "scaleIn",
	SCALE_OUT: "scaleOut",
	MODAL_IN: "modalSlideIn",
	MODAL_OUT: "modalSlideOut",
} as const;

// Helper function to create animation string
export const createAnimation = (
	keyframe: keyof typeof KEYFRAMES,
	duration: keyof typeof DURATION = "SHORT",
	easing: keyof typeof EASING = "ENTER",
): string => {
	return `${KEYFRAMES[keyframe]} ${DURATION[duration]}ms ${EASING[easing]}`;
};

// Helper function to create transition string
export const createTransition = (
	properties: string | string[],
	duration: keyof typeof DURATION = "SHORT",
	easing: keyof typeof EASING = "MOVE",
): string => {
	const props = Array.isArray(properties) ? properties.join(", ") : properties;
	return `${props} ${DURATION[duration]}ms ${EASING[easing]}`;
};

// Animation state utilities
export const getAnimationState = (
	isAnimating: boolean,
	animation: string,
): { animation?: string; animationIterationCount?: number } => {
	return isAnimating ? { animation, animationIterationCount: 1 } : {};
};

// Respect user's motion preferences
export const shouldReduceMotion = (): boolean => {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Get animation with reduced motion support
export const getSafeAnimation = (animation: string, fallback = "none"): string => {
	return shouldReduceMotion() ? fallback : animation;
};

export type AnimationDuration = keyof typeof DURATION;
export type AnimationEasing = keyof typeof EASING;
export type AnimationKeyframe = keyof typeof KEYFRAMES;
export type AnimationPreset = keyof typeof ANIMATIONS;
export type TransitionPreset = keyof typeof TRANSITIONS;
