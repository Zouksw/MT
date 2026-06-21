"use client";

import React, { useEffect, useRef, useState } from "react";

export interface TrendIndicator {
	value: number;
	isPositive: boolean;
}

export type StatCardVariant = "default" | "primary" | "success" | "warning" | "error";

export interface StatCardProps {
	title: string;
	value: number | string;
	icon?: React.ReactNode;
	trend?: TrendIndicator;
	sparklineData?: number[];
	variant?: StatCardVariant;
	loading?: boolean;
	onClick?: () => void;
}

function useAnimatedCounter(target: number, duration = 800) {
	const [display, setDisplay] = useState(() => {
		if (
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		)
			return target;
		return 0;
	});
	const prevTarget = useRef(target);

	useEffect(() => {
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReducedMotion) {
			prevTarget.current = target;
			return;
		}
		const start = prevTarget.current;
		const diff = target - start;
		if (diff === 0) return;
		const startTime = performance.now();
		function step(now: number) {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			setDisplay(Math.round(start + diff * eased));
			if (progress < 1) requestAnimationFrame(step);
			else prevTarget.current = target;
		}
		requestAnimationFrame(step);
	}, [target, duration]);

	return display;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
	if (data.length < 2) return null;
	const W = 80,
		H = 24;
	const min = Math.min(...data),
		max = Math.max(...data),
		range = max - min || 1;
	const points = data.map((v, i) => ({
		x: (i / (data.length - 1)) * W,
		y: H - ((v - min) / range) * (H - 4) - 2,
	}));
	const d = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
		.join(" ");
	let totalLength = 0;
	for (let i = 1; i < points.length; i++) {
		totalLength += Math.sqrt(
			(points[i].x - points[i - 1].x) ** 2 + (points[i].y - points[i - 1].y) ** 2,
		);
	}

	return (
		<svg
			width={W}
			height={H}
			viewBox={`0 0 ${W} ${H}`}
			className="mt-1"
			style={{ overflow: "visible" }}
			role="img"
			aria-label="Sparkline chart"
		>
			<title>Sparkline</title>
			<path
				d={d}
				fill="none"
				stroke={color}
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeDasharray={totalLength}
				strokeDashoffset={totalLength}
				style={{ animation: "sparkline-draw 0.8s ease-out forwards" }}
			/>
			<circle
				cx={points[points.length - 1].x}
				cy={points[points.length - 1].y}
				r={2}
				fill={color}
				opacity={0}
				style={{ animation: "sparkline-dot 0.3s ease-out 0.7s forwards" }}
			/>
		</svg>
	);
}

const variantColors: Record<StatCardVariant, { text: string }> = {
	default: { text: "#475569" },
	primary: { text: "#B8860B" },
	success: { text: "#16A34A" },
	warning: { text: "#D97706" },
	error: { text: "#DC2626" },
};

export const StatCard = React.memo<StatCardProps>(
	({ title, value, icon, trend, sparklineData, variant = "default", loading = false, onClick }) => {
		const colors = variantColors[variant];
		const numericValue = typeof value === "number" ? value : 0;
		const animatedValue = useAnimatedCounter(numericValue);
		const displayValue = typeof value === "number" ? animatedValue : value;

		if (loading) {
			return (
				<div className="bg-card rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] p-5 animate-pulse">
					<div className="h-4 bg-muted rounded w-20 mb-3" />
					<div className="h-7 bg-muted rounded w-16" />
				</div>
			);
		}

		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: card wrapper with optional click handler
			<div
				className={`bg-card rounded-lg shadow-card dark:shadow-card-dark p-5 transition-all duration-200 ${onClick ? "cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-card-hover-dark" : ""}`}
				role={onClick ? "button" : undefined}
				tabIndex={onClick ? 0 : undefined}
				onKeyDown={
					onClick
						? (e) => {
								if (e.key === "Enter" || e.key === " ") onClick();
							}
						: undefined
				}
				onClick={onClick}
			>
				<div className="flex items-center gap-2 mb-3">
					{icon && <span style={{ color: colors.text }}>{icon}</span>}
					<span className="text-xs font-medium text-muted-foreground">{title}</span>
				</div>
				<div className="flex items-end justify-between gap-2">
					<span
						className="text-[28px] font-semibold tracking-tight leading-none"
						style={{ color: colors.text }}
					>
						{displayValue}
					</span>
					{trend && (
						<span
							className="text-xs font-medium"
							style={{ color: trend.isPositive ? "#16A34A" : "#DC2626" }}
						>
							{trend.isPositive ? "+" : ""}
							{trend.value}%
						</span>
					)}
				</div>
				{sparklineData && sparklineData.length >= 2 && (
					<Sparkline data={sparklineData} color={colors.text} />
				)}
			</div>
		);
	},
	(prevProps, nextProps) =>
		prevProps.title === nextProps.title &&
		prevProps.value === nextProps.value &&
		prevProps.trend?.value === nextProps.trend?.value &&
		prevProps.trend?.isPositive === nextProps.trend?.isPositive &&
		prevProps.variant === nextProps.variant &&
		prevProps.loading === nextProps.loading &&
		prevProps.sparklineData?.length === nextProps.sparklineData?.length,
);
StatCard.displayName = "StatCard";

export default StatCard;
