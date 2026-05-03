"use client";

interface FreshnessBadgeProps {
	date: string | null | undefined;
	compact?: boolean;
}

function daysBetween(dateStr: string): number {
	const d = new Date(dateStr);
	const now = new Date();
	return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function FreshnessBadge({ date, compact }: FreshnessBadgeProps) {
	if (!date) {
		return (
			<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
				<span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
				{compact ? "No data" : "No data yet"}
			</span>
		);
	}

	const days = daysBetween(date);

	let color: string;
	let bg: string;
	let label: string;

	if (days <= 1) {
		color = "text-green-600 dark:text-green-400";
		bg = "bg-green-500";
		label = compact ? "Live" : "Updated today";
	} else if (days <= 7) {
		color = "text-amber-600 dark:text-amber-400";
		bg = "bg-amber-500";
		label = compact ? `${days}d ago` : `${days} day${days !== 1 ? "s" : ""} ago`;
	} else {
		color = "text-red-600 dark:text-red-400";
		bg = "bg-red-500";
		label = compact ? `${days}d old` : `Stale: ${days} days old`;
	}

	return (
		<span className={`inline-flex items-center gap-1.5 text-xs ${color}`}>
			<span className={`w-1.5 h-1.5 rounded-full ${bg}`} />
			{label}
		</span>
	);
}
