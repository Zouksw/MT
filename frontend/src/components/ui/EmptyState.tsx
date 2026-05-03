"use client";

import { Activity, BarChart3, Bell, Database, Inbox, Search, TrendingUp } from "lucide-react";
import type React from "react";

export type EmptyStateType =
	| "default"
	| "data"
	| "datasets"
	| "timeseries"
	| "alerts"
	| "anomalies"
	| "forecasts"
	| "errors"
	| "search";

export interface EmptyStateProps {
	type?: EmptyStateType;
	title?: string;
	description?: string;
	actionText?: string;
	onAction?: () => void;
	illustration?: React.ReactNode;
}

// --- Illustration map ---

const illustrationMap: Record<
	EmptyStateType,
	{ title: string; description: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
	default: {
		title: "Nothing Here Yet",
		description: "When you add items, they'll appear here.",
		icon: <Inbox className="size-16 text-gray-400" strokeWidth={1.5} />,
		color: "#6B7280",
		bgColor: "bg-gray-50 dark:bg-gray-800/50",
	},
	data: {
		title: "No Data Yet",
		description: "Start by adding your first time series or importing existing data.",
		icon: <BarChart3 className="size-16 text-primary" strokeWidth={1.5} />,
		color: "#B8860B",
		bgColor: "bg-primary-light/50 dark:bg-gray-800/50",
	},
	datasets: {
		title: "No Datasets",
		description: "Create your first dataset to organize and manage your time series data.",
		icon: <Database className="size-16 text-primary" strokeWidth={1.5} />,
		color: "#B8860B",
		bgColor: "bg-primary-light/50 dark:bg-gray-800/50",
	},
	timeseries: {
		title: "No Time Series",
		description: "Create a time series to start collecting and analyzing your data.",
		icon: <Activity className="size-16 text-primary" strokeWidth={1.5} />,
		color: "#B8860B",
		bgColor: "bg-primary-light/50 dark:bg-gray-800/50",
	},
	alerts: {
		title: "No Alerts",
		description: "You're all caught up! No alerts need your attention right now.",
		icon: <Bell className="size-16 text-emerald-500" strokeWidth={1.5} />,
		color: "#10B981",
		bgColor: "bg-green-50/50 dark:bg-green-900/10",
	},
	anomalies: {
		title: "No Anomalies Detected",
		description: "Great! Your data looks normal. No anomalies have been detected.",
		icon: <Bell className="size-16 text-emerald-500" strokeWidth={1.5} />,
		color: "#10B981",
		bgColor: "bg-green-50/50 dark:bg-green-900/10",
	},
	forecasts: {
		title: "No Forecasts",
		description: "Create AI-powered forecasts to predict future trends in your data.",
		icon: <TrendingUp className="size-16 text-purple-500" strokeWidth={1.5} />,
		color: "#8B5CF6",
		bgColor: "bg-purple-50/50 dark:bg-purple-900/10",
	},
	errors: {
		title: "No Errors Detected",
		description: "Everything is running smoothly. No errors to display.",
		icon: <Bell className="size-16 text-emerald-500" strokeWidth={1.5} />,
		color: "#10B981",
		bgColor: "bg-green-50/50 dark:bg-green-900/10",
	},
	search: {
		title: "No Results Found",
		description: "Try adjusting your search terms or filters to find what you're looking for.",
		icon: <Search className="size-16 text-gray-400" strokeWidth={1.5} />,
		color: "#64748B",
		bgColor: "bg-gray-50/50 dark:bg-gray-800/30",
	},
};

export const EmptyState: React.FC<EmptyStateProps> = ({
	type = "default",
	title,
	description,
	actionText,
	onAction,
	illustration,
}) => {
	const config = illustrationMap[type];
	const displayTitle = title || config.title;
	const displayDescription = description || config.description;

	return (
		<div className={`text-center py-12 px-6 rounded-lg ${config.bgColor}`}>
			{/* Icon Illustration */}
			<div className="scale-in inline-block mb-4">{illustration || config.icon}</div>

			{/* Text */}
			<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 font-display">
				{displayTitle}
			</h3>
			<p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
				{displayDescription}
			</p>

			{/* CTA */}
			{actionText && onAction && (
				<button
					onClick={onAction}
					className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white outline outline-black/5 dark:outline-white/10 transition-all duration-200 hover:bg-primary-hover active:translate-y-0"
				>
					{actionText}
				</button>
			)}
		</div>
	);
};

// Pre-configured empty states
export const NoData: React.FC<{ actionText?: string; onAction?: () => void }> = ({
	actionText = "Add Data",
	onAction,
}) => <EmptyState type="data" actionText={actionText} onAction={onAction} />;

export const NoDatasets: React.FC<{
	actionText?: string;
	onAction?: () => void;
}> = ({ actionText = "Create Dataset", onAction }) => (
	<EmptyState type="datasets" actionText={actionText} onAction={onAction} />
);

export const NoTimeseries: React.FC<{
	actionText?: string;
	onAction?: () => void;
}> = ({ actionText = "Create Time Series", onAction }) => (
	<EmptyState type="timeseries" actionText={actionText} onAction={onAction} />
);

export const NoAlerts: React.FC = () => <EmptyState type="alerts" />;
export const NoAnomalies: React.FC = () => <EmptyState type="anomalies" />;

export const NoForecasts: React.FC<{
	actionText?: string;
	onAction?: () => void;
}> = ({ actionText = "Create Forecast", onAction }) => (
	<EmptyState type="forecasts" actionText={actionText} onAction={onAction} />
);

export const NoSearchResults: React.FC = () => <EmptyState type="search" />;

export default EmptyState;
