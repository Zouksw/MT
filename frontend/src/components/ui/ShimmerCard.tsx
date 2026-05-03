"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type React from "react";
import { useCallback, useRef } from "react";

/**
 * ShimmerCard — a card wrapper with perpetual shimmer micro-interaction.
 * Taste-skill: every card must have an "active state" that loops infinitely.
 */
export const ShimmerCard: React.FC<{
	children: React.ReactNode;
	className?: string;
}> = ({ children, className = "" }) => {
	return (
		<div className={`relative overflow-hidden ${className}`}>
			{children}
			{/* Perpetual shimmer overlay */}
			<motion.div
				className="pointer-events-none absolute inset-0 z-20"
				initial={{ x: "-100%" }}
				animate={{ x: "200%" }}
				transition={{
					duration: 3,
					repeat: Infinity,
					repeatDelay: 4,
					ease: "linear",
				}}
				style={{
					background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
				}}
			/>
		</div>
	);
};

/**
 * FloatElement — perpetual floating animation for decorative elements.
 * Taste-skill: perpetual micro-interactions (float).
 */
export const FloatElement: React.FC<{
	children: React.ReactNode;
	className?: string;
	amplitude?: number;
	duration?: number;
}> = ({ children, className, amplitude = 6, duration = 4 }) => {
	const prefersReducedMotion = useReducedMotion();
	return (
		<motion.div
			className={className}
			animate={
				prefersReducedMotion
					? {}
					: {
							y: [-amplitude, amplitude, -amplitude],
						}
			}
			transition={{
				duration,
				repeat: Infinity,
				ease: "easeInOut",
			}}
		>
			{children}
		</motion.div>
	);
};

/**
 * PulseDot — breathing status indicator.
 * Taste-skill: "Live Status" with breathing indicators.
 */
export const PulseDot: React.FC<{
	color?: string;
	size?: number;
	className?: string;
}> = ({ color = "bg-green-500", size = 8, className = "" }) => {
	const prefersReducedMotion = useReducedMotion();
	return (
		<motion.span
			className={`inline-block rounded-full ${color} ${className}`}
			style={{ width: size, height: size }}
			animate={
				prefersReducedMotion
					? {}
					: {
							scale: [1, 1.3, 1],
							opacity: [1, 0.7, 1],
						}
			}
			transition={{
				duration: 2,
				repeat: Infinity,
				ease: "easeInOut",
			}}
		/>
	);
};

/**
 * MagneticButton — wrapper that pulls toward cursor on hover.
 * Taste-skill: MOTION_INTENSITY > 5 requires magnetic micro-physics.
 */
export const MagneticButton: React.FC<{
	children: React.ReactNode;
	className?: string;
	strength?: number;
}> = ({ children, className = "", strength = 0.3 }) => {
	const ref = useRef<HTMLDivElement>(null);
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const springX = useSpring(x, { stiffness: 300, damping: 20 });
	const springY = useSpring(y, { stiffness: 300, damping: 20 });

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			const el = ref.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			x.set((e.clientX - cx) * strength);
			y.set((e.clientY - cy) * strength);
		},
		[x, y, strength],
	);

	const handleMouseLeave = useCallback(() => {
		x.set(0);
		y.set(0);
	}, [x, y]);

	return (
		<motion.div
			ref={ref}
			className={`inline-block ${className}`}
			style={{ x: springX, y: springY }}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			{children}
		</motion.div>
	);
};
