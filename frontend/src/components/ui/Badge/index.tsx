"use client";

import type React from "react";

export type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "info";

export interface BadgeProps {
	variant?: BadgeVariant;
	count?: number;
	dot?: boolean;
	children: React.ReactNode;
	className?: string;
}

const VARIANT_MAP: Record<BadgeVariant, string> = {
	default: "bg-muted-foreground",
	primary: "bg-primary",
	success: "bg-green-600 dark:bg-green-500",
	warning: "bg-yellow-600 dark:bg-yellow-500",
	error: "bg-destructive",
	info: "bg-blue-600 dark:bg-blue-500",
};

export const Badge: React.FC<BadgeProps> = ({
	variant = "error",
	count,
	dot = false,
	children,
	className = "",
}) => {
	return (
		<span className={`relative inline-flex ${className}`}>
			{children}
			{(count !== undefined || dot) && (
				<span
					className={`absolute -top-1 -right-1 ${VARIANT_MAP[variant]} text-white rounded-full flex items-center justify-center ${
						dot ? "w-2 h-2" : "min-w-[18px] h-[18px] px-1 text-[10px] font-semibold"
					}`}
				>
					{!dot && count}
				</span>
			)}
		</span>
	);
};
