"use client";

import { Database, Eye, FlaskConical, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";

interface QuickAction {
	key: string;
	title: string;
	description: string;
	icon: React.ReactNode;
	path: string;
	primary?: boolean;
}

const quickActions: QuickAction[] = [
	{
		key: "create-timeseries",
		title: "New Time Series",
		description: "Create a new time series",
		icon: <Database className="size-5" />,
		path: "/timeseries",
		primary: true,
	},
	{
		key: "create-forecast",
		title: "New Forecast",
		description: "Generate AI predictions",
		icon: <Zap className="size-5" />,
		path: "/forecasts/create",
	},
	{
		key: "view-alerts",
		title: "View Alerts",
		description: "Check active alerts",
		icon: <Eye className="size-5" />,
		path: "/alerts",
	},
	{
		key: "detect-anomalies",
		title: "Detect Anomalies",
		description: "Run anomaly detection",
		icon: <FlaskConical className="size-5" />,
		path: "/ai/anomalies",
	},
];

export const QuickActions: React.FC = () => {
	const router = useRouter();

	return (
		<div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 p-4">
			<h5 className="text-base font-semibold mb-4">Quick Actions</h5>
			<div className="grid grid-cols-2 gap-3">
				{quickActions.map((action, i) => (
					<button type="button"
						key={action.key}
						onClick={() => router.push(action.path)}
						className={`group relative w-full flex items-center gap-3 p-4 rounded-lg text-left transition-shadow duration-200 stagger-slide-up ${
							action.primary
								? "bg-primary text-white hover:bg-primary-hover border border-primary"
								: "bg-card/80 border border hover:border-primary"
						}`}
						style={{ animationDelay: `${i * 50}ms` }}
					>
						<div
							className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${
								action.primary ? "bg-white/20" : "bg-gray-50 dark:bg-gray-700 text-amber-600"
							}`}
						>
							{action.icon}
						</div>
						<div className="min-w-0 flex-1">
							<div
								className={`font-semibold text-sm leading-tight ${!action.primary ? "text-gray-900 dark:text-white" : ""}`}
							>
								{action.title}
							</div>
							<div
								className={`text-xs mt-0.5 ${action.primary ? "text-white/80" : "text-muted-foreground"}`}
							>
								{action.description}
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
};

export default QuickActions;
