"use client";

import type React from "react";

export type StatusType =
	| "active"
	| "inactive"
	| "pending"
	| "processing"
	| "success"
	| "warning"
	| "error"
	| "default";

export interface StatusBadgeProps {
	status: StatusType | string;
	text?: string;
	className?: string;
}

const statusColors: Record<StatusType, { bg: string; text: string }> = {
	active: {
		bg: "bg-emerald-50 dark:bg-emerald-950",
		text: "text-emerald-700 dark:text-emerald-400",
	},
	inactive: { bg: "bg-muted", text: "text-muted-foreground" },
	pending: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-400" },
	processing: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-400" },
	success: {
		bg: "bg-emerald-50 dark:bg-emerald-950",
		text: "text-emerald-700 dark:text-emerald-400",
	},
	warning: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-400" },
	error: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-400" },
	default: { bg: "bg-muted", text: "text-muted-foreground" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text, className }) => {
	const colors = statusColors[status as StatusType] || statusColors.default;

	return (
		<span
			className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className || ""}`}
		>
			{text || status}
		</span>
	);
};

export const ActiveBadge: React.FC<{ text?: string }> = ({ text = "Active" }) => (
	<StatusBadge status="active" text={text} />
);
export const InactiveBadge: React.FC<{ text?: string }> = ({ text = "Inactive" }) => (
	<StatusBadge status="inactive" text={text} />
);
export const PendingBadge: React.FC<{ text?: string }> = ({ text = "Pending" }) => (
	<StatusBadge status="pending" text={text} />
);
export const SuccessBadge: React.FC<{ text?: string }> = ({ text = "Success" }) => (
	<StatusBadge status="success" text={text} />
);
export const ErrorBadge: React.FC<{ text?: string }> = ({ text = "Error" }) => (
	<StatusBadge status="error" text={text} />
);

export default StatusBadge;
