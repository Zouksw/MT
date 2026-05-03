/**
 * PageTransition Component
 *
 * Provides smooth fade-in/slide-up animations for page transitions.
 * Uses CSS animations for optimal performance (0KB bundle overhead).
 *
 * Features:
 * - Respects prefers-reduced-motion
 * - Automatic cleanup on unmount
 * - Configurable animation variants
 */

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { shouldReduceMotion } from "@/lib/animations";

const emptySubscribe = () => () => {};

export interface PageTransitionProps {
	children: React.ReactNode;
	className?: string;
	variant?: "fade" | "slide-up" | "slide-down" | "scale";
}

export const PageTransition: React.FC<PageTransitionProps> = ({
	children,
	className = "",
	variant = "fade",
}) => {
	const respectMotionPreference = useSyncExternalStore(
		emptySubscribe,
		() => shouldReduceMotion(),
		() => false,
	);

	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		if (respectMotionPreference) return;

		const animationTimer = setTimeout(() => {
			setIsVisible(true);
		}, 50);

		return () => clearTimeout(animationTimer);
	}, [respectMotionPreference]);

	// If user prefers reduced motion, just show content without animation
	if (respectMotionPreference) {
		return <div className={className}>{children}</div>;
	}

	// Animation variants
	const animationClasses = {
		fade: isVisible ? "page-transition-fade-in" : "page-transition-fade-out",
		"slide-up": isVisible ? "page-transition-slide-up-in" : "page-transition-slide-up-out",
		"slide-down": isVisible ? "page-transition-slide-down-in" : "page-transition-slide-down-out",
		scale: isVisible ? "page-transition-scale-in" : "page-transition-scale-out",
	};

	return <div className={`${animationClasses[variant]} ${className}`.trim()}>{children}</div>;
};

/**
 * Simple page wrapper that automatically applies page transitions
 * to all pages. Use this in layout.tsx to wrap the main content.
 */
export const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return <PageTransition variant="slide-up">{children}</PageTransition>;
};
