"use client";

import type React from "react";

export type TagColor = "default" | "primary" | "success" | "warning" | "error" | "info";

export interface TagProps {
	color?: TagColor;
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
}

const COLOR_MAP: Record<TagColor, string> = {
	default: "bg-muted text-muted-foreground border",
	primary: "bg-primary/10 dark:bg-primary/15 text-primary border-primary/20 dark:border-primary/20",
	success:
		"bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
	warning:
		"bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
	error:
		"bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
	info: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

export const Tag: React.FC<TagProps> = ({
	color = "default",
	children,
	className = "",
	onClick,
}) => {
	return (
		<button
			type="button"
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${COLOR_MAP[color]} ${onClick ? "cursor-pointer hover:opacity-80" : ""} ${className}`}
			onClick={onClick}
		>
			{children}
		</button>
	);
};
