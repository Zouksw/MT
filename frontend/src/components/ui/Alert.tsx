"use client";

import type React from "react";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
	variant?: AlertVariant;
	title?: string;
	children: React.ReactNode;
	closable?: boolean;
	onClose?: () => void;
	className?: string;
}

const VARIANT_MAP: Record<
	AlertVariant,
	{ bg: string; border: string; text: string; icon: string }
> = {
	info: {
		bg: "bg-blue-50 dark:bg-blue-900/20",
		border: "border-blue-200 dark:border-blue-800",
		text: "text-blue-800 dark:text-blue-200",
		icon: "ℹ",
	},
	success: {
		bg: "bg-green-50 dark:bg-green-900/20",
		border: "border-green-200 dark:border-green-800",
		text: "text-green-800 dark:text-green-200",
		icon: "✓",
	},
	warning: {
		bg: "bg-amber-50 dark:bg-amber-900/20",
		border: "border-amber-200 dark:border-amber-800",
		text: "text-amber-800 dark:text-amber-200",
		icon: "⚠",
	},
	error: {
		bg: "bg-red-50 dark:bg-red-900/20",
		border: "border-red-200 dark:border-red-800",
		text: "text-red-800 dark:text-red-200",
		icon: "✗",
	},
};

export const Alert: React.FC<AlertProps> = ({
	variant = "info",
	title,
	children,
	closable = false,
	onClose,
	className = "",
}) => {
	const { bg, border, text, icon } = VARIANT_MAP[variant];

	return (
		<div
			className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${bg} ${border} ${text} ${className}`}
			role="alert"
		>
			<span className="text-sm font-bold mt-0.5">{icon}</span>
			<div className="flex-1 min-w-0">
				{title && <p className="font-semibold text-sm mb-0.5">{title}</p>}
				<div className="text-sm">{children}</div>
			</div>
			{closable && (
				<button
					onClick={onClose}
					className="text-current opacity-40 hover:opacity-70 transition-opacity text-sm leading-none"
					aria-label="Close"
				>
					×
				</button>
			)}
		</div>
	);
};
