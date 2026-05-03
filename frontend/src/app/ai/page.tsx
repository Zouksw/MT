"use client";

import { AlertTriangle, Brain, ChevronRight, FlaskConical, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

const aiSections = [
	{
		title: "AI Models",
		description: "Built-in AI models for time series forecasting and prediction",
		icon: <FlaskConical className="size-5" />,
		color: "from-primary to-blue-400",
		href: "/ai/models",
	},
	{
		title: "Anomaly Detection",
		description: "Detect anomalies in your time series data with configurable rules",
		icon: <AlertTriangle className="size-5" />,
		color: "from-red-500 to-orange-400",
		href: "/ai/anomalies",
	},
	{
		title: "Predictions",
		description: "Generate AI-powered price predictions with confidence scores",
		icon: <Brain className="size-5" />,
		color: "from-purple-500 to-indigo-400",
		href: "/ai/predict",
	},
	{
		title: "Model Accuracy",
		description: "Track and compare AI model performance with MAPE metrics",
		icon: <TrendingUp className="size-5" />,
		color: "from-emerald-500 to-teal-400",
		href: "/ai/accuracy",
	},
];

export default function AIPage() {
	return (
		<PageContainer>
			<div className="flex items-start justify-between gap-4 mb-6">
				<div>
					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
						<Link href="/" className="hover:text-primary">
							Home
						</Link>
						<ChevronRight className="size-3" />
						<span>AI & Anomaly Detection</span>
					</div>
					<h2 className="text-2xl font-semibold text-foreground">AI & Anomaly Detection</h2>
					<p className="text-sm text-muted-foreground mt-1">
						AI-powered forecasting, anomaly detection, and prediction tools
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{aiSections.map((section) => (
					<Link
						key={section.href}
						href={section.href}
						className="flex items-center gap-4 p-5 rounded-xl border bg-card transition-all duration-200 hover:shadow-card-hover group"
					>
						<div
							className={`w-12 h-12 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center text-white shadow-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}
						>
							{section.icon}
						</div>
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-foreground">{section.title}</div>
							<p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
						</div>
						<ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:text-primary group-hover:translate-x-0.5" />
					</Link>
				))}
			</div>
		</PageContainer>
	);
}
