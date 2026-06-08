"use client";

import { Beef, BrainCircuit, Eye, TrendingUp } from "lucide-react";
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
		key: "beef-overview",
		title: "Beef Overview",
		description: "Cut prices & factories",
		icon: <Beef className="size-5" />,
		path: "/beef",
		primary: true,
	},
	{
		key: "ai-signals",
		title: "AI Price Signals",
		description: "8 models forecasting beef",
		icon: <BrainCircuit className="size-5" />,
		path: "/ai",
	},
	{
		key: "market-charts",
		title: "Market Charts",
		description: "Live cattle futures",
		icon: <TrendingUp className="size-5" />,
		path: "/trading",
	},
	{
		key: "view-alerts",
		title: "Price Alerts",
		description: "Beef price notifications",
		icon: <Eye className="size-5" />,
		path: "/alerts",
	},
];

export const QuickActions: React.FC = () => {
	const router = useRouter();

	return (
		<div className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08] p-4">
			<h5 className="text-base font-semibold mb-4">Quick Actions</h5>
			<div className="grid grid-cols-2 gap-3">
				{quickActions.map((action, i) => (
					<button
						type="button"
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
